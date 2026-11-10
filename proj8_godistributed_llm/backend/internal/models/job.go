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

// ChatTurn biểu thị 1 lượt hội thoại (system/user/assistant) truyền xuống LLM Engine
// để hỗ trợ ngữ cảnh đa lượt (Multi-turn Context).
type ChatTurn struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// JobPayload là gói dữ liệu được Gateway đẩy vào Redis Stream (jobs:model:<name>)
// để Worker Node kéo về xử lý.
type JobPayload struct {
	ID              string     `json:"id"`
	StreamMessageID string     `json:"stream_message_id"` // ID nội bộ của Redis Stream
	StreamName      string     `json:"stream_name"`       // Tên stream (VD: jobs:model:qwen2.5:1.5b)
	UserID          string     `json:"user_id"`
	ConversationID  string     `json:"conversation_id"`
	Model           string     `json:"model"`
	Prompt          string     `json:"prompt"`
	Messages        []ChatTurn `json:"messages,omitempty"` // Ngữ cảnh hội thoại gần nhất + prompt hiện tại
	ReplyToGrpcAddr string     `json:"reply_to_grpc_addr"` // IP:Port gRPC của Gateway giữ kết nối Client
	ReplyToHTTPAddr string     `json:"reply_to_http_addr"` // Base URL HTTP của Gateway (dự phòng khi không dùng gRPC)
	CreatedAt       time.Time  `json:"created_at"`
}

// TokenChunk đại diện cho một mảnh token (hoặc tín hiệu kết thúc/lỗi)
// chảy qua pipeline: LLM Engine -> Go Channel -> (gRPC hoặc HTTP Stream) -> SSE Hub -> Client.
type TokenChunk struct {
	JobID    string `json:"job_id"`
	WorkerID string `json:"worker_id"`
	Token    string `json:"token"`
	Done     bool   `json:"done"`
	Error    string `json:"error,omitempty"`
}
