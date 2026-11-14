package bus

import (
	"context"
	"encoding/json"
	"time"

	"protocol-testbench/internal/core"

	"github.com/redis/go-redis/v9"
)

type RedisBus struct {
	client     *redis.Client
	inStream   string
	outChannel string
}

func NewRedisBus(addr string) *RedisBus {
	rdb := redis.NewClient(&redis.Options{
		Addr:        addr,
		DialTimeout: 200 * time.Millisecond,
		MaxRetries:  -1,
	})
	return &RedisBus{
		client:     rdb,
		inStream:   "bench:inbound:stream",
		outChannel: "bench:outbound:pubsub",
	}
}

func (r *RedisBus) Ping(ctx context.Context) error {
	return r.client.Ping(ctx).Err()
}

// Gateway đẩy gói tin vào Redis Stream để các Worker chia nhau xử lý
func (r *RedisBus) PublishInbound(ctx context.Context, pkt core.UnifiedPacket) error {
	raw, err := json.Marshal(pkt)
	if err != nil {
		return err
	}
	return r.client.XAdd(ctx, &redis.XAddArgs{
		Stream: r.inStream,
		MaxLen: 10000,
		Approx: true,
		Values: map[string]interface{}{"pkt": raw},
	}).Err()
}

// Worker đọc gói tin từ Redis Stream
func (r *RedisBus) ConsumeInbound(ctx context.Context, group, consumer string, handler func(core.UnifiedPacket)) {
	_ = r.client.XGroupCreateMkStream(ctx, r.inStream, group, "$").Err()

	for {
		select {
		case <-ctx.Done():
			return
		default:
			streams, err := r.client.XReadGroup(ctx, &redis.XReadGroupArgs{
				Group:    group,
				Consumer: consumer,
				Streams:  []string{r.inStream, ">"},
				Count:    50,
				Block:    500 * time.Millisecond,
			}).Result()

			if err != nil {
				continue
			}

			for _, s := range streams {
				for _, msg := range s.Messages {
					if str, ok := msg.Values["pkt"].(string); ok {
						var pkt core.UnifiedPacket
						if json.Unmarshal([]byte(str), &pkt) == nil {
							handler(pkt)
						}
					}
					r.client.XAck(ctx, r.inStream, group, msg.ID)
				}
			}
		}
	}
}

// Worker xử lý xong bắn ngược về Gateway qua Redis Pub/Sub để đạt độ trễ < 0.5ms
func (r *RedisBus) PublishOutbound(ctx context.Context, pkt core.UnifiedPacket) error {
	raw, err := json.Marshal(pkt)
	if err != nil {
		return err
	}
	return r.client.Publish(ctx, r.outChannel, raw).Err()
}

// Gateway lắng nghe kết quả từ Worker để phát ra Protocol đích (SSE, WS, MQTT...)
func (r *RedisBus) SubscribeOutbound(ctx context.Context, handler func(core.UnifiedPacket)) {
	sub := r.client.Subscribe(ctx, r.outChannel)
	ch := sub.Channel()
	go func() {
		defer sub.Close()
		for {
			select {
			case <-ctx.Done():
				return
			case msg := <-ch:
				var pkt core.UnifiedPacket
				if json.Unmarshal([]byte(msg.Payload), &pkt) == nil {
					handler(pkt)
				}
			}
		}
	}()
}
