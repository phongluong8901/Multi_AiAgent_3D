package ports

import (
	"context"
	"time"

	"go-distributed-llm/internal/models"
)

// JobQueue là cổng hàng đợi phân tán (mặc định cài đặt bằng Redis Streams).
type JobQueue interface {
	PushJob(ctx context.Context, job models.JobPayload) error
	PullJobFromModels(ctx context.Context, group string, consumerID string, modelsList []string, blockDur time.Duration) (*models.JobPayload, error)
	AckJob(ctx context.Context, group string, streamName string, messageID string) error
	AutoClaimJobs(ctx context.Context, group string, consumerID string, modelsList []string, minIdle time.Duration, count int64) ([]models.JobPayload, error)
	GetQueueLength(ctx context.Context, model string) (int64, error)
}
