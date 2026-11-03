export interface ChatMessage {
  id: string;
  role: "user" | "ai" | "system";
  content: string;
  usedWebSearch?: boolean;
  timestamp: string;
}

export interface MemoryStats {
  total_knowledge_facts: number;
  total_experiences: number;
}

export interface LearnedMemoryItem {
  id: string;
  kind: 'knowledge' | 'experience';
  category: string;
  document: string;
  learned_at: string;
}

export interface AICoreChatResponse {
  answer: string;
  used_web_search: boolean;
  recalled_facts_count: number;
  reasoning_trace: string[];
  memory_stats: MemoryStats;
}
