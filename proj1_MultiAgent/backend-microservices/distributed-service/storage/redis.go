package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"distributed-service/models"

	"github.com/redis/go-redis/v9"
)

type RedisStorage struct {
	client *redis.Client
}

// NewRedisStorage khởi tạo kết nối Redis
func NewRedisStorage(redisURL string) (*RedisStorage, error) {
	if redisURL == "" {
		redisURL = "redis://localhost:6379/0"
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("lỗi parse REDIS_URL: %w", err)
	}

	rdb := redis.NewClient(opt)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		rdb.Close()
		return nil, fmt.Errorf("lỗi ping Redis: %w", err)
	}

	log.Println("[REDIS] Kết nối Redis thành công tại", opt.Addr)
	return &RedisStorage{client: rdb}, nil
}

// SetNodeOnline đánh dấu Node đang kết nối WebSocket với TTL tự hết hạn nếu mất kết nối đột ngột
func (rs *RedisStorage) SetNodeOnline(ctx context.Context, nodeID string, ttl time.Duration) error {
	sessionKey := fmt.Sprintf("distributed:session:%s", nodeID)
	pipe := rs.client.Pipeline()
	pipe.Set(ctx, sessionKey, "ONLINE", ttl)
	pipe.SAdd(ctx, "distributed:online_nodes", nodeID)
	_, err := pipe.Exec(ctx)
	return err
}

// SetNodeOffline xóa phiên kết nối WebSocket khỏi Redis
func (rs *RedisStorage) SetNodeOffline(ctx context.Context, nodeID string) error {
	sessionKey := fmt.Sprintf("distributed:session:%s", nodeID)
	pipe := rs.client.Pipeline()
	pipe.Del(ctx, sessionKey)
	pipe.SRem(ctx, "distributed:online_nodes", nodeID)
	_, err := pipe.Exec(ctx)
	return err
}

// CacheTelemetry lưu telemetry mới nhất vào Redis Cache để truy vấn siêu tốc (TTL 5 phút)
func (rs *RedisStorage) CacheTelemetry(ctx context.Context, nodeID string, stats models.TelemetryStats) error {
	data, err := json.Marshal(stats)
	if err != nil {
		return err
	}
	key := fmt.Sprintf("distributed:telemetry:%s", nodeID)
	return rs.client.Set(ctx, key, string(data), 5*time.Minute).Err()
}

// PublishBroadcast phát tán gói tin WebSocket qua Redis Pub/Sub cho các instance khác
func (rs *RedisStorage) PublishBroadcast(ctx context.Context, channel string, message []byte) error {
	return rs.client.Publish(ctx, channel, message).Err()
}

// SubscribeBroadcast lắng nghe thông điệp từ Redis Pub/Sub và gọi callback
func (rs *RedisStorage) SubscribeBroadcast(ctx context.Context, channel string, handler func([]byte)) {
	pubsub := rs.client.Subscribe(ctx, channel)
	go func() {
		defer pubsub.Close()
		ch := pubsub.Channel()
		for msg := range ch {
			handler([]byte(msg.Payload))
		}
	}()
}

// IsNodeOnline kiểm tra xem node có session online hợp lệ trong Redis không
func (rs *RedisStorage) IsNodeOnline(ctx context.Context, nodeID string) bool {
	sessionKey := fmt.Sprintf("distributed:session:%s", nodeID)
	val, err := rs.client.Get(ctx, sessionKey).Result()
	return err == nil && val == "ONLINE"
}

// Close ngắt kết nối Redis
func (rs *RedisStorage) Close() error {
	if rs.client != nil {
		return rs.client.Close()
	}
	return nil
}
