package redisrepo

import (
	"context"

	"github.com/redis/go-redis/v9"
)

const cancelAllChannel = "ctrl:cancel:all"

// RedisEventBus cài đặt ports.EventBus qua 1 kênh Pub/Sub duy nhất ("ctrl:cancel:all")
// để mỗi Worker chỉ mở 1 kết nối subscribe thay vì mở 1 kết nối cho từng job.
type RedisEventBus struct {
	client redis.UniversalClient
}

// NewRedisEventBus khởi tạo EventBus phát và lắng nghe tín hiệu hủy job qua Redis Pub/Sub.
func NewRedisEventBus(client redis.UniversalClient) *RedisEventBus {
	return &RedisEventBus{client: client}
}

// PublishCancel phát tín hiệu STOP một jobID tới toàn bộ Worker đang lắng nghe kênh ctrl:cancel:all.
func (b *RedisEventBus) PublishCancel(ctx context.Context, jobID string) error {
	return b.client.Publish(ctx, cancelAllChannel, jobID).Err()
}

// SubscribeCancelAll mở 1 goroutine đọc stream Pub/Sub và đẩy các jobID cần hủy ra channel cho Worker Engine.
func (b *RedisEventBus) SubscribeCancelAll(ctx context.Context) (<-chan string, error) {
	pubsub := b.client.Subscribe(ctx, cancelAllChannel)
	if _, err := pubsub.Receive(ctx); err != nil {
		_ = pubsub.Close()
		return nil, err
	}

	out := make(chan string, 128)
	go func() {
		defer pubsub.Close()
		defer close(out)

		ch := pubsub.Channel()
		for {
			select {
			case <-ctx.Done():
				return
			case msg, ok := <-ch:
				if !ok {
					return
				}
				if msg.Payload != "" {
					select {
					case out <- msg.Payload:
					case <-ctx.Done():
						return
					}
				}
			}
		}
	}()

	return out, nil
}

