package models

import "time"

// JobStatus biểu thị trạng thái vòng đời của một job suy luận LLM.
type JobStatus string

const (
	JobStatusQueued    JobStatus = "QUEUED"
	JobStatusRunning   JobStatus = "RUNNING"
	JobStatusCompleted JobStatus = "COMPLETED"
	JobStatusCanceled  JobStatus = "CANCELED"
	JobStatusFailed    JobStatus = "FAILED"
)

// ChatTurn biểu thị 1 lượt hội thoại (system/user/assistant) truyền xuống LLM Engine.
type ChatTurn struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// GenerationOptions chứa các tham số điều khiển sinh văn bản của LLM.
type GenerationOptions struct {
	Temperature *float64 `json:"temperature,omitempty"`
	MaxTokens   *int     `json:"max_tokens,omitempty"`
}

const (
	PriorityHigh   = "high"
	PriorityNormal = "normal"
	PriorityLow    = "low"
)

// JobPayload là gói dữ liệu được Gateway đẩy vào Redis Stream (jobs:model:<name>)
// để Worker Node kéo về xử lý.
type JobPayload struct {
	ID                string            `json:"id"`
	TraceID           string            `json:"trace_id,omitempty"`
	StreamMessageID   string            `json:"stream_message_id"`
	StreamName        string            `json:"stream_name"`
	UserID            string            `json:"user_id"`
	ConversationID    string            `json:"conversation_id"`
	Model             string            `json:"model"`
	Priority          string            `json:"priority,omitempty"`
	PreferredWorkerID string            `json:"preferred_worker_id,omitempty"`
	RetryCount        int               `json:"retry_count,omitempty"`
	Prompt            string            `json:"prompt"`
	Messages          []ChatTurn        `json:"messages,omitempty"`
	Options           GenerationOptions `json:"options,omitempty"`
	ReplyToGrpcAddr   string            `json:"reply_to_grpc_addr"`
	ReplyToHTTPAddr   string            `json:"reply_to_http_addr"`
	CreatedAt         time.Time         `json:"created_at"`
}

// TokenChunk đại diện cho một mảnh token (hoặc micro-batch) chảy qua pipeline tới Client.
type TokenChunk struct {
	JobID            string `json:"job_id"`
	WorkerID         string `json:"worker_id"`
	Token            string `json:"token"`
	Done             bool   `json:"done"`
	Error            string `json:"error,omitempty"`
	TokenUnits       int    `json:"token_units,omitempty"`
	PromptTokens     int    `json:"prompt_tokens,omitempty"`
	CompletionTokens int    `json:"completion_tokens,omitempty"`
}

