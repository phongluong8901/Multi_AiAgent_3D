package repositories

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"go-distributed-llm/shared/models"
	"go-distributed-llm/shared/ports"
)

// AsyncRepository bọc bên ngoài ports.Repository (VD: PostgreSQL) để đưa các thao tác ghi
// (SaveMessage, LogUsage) vào hàng đợi bất đồng bộ, tránh làm chậm TTFT hoặc chặn SSE response.
type AsyncRepository struct {
	inner ports.Repository
	queue chan func(context.Context)
	wg    sync.WaitGroup
	log   *slog.Logger
}

func NewAsyncRepository(inner ports.Repository, bufferSize int, log *slog.Logger) *AsyncRepository {
	if bufferSize <= 0 {
		bufferSize = 2048
	}
	a := &AsyncRepository{
		inner: inner,
		queue: make(chan func(context.Context), bufferSize),
		log:   log,
	}
	a.wg.Add(1)
	go a.workerLoop()
	return a
}

func (a *AsyncRepository) workerLoop() {
	defer a.wg.Done()
	for task := range a.queue {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		task(ctx)
		cancel()
	}
}

func (a *AsyncRepository) SaveMessage(ctx context.Context, msg models.Message) error {
	select {
	case a.queue <- func(writeCtx context.Context) {
		if err := a.inner.SaveMessage(writeCtx, msg); err != nil && a.log != nil {
			a.log.Warn("async SaveMessage failed", "job_id", msg.JobID, "err", err)
		}
	}:
		return nil
	default:
		// Nếu buffer đầy (tải cực cao), fallback ghi đồng bộ hoặc giữ an toàn dữ liệu.
		return a.inner.SaveMessage(ctx, msg)
	}
}

func (a *AsyncRepository) LogUsage(ctx context.Context, usage models.UsageLog) error {
	select {
	case a.queue <- func(writeCtx context.Context) {
		if err := a.inner.LogUsage(writeCtx, usage); err != nil && a.log != nil {
			a.log.Warn("async LogUsage failed", "job_id", usage.JobID, "err", err)
		}
	}:
		return nil
	default:
		return a.inner.LogUsage(ctx, usage)
	}
}

func (a *AsyncRepository) GetHistory(ctx context.Context, conversationID string, limit int) ([]models.Message, error) {
	return a.inner.GetHistory(ctx, conversationID, limit)
}

func (a *AsyncRepository) ListConversations(ctx context.Context, userID string, limit int) ([]models.Conversation, error) {
	return a.inner.ListConversations(ctx, userID, limit)
}

// Close đóng hàng đợi và chờ ghi nốt các bản ghi còn lại trước khi tắt Gateway.
func (a *AsyncRepository) Close() {
	close(a.queue)
	a.wg.Wait()
}

