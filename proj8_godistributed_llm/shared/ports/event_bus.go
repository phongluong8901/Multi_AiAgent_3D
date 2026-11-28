package ports

import (
	"context"
	"time"

	"go-distributed-llm/shared/models"
)

// EventBus xử lý tín hiệu điều khiển real-time qua 1 kênh Pub/Sub tập trung.
type EventBus interface {
	PublishCancel(ctx context.Context, jobID string) error
	SubscribeCancelAll(ctx context.Context) (<-chan string, error)
}

// NodeRegistry quản lý danh sách Worker đang hoạt động và trạng thái Drain trong cụm.
type NodeRegistry interface {
	UpdateHeartbeat(ctx context.Context, info models.WorkerNodeInfo, ttl time.Duration) error
	GetOnlineNodes(ctx context.Context) ([]models.WorkerNodeInfo, error)
	SetNodeDraining(ctx context.Context, workerID string, draining bool) error
	IsNodeDraining(ctx context.Context, workerID string) (bool, error)
}

// RateLimiter kiểm soát lưu lượng request theo cửa sổ thời gian (Redis phân tán hoặc in-memory).
type RateLimiter interface {
	Allow(ctx context.Context, key string, limit int, window time.Duration) (allowed bool, retryAfterSec int, err error)
}

