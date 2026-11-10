package redisrepo

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"go-distributed-llm/internal/models"

	"github.com/redis/go-redis/v9"
)

// RedisStreamQueue cài đặt ports.JobQueue bằng Redis Streams (XADD, XREADGROUP, XACK, XAUTOCLAIM).
type RedisStreamQueue struct {
	client        *redis.Client
	ensuredGroups sync.Map // map["stream|group"]struct{} tránh gửi thừa XGROUP CREATE mỗi 2s
}

func NewRedisStreamQueue(client *redis.Client) *RedisStreamQueue {
	return &RedisStreamQueue{client: client}
}

func streamKey(model string) string {
	return fmt.Sprintf("jobs:model:%s", model)
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

func (q *RedisStreamQueue) clearGroupCache(modelsList []string, group string) {
	for _, m := range modelsList {
		q.ensuredGroups.Delete(streamKey(m) + "|" + group)
	}
}

func (q *RedisStreamQueue) PushJob(ctx context.Context, job models.JobPayload) error {
	sKey := streamKey(job.Model)
	job.StreamName = sKey
	data, err := json.Marshal(job)
	if err != nil {
		return err
	}

	return q.client.XAdd(ctx, &redis.XAddArgs{
		Stream: sKey,
		MaxLen: 10000, // Giới hạn xấp xỉ 10k entries/stream để tránh phình RAM Redis dài hạn
		Approx: true,
		Values: map[string]interface{}{"payload": string(data)},
	}).Err()
}

func (q *RedisStreamQueue) PullJobFromModels(ctx context.Context, group string, consumerID string, modelsList []string, blockDur time.Duration) (*models.JobPayload, error) {
	if len(modelsList) == 0 {
		return nil, nil
	}

	streams := make([]string, 0, len(modelsList)*2)
	for _, m := range modelsList {
		sKey := streamKey(m)
		q.ensureGroup(ctx, sKey, group)
		streams = append(streams, sKey)
	}
	for range modelsList {
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
		// Nếu Redis vừa flush/restart làm mất group, xóa cache để tạo lại ở vòng tiếp theo.
		if strings.Contains(err.Error(), "NOGROUP") {
			q.clearGroupCache(modelsList, group)
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

	for _, m := range modelsList {
		sKey := streamKey(m)
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
			job, err := decodeStreamMessage(sKey, msg)
			if err != nil {
				continue
			}
			claimed = append(claimed, *job)
		}
	}

	return claimed, nil
}

func (q *RedisStreamQueue) GetQueueLength(ctx context.Context, model string) (int64, error) {
	return q.client.XLen(ctx, streamKey(model)).Result()
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
