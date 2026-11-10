package postgresrepo

import (
	"context"

	"go-distributed-llm/internal/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ChatRepository cài đặt ports.Repository sử dụng PostgreSQL (pgxpool).
type ChatRepository struct {
	pool *pgxpool.Pool
}

func NewChatRepository(pool *pgxpool.Pool) *ChatRepository {
	return &ChatRepository{pool: pool}
}

func (r *ChatRepository) SaveMessage(ctx context.Context, msg models.Message) error {
	const q = `
INSERT INTO chat_messages (id, conversation_id, job_id, role, model, content, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7)
`
	_, err := r.pool.Exec(ctx, q, msg.ID, msg.ConversationID, msg.JobID, msg.Role, msg.Model, msg.Content, msg.CreatedAt)
	return err
}

func (r *ChatRepository) GetHistory(ctx context.Context, conversationID string, limit int) ([]models.Message, error) {
	if limit <= 0 {
		limit = 50
	}
	const q = `
SELECT id, conversation_id, job_id, role, model, content, created_at
FROM chat_messages
WHERE conversation_id = $1
ORDER BY created_at ASC
LIMIT $2
`
	rows, err := r.pool.Query(ctx, q, conversationID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []models.Message
	for rows.Next() {
		var m models.Message
		if err := rows.Scan(&m.ID, &m.ConversationID, &m.JobID, &m.Role, &m.Model, &m.Content, &m.CreatedAt); err != nil {
			return nil, err
		}
		messages = append(messages, m)
	}
	return messages, rows.Err()
}

func (r *ChatRepository) LogUsage(ctx context.Context, usage models.UsageLog) error {
	const q = `
INSERT INTO usage_logs (job_id, user_id, model, worker_id, token_count, duration_ms, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (job_id) DO NOTHING
`
	_, err := r.pool.Exec(ctx, q, usage.JobID, usage.UserID, usage.Model, usage.WorkerID, usage.TokenCount, usage.DurationMs, usage.CreatedAt)
	return err
}

// NoopRepository cho phép chạy test nhanh Gateway với Redis + Ollama mà không bắt buộc bật PostgreSQL.
type NoopRepository struct{}

func NewNoopRepository() *NoopRepository {
	return &NoopRepository{}
}

func (n *NoopRepository) SaveMessage(_ context.Context, _ models.Message) error { return nil }
func (n *NoopRepository) GetHistory(_ context.Context, _ string, _ int) ([]models.Message, error) {
	return nil, nil
}
func (n *NoopRepository) LogUsage(_ context.Context, _ models.UsageLog) error { return nil }

