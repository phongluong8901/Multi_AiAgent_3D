/**
 * Type definitions for Gateway Service communication protocols,
 * WebSocket events, and AI Core Service payloads.
 */

/**
 * Incoming chat message payload received from frontend clients.
 */
export interface UserMessagePayload {
  sessionId: string;
  message: string;
}

/**
 * Summary metrics of active long-term memories stored in Qdrant.
 */
export interface MemoryStats {
  total_knowledge_facts: number;
  total_experiences: number;
}

/**
 * Chat response payload emitted by AI Core Service LangGraph pipeline.
 */
export interface AICoreChatResponse {
  answer: string;
  used_web_search: boolean;
  recalled_facts_count: number;
  reasoning_trace: string[];
  memory_stats: MemoryStats;
}

/**
 * Socket.IO events dispatched from Gateway server to connected client dashboards.
 */
export interface ServerToClientEvents {
  agent_status: (data: { status: string }) => void;
  agent_response: (data: AICoreChatResponse) => void;
  agent_error: (data: { error: string }) => void;
  autonomous_learned: (data: { topic: string; summary: string }) => void;
  memory_updated: (data: { stats: MemoryStats; items: any[] }) => void;
}

/**
 * Socket.IO events accepted by Gateway server from client dashboards.
 */
export interface ClientToServerEvents {
  user_message: (payload: UserMessagePayload) => void;
  trigger_learn_now: (payload: { topic: string }) => void;
}

