package redisrepo

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"go-distributed-llm/shared/models"

	"github.com/redis/go-redis/v9"
)

const (
	dlqStreamName       = "jobs:dlq"
	workerStreamPrefix  = "jobs:worker:"
	defaultMaxRetries   = 3
	defaultMaxStreamLen = 10000
)

// RedisStreamQueue cài đặt ports.JobQueue & ports.AffinityRebalancer bằng Redis Streams
// (hỗ trợ Priority Queues, Worker Affinity, true backlog depth qua XINFO GROUPS, và Dead-Letter Queue).
type RedisStreamQueue struct {
	client        redis.UniversalClient
	ensuredGroups sync.Map // map["stream|group"]struct{} tránh gửi thừa XGROUP CREATE mỗi vòng poll
	maxRetries    int
}

func NewRedisStreamQueue(client redis.UniversalClient) *RedisStreamQueue {
	return &RedisStreamQueue{
		client:     client,
		maxRetries: defaultMaxRetries,
	}
}

func streamKey(model string) string {
	return fmt.Sprintf("jobs:model:%s", model)
}

func streamKeyByPriority(model string, priority string) string {
	switch strings.ToLower(strings.TrimSpace(priority)) {
	case models.PriorityHigh:
		return fmt.Sprintf("jobs:model:%s:high", model)
	case models.PriorityLow:
		return fmt.Sprintf("jobs:model:%s:low", model)
	default:
		return streamKey(model)
	}
}

func workerAffinityStream(workerID string) string {
	return workerStreamPrefix + workerID
}

func streamKeyForJob(job models.JobPayload) string {
	if strings.TrimSpace(job.PreferredWorkerID) != "" {
		return workerAffinityStream(strings.TrimSpace(job.PreferredWorkerID))
	}
	return streamKeyByPriority(job.Model, job.Priority)
}

func (q *RedisStreamQueue) workerStreamList(consumerID string, modelsList []string) []string {
	streams := make([]string, 0, 1+len(modelsList)*3)
	if strings.TrimSpace(consumerID) != "" {
		streams = append(streams, workerAffinityStream(consumerID))
	}
	for _, m := range modelsList {
		streams = append(streams, streamKeyByPriority(m, models.PriorityHigh))
	}
	for _, m := range modelsList {
		streams = append(streams, streamKeyByPriority(m, models.PriorityNormal))
	}
	for _, m := range modelsList {
		streams = append(streams, streamKeyByPriority(m, models.PriorityLow))
	}
	return streams
}

func (q *RedisStreamQueue) ensureGroup(ctx context.Context, sKey string, group string) {
	cacheKey := sKey + "|" + group
	if _, ok := q.ensuredGroups.Load(cacheKey); ok {
		return
	}
	err := q.client.XGroupCreateMkStream(ctx, sKey, group, "0").Err()
	if err == nil || strings.Contains(err.Error(), "BUSYGROUP") {
		q.ensuredGroups.Store(cacheKey, struct{}{})
	}
}

func (q *RedisStreamQueue) clearGroupCache(streams []string, group string) {
	for _, s := range streams {
		q.ensuredGroups.Delete(s + "|" + group)
	}
}

func (q *RedisStreamQueue) PushJob(ctx context.Context, job models.JobPayload) error {
	sKey := streamKeyForJob(job)
	job.StreamName = sKey
	data, err := json.Marshal(job)
	if err != nil {
		return err
	}

	return q.client.XAdd(ctx, &redis.XAddArgs{
		Stream: sKey,
		MaxLen: defaultMaxStreamLen,
		Approx: true,
		Values: map[string]interface{}{"payload": string(data)},
	}).Err()
}

