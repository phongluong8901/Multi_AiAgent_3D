/** Một tin nhắn hiển thị trong khung chat (bao gồm thông số TTFT, TPS và worker đã xử lý). */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model: string;
  jobId?: string;
  workerId?: string;
  ttftMs?: number;
  durationMs?: number;
  tokenCount?: number;
  tokensPerSec?: number;
  error?: string;
  createdAt: number;
}

/** Tóm tắt phiên hội thoại hiển thị ở danh sách Conversations bên trái. */
export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
}

/** Gói SSE event `message` trả về từ Gateway /api/v1/chat/stream. */
export interface StreamTokenEvent {
  job_id: string;
  conversation_id: string;
  worker_id: string;
  token: string;
  done: boolean;
  ttft_ms?: number;
  duration_ms?: number;
  token_count?: number;
  tokens_per_sec?: number;
}

/** Gói SSE event `error` trả về khi Worker/Gateway gặp sự cố hoặc quá thời gian chờ. */
export interface StreamErrorEvent {
  job_id: string;
  error: string;
}

/** Trạng thái telemetry của một Worker Node đọc từ /api/v1/admin/nodes. */
export interface WorkerNodeInfo {
  worker_id: string;
  supported_models: string[];
  max_slots: number;
  active_jobs: number;
  cpu_usage_percent: number;
  ram_usage_percent: number;
  gpu_vram_percent: number;
  status: string;
  last_heartbeat: number;
}

/** Phản hồi danh sách Worker Nodes đang online trong cụm. */
export interface NodesResponse {
  total_nodes: number;
  nodes: WorkerNodeInfo[];
}

/** Độ sâu hàng đợi hiện tại của từng model trả về từ /api/v1/admin/queues. */
export interface QueuesResponse {
  queues: Record<string, number>;
}
