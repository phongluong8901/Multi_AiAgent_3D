package ports

import (
	"context"

	"go-distributed-llm/internal/models"
)

// Repository là cổng lưu trữ bền vững lịch sử hội thoại và thống kê sử dụng (PostgreSQL).
type Repository interface {
	SaveMessage(ctx context.Context, msg models.Message) error
	GetHistory(ctx context.Context, conversationID string, limit int) ([]models.Message, error)
	LogUsage(ctx context.Context, usage models.UsageLog) error
}
