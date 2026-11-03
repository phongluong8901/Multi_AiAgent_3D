export interface UserMessagePayload {
  sessionId: string;
  message: string;
}

export interface MemoryStats {
  total_knowledge_facts: number;
  total_experiences: number;
}

export interface AICoreChatResponse {
  answer: string;
  used_web_search: boolean;
  recalled_facts_count: number;
  reasoning_trace: string[];
  memory_stats: MemoryStats;
}

export interface ServerToClientEvents {
  agent_status: (data: { status: string }) => void;
  agent_response: (data: AICoreChatResponse) => void;
  agent_error: (data: { error: string }) => void;
  autonomous_learned: (data: { topic: string; summary: string }) => void;
  memory_updated: (data: { stats: MemoryStats; items: any[] }) => void;
}

export interface ClientToServerEvents {
  user_message: (payload: UserMessagePayload) => void;
  trigger_learn_now: (payload: { topic: string }) => void;
}
