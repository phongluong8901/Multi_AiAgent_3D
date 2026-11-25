package models

import "time"

// User đại diện cho người dùng hệ thống gọi API Gateway.
type User struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	CreatedAt time.Time `json:"created_at"`
}

// Conversation nhóm các tin nhắn trong một phiên hội thoại.
type Conversation struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"created_at"`
}

// Message lưu nội dung hỏi/đáp giữa user và assistant trong PostgreSQL.
type Message struct {
	ID             string    `json:"id"`
	ConversationID string    `json:"conversation_id"`
	JobID          string    `json:"job_id"`
	Role           string    `json:"role"` // "system", "user", hoặc "assistant"
	Model          string    `json:"model"`
	Content        string    `json:"content"`
	CreatedAt      time.Time `json:"created_at"`
}

// UsageLog ghi nhận thống kê hiệu năng (TTFT, TPS), token accounting thật và trace_id cho từng job.
type UsageLog struct {
	JobID            string    `json:"job_id"`
	TraceID          string    `json:"trace_id,omitempty"`
	UserID           string    `json:"user_id"`
	Model            string    `json:"model"`
	WorkerID         string    `json:"worker_id"`
	PromptTokens     int       `json:"prompt_tokens"`
	CompletionTokens int       `json:"completion_tokens"`
	TokenCount       int       `json:"token_count"`
	TTFTMs           int64     `json:"ttft_ms"`
	DurationMs       int64     `json:"duration_ms"`
	TokensPerSec     float64   `json:"tokens_per_sec"`
	CreatedAt        time.Time `json:"created_at"`
}

