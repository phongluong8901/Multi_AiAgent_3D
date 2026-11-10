/**
 * Frontend Type Definitions for Cognitive Self-Learning AI Agent Dashboard.
 * Includes data models for interactive chat, memory statistics, multi-tier knowledge,
 * conceptual bridges, synthesized insights, and empirical sandbox verifications.
 */

/**
 * Chat message representation in the user chat feed.
 */
export interface ChatMessage {
  id: string;
  role: "user" | "ai" | "system";
  content: string;
  usedWebSearch?: boolean;
  timestamp: string;
}

/**
 * Basic memory counters for active knowledge facts and experiences.
 */
export interface MemoryStats {
  total_knowledge_facts: number;
  total_experiences: number;
}

/**
 * Learned memory record shown in the knowledge feed.
 */
export interface LearnedMemoryItem {
  id: string;
  kind: 'knowledge' | 'experience';
  category: string;
  document: string;
  learned_at: string;
}

/**
 * Response payload delivered by the cognitive agent loop.
 */
export interface AICoreChatResponse {
  answer: string;
  used_web_search: boolean;
  recalled_facts_count: number;
  reasoning_trace: string[];
  memory_stats: MemoryStats;
}

/**
 * Tiered statistics broken down by memory depth.
 */
export interface TieredMemoryStats {
  tier_1_raw: number;
  tier_2_bridge: number;
  tier_3_synthesized: number;
  tier_falsified?: number;
  falsified_hypotheses?: number;
  total_active: number;
  status: string;
}

/**
 * Synthesized insight derived from multi-hop reasoning and verified by sandbox code.
 */
export interface SynthesizedInsight {
  id: string;
  new_law: string;
  core_thesis: string;
  causal_chain: string[];
  contradiction_resolved?: string;
  source_nodes?: string[];
  verification_code?: string;
  benchmark_output?: string;
  confidence_score: number;
  status: string;
  created_at: string;
}

/**
 * Refuted hypothesis recorded in Negative Knowledge Memory.
 */
export interface FalsifiedHypothesis {
  id: string;
  hypothesis: string;
  topic: string;
  falsified_reason: string;
  failed_code: string;
  execution_output: string;
  created_at: string;
}

/**
 * Conceptual relational bridge connecting disparate knowledge domains.
 */
export interface ConceptBridge {
  id: string;
  entity_a: string;
  relation: string;
  entity_b: string;
  domain_a?: string;
  domain_b?: string;
  bridge_node?: string;
  confidence: number;
  created_at: string;
}

/**
 * Empirical sandbox execution logs and status.
 */
export interface SandboxVerification {
  verification_code: string;
  simulation_stdout: string;
  simulation_stderr: string;
  is_experiment_verified: boolean;
  falsified_reason: string;
  execution_time_ms: number;
}

/**
 * Result data structure returned by the multi-hop synthesis workflow.
 */
export interface SynthesisResult {
  complex_query: string;
  sub_questions: string[];
  initial_hypotheses: string[];
  explored_evidence: any[];
  bridge_concepts: any[];
  contradictions_found?: string[];
  synthesized_insight: string;
  reasoning_steps: string[];
  sandbox_verification?: SandboxVerification;
  status: string;
}

/**
 * Offline sleep-phase memory consolidation result summary.
 */
export interface SleepPhaseResult {
  status: string;
  discovered_insights_count: number;
  details: any[];
}

