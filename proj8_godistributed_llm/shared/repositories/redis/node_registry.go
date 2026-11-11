package redisrepo

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"go-distributed-llm/shared/models"

	"github.com/redis/go-redis/v9"
)

const (
	heartbeatKeyPrefix = "node:heartbeat:"
	drainKeyPrefix     = "node:drain:"
)

// RedisNodeRegistry cài đặt ports.NodeRegistry dùng SCAN + MGET (1 round-trip thay vì N GET lẻ)
// để chịu tải khi cụm mở rộng lên hàng trăm/nghìn Worker Node.
type RedisNodeRegistry struct {
	client redis.UniversalClient
}

func NewRedisNodeRegistry(client redis.UniversalClient) *RedisNodeRegistry {
	return &RedisNodeRegistry{client: client}
}

func (r *RedisNodeRegistry) UpdateHeartbeat(ctx context.Context, info models.WorkerNodeInfo, ttl time.Duration) error {
	key := fmt.Sprintf("%s%s", heartbeatKeyPrefix, info.WorkerID)
	data, err := json.Marshal(info)
	if err != nil {
		return err
	}
	return r.client.Set(ctx, key, string(data), ttl).Err()
}

func (r *RedisNodeRegistry) GetOnlineNodes(ctx context.Context) ([]models.WorkerNodeInfo, error) {
	var (
		cursor uint64
		keys   []string
	)

	for {
		batch, nextCursor, err := r.client.Scan(ctx, cursor, heartbeatKeyPrefix+"*", 200).Result()
		if err != nil {
			return nil, err
		}
		keys = append(keys, batch...)
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}

	if len(keys) == 0 {
		return []models.WorkerNodeInfo{}, nil
	}

	values, err := r.client.MGet(ctx, keys...).Result()
	if err != nil {
		return nil, err
	}

	nodes := make([]models.WorkerNodeInfo, 0, len(values))
	for _, raw := range values {
		strVal, ok := raw.(string)
		if !ok || strVal == "" {
			continue
		}
		var info models.WorkerNodeInfo
		if json.Unmarshal([]byte(strVal), &info) == nil {
			nodes = append(nodes, info)
		}
	}
	return nodes, nil
}

func (r *RedisNodeRegistry) SetNodeDraining(ctx context.Context, workerID string, draining bool) error {
	key := fmt.Sprintf("%s%s", drainKeyPrefix, workerID)
	if draining {
		return r.client.Set(ctx, key, "1", 0).Err()
	}
	return r.client.Del(ctx, key).Err()
}

func (r *RedisNodeRegistry) IsNodeDraining(ctx context.Context, workerID string) (bool, error) {
	key := fmt.Sprintf("%s%s", drainKeyPrefix, workerID)
	n, err := r.client.Exists(ctx, key).Result()
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

