package ports

import (
	"context"
	"time"

	"go-distributed-llm/internal/models"
)

// EventBus xử lý tín hiệu điều khiển real-time (Pub/Sub Cancel).
type EventBus interface {
	PublishCancel(ctx context.Context, jobID string) error
	SubscribeCancel(ctx context.Context, jobID string) <-chan struct{}
}

// NodeRegistry quản lý danh sách Worker đang hoạt động và trạng thái Drain trong cụm.
type NodeRegistry interface {
	UpdateHeartbeat(ctx context.Context, info models.WorkerNodeInfo, ttl time.Duration) error
	GetOnlineNodes(ctx context.Context) ([]models.WorkerNodeInfo, error)
	SetNodeDraining(ctx context.Context, workerID string, draining bool) error
	IsNodeDraining(ctx context.Context, workerID string) (bool, error)
}
