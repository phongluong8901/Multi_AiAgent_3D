package ports

import (
	"context"
	"time"

	"go-distributed-llm/shared/models"
)

// JobQueue là cổng hàng đợi phân tán (mặc định cài đặt bằng Redis Streams, hỗ trợ priority, affinity, DLQ).
type JobQueue interface {
	PushJob(ctx context.Context, job models.JobPayload) error
	PullJobFromModels(ctx context.Context, group string, consumerID string, modelsList []string, blockDur time.Duration) (*models.JobPayload, error)
	AckJob(ctx context.Context, group string, streamName string, messageID string) error
	AutoClaimJobs(ctx context.Context, group string, consumerID string, modelsList []string, minIdle time.Duration, count int64) ([]models.JobPayload, error)
	GetQueueLength(ctx context.Context, model string) (int64, error)
	GetDLQLength(ctx context.Context) (int64, error)
}

// AffinityRebalancer cho phép dọn/chuyển job bị kẹt ở stream riêng của Worker vừa rớt mạng về lại stream chung của model.
type AffinityRebalancer interface {
	ReclaimStaleAffinityJobs(ctx context.Context, group string, activeWorkerIDs map[string]bool, minIdle time.Duration) (int, error)
}

