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

// RedisNodeRegistry cài đặt ports.NodeRegistry dùng scanAllKeys + Pipeline GET (1 round-trip thay vì N GET lẻ)
// để tương thích Redis Cluster và chịu tải khi cụm mở rộng lên hàng trăm/nghìn Worker Node.
type RedisNodeRegistry struct {
	client redis.UniversalClient
}

// NewRedisNodeRegistry khởi tạo repository quản lý node registry trên Redis.
func NewRedisNodeRegistry(client redis.UniversalClient) *RedisNodeRegistry {
	return &RedisNodeRegistry{client: client}
}

// UpdateHeartbeat ghi trạng thái + tài nguyên hiện tại của Worker kèm TTL tự hết hạn (nếu rớt mạng sẽ tự mất).
func (r *RedisNodeRegistry) UpdateHeartbeat(ctx context.Context, info models.WorkerNodeInfo, ttl time.Duration) error {
	key := fmt.Sprintf("%s%s", heartbeatKeyPrefix, info.WorkerID)
	data, err := json.Marshal(info)
	if err != nil {
		return err
	}
	return r.client.Set(ctx, key, string(data), ttl).Err()
}

// GetOnlineNodes thu thập toàn bộ Worker đang active (tránh blocking Redis bằng SCAN + Pipeline GET).
func (r *RedisNodeRegistry) GetOnlineNodes(ctx context.Context) ([]models.WorkerNodeInfo, error) {
	keys, err := scanAllKeys(ctx, r.client, heartbeatKeyPrefix+"*", 200)
	if err != nil {
		return nil, err
	}
	if len(keys) == 0 {
		return []models.WorkerNodeInfo{}, nil
	}

	// Dùng Pipeline GET thay cho MGET để tránh lỗi CROSSSLOT khi chạy Redis Cluster nhiều shard
	// nhưng vẫn giữ đúng 1 network round-trip.
	pipe := r.client.Pipeline()
	cmds := make([]*redis.StringCmd, len(keys))
	for i, k := range keys {
		cmds[i] = pipe.Get(ctx, k)
	}
	_, err = pipe.Exec(ctx)
	if err != nil && err != redis.Nil {
		// Một số key có thể vừa hết hạn TTL trong lúc pipeline chạy; vẫn đọc kết quả hợp lệ bên dưới.
		if len(cmds) == 0 {
			return nil, err
		}
	}

	nodes := make([]models.WorkerNodeInfo, 0, len(cmds))
	for _, cmd := range cmds {
		raw, getErr := cmd.Result()
		if getErr != nil || raw == "" {
			continue
		}
		var info models.WorkerNodeInfo
		if json.Unmarshal([]byte(raw), &info) == nil {
			nodes = append(nodes, info)
		}
	}
	return nodes, nil
}

// SetNodeDraining bật/tắt cờ bảo trì (drain) cho một Worker ID cụ thể để ngừng kéo job mới.
func (r *RedisNodeRegistry) SetNodeDraining(ctx context.Context, workerID string, draining bool) error {
	key := fmt.Sprintf("%s%s", drainKeyPrefix, workerID)
	if draining {
		return r.client.Set(ctx, key, "1", 0).Err()
	}
	return r.client.Del(ctx, key).Err()
}

// IsNodeDraining kiểm tra Worker hiện có đang bị đặt cờ DRAINING hay không.
func (r *RedisNodeRegistry) IsNodeDraining(ctx context.Context, workerID string) (bool, error) {
	key := fmt.Sprintf("%s%s", drainKeyPrefix, workerID)
	n, err := r.client.Exists(ctx, key).Result()
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

