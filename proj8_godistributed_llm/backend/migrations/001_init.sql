CREATE TABLE IF NOT EXISTS chat_messages (
	id TEXT PRIMARY KEY,
	conversation_id TEXT NOT NULL,
	job_id TEXT NOT NULL,
	role TEXT NOT NULL,
	model TEXT NOT NULL,
	content TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created
	ON chat_messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS usage_logs (
	job_id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	model TEXT NOT NULL,
	worker_id TEXT NOT NULL,
	token_count INT NOT NULL,
	duration_ms BIGINT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

