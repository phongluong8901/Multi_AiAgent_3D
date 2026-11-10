export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model: string;
  jobId?: string;
  workerId?: string;
  error?: string;
  createdAt: number;
}

export interface StreamTokenEvent {
  job_id: string;
  conversation_id: string;
  worker_id: string;
  token: string;
  done: boolean;
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