func (q *RedisStreamQueue) PullJobFromModels(ctx context.Context, group string, consumerID string, modelsList []string, blockDur time.Duration) (*models.JobPayload, error) {
	if len(modelsList) == 0 {
		return nil, nil
	}

	orderedKeys := q.workerStreamList(consumerID, modelsList)
	streams := make([]string, 0, len(orderedKeys)*2)
	for _, sKey := range orderedKeys {
		q.ensureGroup(ctx, sKey, group)
		streams = append(streams, sKey)
	}
	for range orderedKeys {
		streams = append(streams, ">")
	}

	res, err := q.client.XReadGroup(ctx, &redis.XReadGroupArgs{
		Group:    group,
		Consumer: consumerID,
		Streams:  streams,
		Count:    1,
		Block:    blockDur,
	}).Result()

	if err != nil {
		if err == redis.Nil || strings.Contains(err.Error(), "timeout") {
			return nil, nil
		}
		if strings.Contains(err.Error(), "NOGROUP") {
			q.clearGroupCache(orderedKeys, group)
		}
		return nil, err
	}

	if len(res) == 0 || len(res[0].Messages) == 0 {
		return nil, nil
	}

	return decodeStreamMessage(res[0].Stream, res[0].Messages[0])
}

func (q *RedisStreamQueue) AckJob(ctx context.Context, group string, streamName string, messageID string) error {
	return q.client.XAck(ctx, streamName, group, messageID).Err()
}

func (q *RedisStreamQueue) AutoClaimJobs(ctx context.Context, group string, consumerID string, modelsList []string, minIdle time.Duration, count int64) ([]models.JobPayload, error) {
	var claimed []models.JobPayload
	orderedKeys := q.workerStreamList(consumerID, modelsList)

	for _, sKey := range orderedKeys {
		q.ensureGroup(ctx, sKey, group)

		msgs, _, err := q.client.XAutoClaim(ctx, &redis.XAutoClaimArgs{
			Stream:   sKey,
			Group:    group,
			Consumer: consumerID,
			MinIdle:  minIdle,
			Start:    "0-0",
			Count:    count,
		}).Result()
		if err != nil {
			if err == redis.Nil {
				continue
			}
			if strings.Contains(err.Error(), "NOGROUP") {
				q.ensuredGroups.Delete(sKey + "|" + group)
			}
			return claimed, err
		}

		for _, msg := range msgs {
			deliveryCount := q.lookupDeliveryCount(ctx, sKey, group, msg.ID)
			job, err := decodeStreamMessage(sKey, msg)
			if err != nil {
				_ = q.pushRawToDLQ(ctx, sKey, msg.ID, fmt.Sprintf("%v", msg.Values["payload"]), "invalid json payload", deliveryCount)
				_ = q.AckJob(ctx, group, sKey, msg.ID)
				continue
			}

			job.RetryCount = int(deliveryCount)
			if q.maxRetries > 0 && deliveryCount > int64(q.maxRetries) {
				_ = q.pushJobToDLQ(ctx, *job, fmt.Sprintf("exceeded max delivery attempts (%d)", q.maxRetries))
				_ = q.AckJob(ctx, group, sKey, msg.ID)
				continue
			}

			claimed = append(claimed, *job)
		}
	}

	return claimed, nil
}

// ReclaimStaleAffinityJobs chuyển các job nằm trong jobs:worker:<deadWorker> (khi worker đó không còn active)
// về lại stream chung theo model/priority để tránh bất kỳ request affinity nào bị mồ côi.
func (q *RedisStreamQueue) ReclaimStaleAffinityJobs(ctx context.Context, group string, activeWorkerIDs map[string]bool, minIdle time.Duration) (int, error) {
	var (
		cursor uint64
		keys   []string
	)
	for {
		batch, nextCursor, err := q.client.Scan(ctx, cursor, workerStreamPrefix+"*", 100).Result()
		if err != nil {
			return 0, err
		}
		keys = append(keys, batch...)
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}

	moved := 0
	for _, sKey := range keys {
		ownerID := strings.TrimPrefix(sKey, workerStreamPrefix)
		if activeWorkerIDs[ownerID] {
			continue
		}
		q.ensureGroup(ctx, sKey, group)

		msgs, _, err := q.client.XAutoClaim(ctx, &redis.XAutoClaimArgs{
			Stream:   sKey,
			Group:    group,
			Consumer: "rebalancer",
			MinIdle:  minIdle,
			Start:    "0-0",
			Count:    20,
		}).Result()
		if err == nil {
			for _, msg := range msgs {
				if job, decErr := decodeStreamMessage(sKey, msg); decErr == nil {
					job.PreferredWorkerID = ""
					if pushErr := q.PushJob(ctx, *job); pushErr == nil {
						moved++
					}
				}
				_ = q.AckJob(ctx, group, sKey, msg.ID)
				_ = q.client.XDel(ctx, sKey, msg.ID).Err()
			}
		}

		unconsumed, readErr := q.client.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    group,
			Consumer: "rebalancer",
			Streams:  []string{sKey, ">"},
			Count:    20,
			Block:    -1,
		}).Result()
		if readErr == nil && len(unconsumed) > 0 {
			for _, msg := range unconsumed[0].Messages {
				if job, decErr := decodeStreamMessage(sKey, msg); decErr == nil {
					job.PreferredWorkerID = ""
					if pushErr := q.PushJob(ctx, *job); pushErr == nil {
						moved++
					}
				}
				_ = q.AckJob(ctx, group, sKey, msg.ID)
				_ = q.client.XDel(ctx, sKey, msg.ID).Err()
			}
		}
	}

	return moved, nil
}

