package redisrepo

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// NewRedisClient khởi tạo Redis UniversalClient (hỗ trợ Standalone, Sentinel khi có masterName,
// và Cluster khi truyền nhiều địa chỉ phân tách bằng dấu phẩy) rồi Ping kiểm tra kết nối ngay.
func NewRedisClient(addrsCSV string, masterName string, password string, db int) (redis.UniversalClient, error) {
	var addrs []string
	for _, raw := range strings.Split(addrsCSV, ",") {
		if trimmed := strings.TrimSpace(raw); trimmed != "" {
			addrs = append(addrs, trimmed)
		}
	}
	if len(addrs) == 0 {
		addrs = []string{"127.0.0.1:6379"}
	}

	rdb := redis.NewUniversalClient(&redis.UniversalOptions{
		Addrs:        addrs,
		MasterName:   strings.TrimSpace(masterName),
		Password:     password,
		DB:           db,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 5 * time.Second,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		_ = rdb.Close()
		return nil, fmt.Errorf("redis ping failed (%s): %w", strings.Join(addrs, ","), err)
	}
	return rdb, nil
}

