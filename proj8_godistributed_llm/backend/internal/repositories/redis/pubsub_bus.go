package redisrepo

import (
	"context"
	"fmt"

	"github.com/redis/go-redis/v9"
)

// RedisEventBus cài đặt ports.EventBus bằng Redis Pub/Sub để phát tín hiệu dừng khẩn cấp.
type RedisEventBus struct {
	client *redis.Client
}

func NewRedisEventBus(client *redis.Client) *RedisEventBus {
	return &RedisEventBus{client: client}
}

func cancelChannel(jobID string) string {
	return fmt.Sprintf("ctrl:cancel:%s", jobID)
}

func (b *RedisEventBus) PublishCancel(ctx context.Context, jobID string) error {
	return b.client.Publish(ctx, cancelChannel(jobID), "STOP").Err()
}

func (b *RedisEventBus) SubscribeCancel(ctx context.Context, jobID string) <-chan struct{} {
	out := make(chan struct{}, 1)
	pubsub := b.client.Subscribe(ctx, cancelChannel(jobID))

	go func() {
		defer pubsub.Close()
		defer close(out)

		ch := pubsub.Channel()
		select {
		case <-ctx.Done():
			return
		case _, ok := <-ch:
			if ok {
				out <- struct{}{}
			}
		}
	}()

	return out
}