func (q *RedisStreamQueue) GetQueueLength(ctx context.Context, model string) (int64, error) {
	var total int64
	for _, p := range []string{models.PriorityHigh, models.PriorityNormal, models.PriorityLow} {
		depth, err := q.streamBacklogDepth(ctx, streamKeyByPriority(model, p))
		if err != nil {
			return total, err
		}
		total += depth
	}
	return total, nil
}

func (q *RedisStreamQueue) GetDLQLength(ctx context.Context) (int64, error) {
	return q.client.XLen(ctx, dlqStreamName).Result()
}

func (q *RedisStreamQueue) streamBacklogDepth(ctx context.Context, sKey string) (int64, error) {
	groups, err := q.client.XInfoGroups(ctx, sKey).Result()
	if err != nil {
		if strings.Contains(err.Error(), "no such key") || strings.Contains(err.Error(), "NOGROUP") {
			n, xErr := q.client.XLen(ctx, sKey).Result()
			if xErr != nil {
				return 0, nil
			}
			return n, nil
		}
		return 0, err
	}
	if len(groups) == 0 {
		return q.client.XLen(ctx, sKey).Result()
	}

	var maxBacklog int64
	for _, g := range groups {
		lag := g.Lag
		if lag < 0 {
			lag = 0
		}
		backlog := g.Pending + lag
		if backlog > maxBacklog {
			maxBacklog = backlog
		}
	}
	return maxBacklog, nil
}

func (q *RedisStreamQueue) lookupDeliveryCount(ctx context.Context, sKey, group, msgID string) int64 {
	res, err := q.client.XPendingExt(ctx, &redis.XPendingExtArgs{
		Stream: sKey,
		Group:  group,
		Start:  msgID,
		End:    msgID,
		Count:  1,
	}).Result()
	if err != nil || len(res) == 0 {
		return 1
	}
	return res[0].RetryCount
}

func (q *RedisStreamQueue) pushJobToDLQ(ctx context.Context, job models.JobPayload, reason string) error {
	payload, _ := json.Marshal(job)
	return q.pushRawToDLQ(ctx, job.StreamName, job.StreamMessageID, string(payload), reason, int64(job.RetryCount))
}

func (q *RedisStreamQueue) pushRawToDLQ(ctx context.Context, originStream, msgID, payload, reason string, retries int64) error {
	return q.client.XAdd(ctx, &redis.XAddArgs{
		Stream: dlqStreamName,
		MaxLen: defaultMaxStreamLen,
		Approx: true,
		Values: map[string]interface{}{
			"origin_stream": originStream,
			"message_id":    msgID,
			"reason":        reason,
			"retries":       retries,
			"payload":       payload,
			"failed_at":     time.Now().UTC().Format(time.RFC3339),
		},
	}).Err()
}

func decodeStreamMessage(stream string, msg redis.XMessage) (*models.JobPayload, error) {
	rawPayload, ok := msg.Values["payload"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid job payload format in stream %s", stream)
	}

	var job models.JobPayload
	if err := json.Unmarshal([]byte(rawPayload), &job); err != nil {
		return nil, err
	}
	job.StreamMessageID = msg.ID
	job.StreamName = stream
	return &job, nil
}

