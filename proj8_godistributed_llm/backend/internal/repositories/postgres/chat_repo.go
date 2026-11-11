package postgresrepo

import (
	"context"
	"sort"
	"strings"
	"sync"

	"go-distributed-llm/shared/models"

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

func (r *ChatRepository) ListConversations(ctx context.Context, _ string, limit int) ([]models.Conversation, error) {
	if limit <= 0 {
		limit = 30
	}
	const q = `
SELECT conversation_id,
       COALESCE((ARRAY_AGG(content ORDER BY created_at ASC) FILTER (WHERE role = 'user'))[1], conversation_id) AS title,
       MAX(created_at) AS last_at
FROM chat_messages
GROUP BY conversation_id
ORDER BY last_at DESC
LIMIT $1
`
	rows, err := r.pool.Query(ctx, q, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var convs []models.Conversation
	for rows.Next() {
		var c models.Conversation
		if err := rows.Scan(&c.ID, &c.Title, &c.CreatedAt); err != nil {
			return nil, err
		}
		c.Title = truncateTitle(c.Title)
		convs = append(convs, c)
	}
	return convs, rows.Err()
}

func (r *ChatRepository) LogUsage(ctx context.Context, usage models.UsageLog) error {
	const q = `
INSERT INTO usage_logs (job_id, trace_id, user_id, model, worker_id, prompt_tokens, completion_tokens, token_count, ttft_ms, duration_ms, tokens_per_sec, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
ON CONFLICT (job_id) DO NOTHING
`
	_, err := r.pool.Exec(ctx, q, usage.JobID, usage.TraceID, usage.UserID, usage.Model, usage.WorkerID, usage.PromptTokens, usage.CompletionTokens, usage.TokenCount, usage.TTFTMs, usage.DurationMs, usage.TokensPerSec, usage.CreatedAt)
	return err
}

// MemoryRepository lưu lịch sử chat trong RAM (thread-safe), giúp Multi-turn Context
// và Conversation Sidebar hoạt động đầy đủ ngay cả khi chưa bật PostgreSQL.
type MemoryRepository struct {
	mu       sync.RWMutex
	messages map[string][]models.Message
	usages   []models.UsageLog
}

func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{
		messages: make(map[string][]models.Message),
	}
}

func (m *MemoryRepository) SaveMessage(_ context.Context, msg models.Message) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.messages[msg.ConversationID] = append(m.messages[msg.ConversationID], msg)
	return nil
}

func (m *MemoryRepository) GetHistory(_ context.Context, conversationID string, limit int) ([]models.Message, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	list := m.messages[conversationID]
	if len(list) == 0 {
		return []models.Message{}, nil
	}
	if limit > 0 && len(list) > limit {
		list = list[len(list)-limit:]
	}
	out := make([]models.Message, len(list))
	copy(out, list)
	return out, nil
}

func (m *MemoryRepository) ListConversations(_ context.Context, _ string, limit int) ([]models.Conversation, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if limit <= 0 {
		limit = 30
	}
	convs := make([]models.Conversation, 0, len(m.messages))
	for convID, msgs := range m.messages {
		if len(msgs) == 0 {
			continue
		}
		title := convID
		for _, msg := range msgs {
			if msg.Role == "user" && strings.TrimSpace(msg.Content) != "" {
				title = msg.Content
				break
			}
		}
		lastAt := msgs[len(msgs)-1].CreatedAt
		convs = append(convs, models.Conversation{
			ID:        convID,
			Title:     truncateTitle(title),
			CreatedAt: lastAt,
		})
	}

	sort.Slice(convs, func(i, j int) bool {
		return convs[i].CreatedAt.After(convs[j].CreatedAt)
	})
	if len(convs) > limit {
		convs = convs[:limit]
	}
	return convs, nil
}

func (m *MemoryRepository) LogUsage(_ context.Context, usage models.UsageLog) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.usages = append(m.usages, usage)
	return nil
}

// NoopRepository bỏ qua toàn bộ thao tác lưu trữ (dùng khi không cần lưu lịch sử).
type NoopRepository struct{}

func NewNoopRepository() *NoopRepository {
	return &NoopRepository{}
}

func (n *NoopRepository) SaveMessage(_ context.Context, _ models.Message) error { return nil }
func (n *NoopRepository) GetHistory(_ context.Context, _ string, _ int) ([]models.Message, error) {
	return []models.Message{}, nil
}
func (n *NoopRepository) ListConversations(_ context.Context, _ string, _ int) ([]models.Conversation, error) {
	return []models.Conversation{}, nil
}
func (n *NoopRepository) LogUsage(_ context.Context, _ models.UsageLog) error { return nil }

func truncateTitle(s string) string {
	s = strings.TrimSpace(strings.ReplaceAll(s, "\n", " "))
	runes := []rune(s)
	if len(runes) > 48 {
		return string(runes[:45]) + "..."
	}
	return s
}
