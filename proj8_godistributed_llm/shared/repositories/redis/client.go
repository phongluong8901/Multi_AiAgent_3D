package redisrepo

import (
	"context"
	"fmt"
	"strings"
	"sync"
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

// scanAllKeys quét toàn bộ key khớp pattern trên cả Standalone, Sentinel lẫn Redis Cluster (ForEachMaster).
func scanAllKeys(ctx context.Context, client redis.UniversalClient, pattern string, count int64) ([]string, error) {
	if cluster, ok := client.(*redis.ClusterClient); ok {
		var (
			mu   sync.Mutex
			seen = make(map[string]struct{})
			all  []string
		)
		err := cluster.ForEachMaster(ctx, func(mCtx context.Context, master *redis.Client) error {
			keys, err := scanSingleNode(mCtx, master, pattern, count)
			if err != nil {
				return err
			}
			mu.Lock()
			for _, k := range keys {
				if _, exists := seen[k]; !exists {
					seen[k] = struct{}{}
					all = append(all, k)
				}
			}
			mu.Unlock()
			return nil
		})
		return all, err
	}
	return scanSingleNode(ctx, client, pattern, count)
}

// scanSingleNode thực hiện vòng lặp SCAN cursor đến 0 trên một Redis node đơn lẻ.
func scanSingleNode(ctx context.Context, cmdable interface {
	Scan(ctx context.Context, cursor uint64, match string, count int64) *redis.ScanCmd
}, pattern string, count int64) ([]string, error) {
	var (
		cursor uint64
		keys   []string
	)
	for {
		batch, nextCursor, err := cmdable.Scan(ctx, cursor, pattern, count).Result()
		if err != nil {
			return nil, err
		}
		keys = append(keys, batch...)
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
	return keys, nil
}

