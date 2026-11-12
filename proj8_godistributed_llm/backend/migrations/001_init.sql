-- Bảng lưu toàn bộ lịch sử tin nhắn (system/user/assistant) phục vụ multi-turn context và sidebar chat.
CREATE TABLE IF NOT EXISTS chat_messages (
	id TEXT PRIMARY KEY,
	conversation_id TEXT NOT NULL,
	job_id TEXT NOT NULL,
	role TEXT NOT NULL,
	model TEXT NOT NULL,
	content TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index tổng hợp giúp truy vấn GetHistory lấy N tin nhắn mới nhất theo conversation_id nhanh chóng.
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created
	ON chat_messages (conversation_id, created_at);

-- Bảng ghi nhận hiệu năng (TTFT, Duration, TPS) và thống kê token sử dụng cho từng job hoàn tất.
CREATE TABLE IF NOT EXISTS usage_logs (
	job_id TEXT PRIMARY KEY,
	trace_id TEXT NOT NULL DEFAULT '',
	user_id TEXT NOT NULL,
	model TEXT NOT NULL,
	worker_id TEXT NOT NULL,
	prompt_tokens INT NOT NULL DEFAULT 0,
	completion_tokens INT NOT NULL DEFAULT 0,
	token_count INT NOT NULL,
	ttft_ms BIGINT NOT NULL DEFAULT 0,
	duration_ms BIGINT NOT NULL,
	tokens_per_sec DOUBLE PRECISION NOT NULL DEFAULT 0,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Đảm bảo tương thích ngược khi nâng cấp từ schema cũ chưa có các cột trace_id và token breakdown.
ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS trace_id TEXT NOT NULL DEFAULT '';
ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS prompt_tokens INT NOT NULL DEFAULT 0;
ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS completion_tokens INT NOT NULL DEFAULT 0;
ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS ttft_ms BIGINT NOT NULL DEFAULT 0;
ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS tokens_per_sec DOUBLE PRECISION NOT NULL DEFAULT 0;
