package redisrepo

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// rateLimitScript thực thi INCR + PEXPIRE nguyên tử trong Redis nhằm tránh race condition giữa nhiều Gateway.
var rateLimitScript = redis.NewScript(`
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return {current, ttl}
`)

// RedisRateLimiter cài đặt ports.RateLimiter đồng bộ trên toàn cụm Gateway thông qua Redis.
type RedisRateLimiter struct {
	client redis.UniversalClient
}

// NewRedisRateLimiter tạo bộ giới hạn tốc độ dùng chung qua Redis.
func NewRedisRateLimiter(client redis.UniversalClient) *RedisRateLimiter {
	return &RedisRateLimiter{client: client}
}

// Allow kiểm tra và tăng bộ đếm request cho clientKey trong cửa sổ window; trả về (allowed, retryAfterSec, err).
// Khi Redis lỗi (fail-open), vẫn cho phép đi qua để tránh gián đoạn dịch vụ đột ngột.
func (r *RedisRateLimiter) Allow(ctx context.Context, key string, limit int, window time.Duration) (bool, int, error) {
	if limit <= 0 {
		return true, 0, nil
	}

	redisKey := fmt.Sprintf("ratelimit:%s", key)
	res, err := rateLimitScript.Run(ctx, r.client, []string{redisKey}, window.Milliseconds()).Int64Slice()
	if err != nil {
		return true, 0, err
	}
	if len(res) < 2 {
		return true, 0, nil
	}

	count := res[0]
	ttlMs := res[1]
	if count > int64(limit) {
		retrySec := int((ttlMs + 999) / 1000)
		if retrySec < 1 {
			retrySec = 1
		}
		return false, retrySec, nil
	}
	return true, 0, nil
}

