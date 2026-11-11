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

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
}

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

export interface StreamErrorEvent {
  job_id: string;
  error: string;
}

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

export interface NodesResponse {
  total_nodes: number;
  nodes: WorkerNodeInfo[];
}

export interface QueuesResponse {
  queues: Record<string, number>;
}
