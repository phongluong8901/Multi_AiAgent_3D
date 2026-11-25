/**
 * Deep Knowledge Synthesis Engine Dashboard Page.
 * Visualizes 5-tiered memory hierarchy (Raw Facts, Concept Bridges, Verified Laws, Negative Knowledge),
 * provides interactive controls to trigger LangGraph Multi-Hop Synthesis with Python Sandbox validation,
 * runs offline Sleep-Phase Discovery, and renders structured tables of discovered insights,
 * falsified hypotheses, and cross-domain relational graph triplets.
 */

import React, { useEffect, useState } from 'react';
import {
  Layers,
  Network,
  Cpu,
  Moon,
  Sparkles,
  RefreshCw,
  Search,
  Shuffle,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Compass,
  Database,
  FileCode,
  ShieldCheck,
  Terminal,
  Code2,
  ShieldAlert,
} from 'lucide-react';
import type {
  TieredMemoryStats,
  SynthesizedInsight,
  FalsifiedHypothesis,
  ConceptBridge,
  SynthesisResult,
  SleepPhaseResult,
} from '../types';

interface KnowledgeSynthesisPageProps {
  gatewayUrl: string;
}

export default function KnowledgeSynthesisPage({ gatewayUrl }: KnowledgeSynthesisPageProps) {
  // Tiered memory distribution counters
  const [tieredStats, setTieredStats] = useState<TieredMemoryStats>({
    tier_1_raw: 0,
    tier_2_bridge: 0,
    tier_3_synthesized: 0,
    tier_falsified: 0,
    falsified_hypotheses: 0,
    total_active: 0,
    status: 'Đang tải...',
  });
  const [isStatsLoading, setIsStatsLoading] = useState(false);

  // Multi-hop state
  const [queryInput, setQueryInput] = useState(
    'Làm thế nào kết hợp cơ chế Zero-Copy Buffer với kiến trúc Event-Driven để giảm thiểu Context Switch?'
  );
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisResult, setSynthesisResult] = useState<SynthesisResult | null>(null);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);

  // Sleep phase state
  const [isSleepRunning, setIsSleepRunning] = useState(false);
  const [sleepResult, setSleepResult] = useState<SleepPhaseResult | null>(null);
  const [sleepError, setSleepError] = useState<string | null>(null);

  // Tables state
  const [activeTab, setActiveTab] = useState<'insights' | 'falsified' | 'bridges'>('insights');
  const [insights, setInsights] = useState<SynthesizedInsight[]>([]);
  const [falsified, setFalsified] = useState<FalsifiedHypothesis[]>([]);
  const [bridges, setBridges] = useState<ConceptBridge[]>([]);
  const [isTableLoading, setIsTableLoading] = useState(false);

  /**
   * Fetches tiered count breakdown across memory hierarchy.
   */
  const fetchTieredStats = async () => {
    setIsStatsLoading(true);
    try {
      const res = await fetch(`${gatewayUrl}/api/synthesis/tiered-stats`);
      if (res.ok) {
        const data = await res.json();
        setTieredStats(data);
      }
    } catch (err) {
      console.error('Fetch tiered stats failed:', err);
    } finally {
      setIsStatsLoading(false);
    }
  };

  /**
   * Fetches verified Tier 3 synthesized knowledge insights.
   */
  const fetchInsights = async () => {
    setIsTableLoading(true);
    try {
      const res = await fetch(`${gatewayUrl}/api/synthesis/insights?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setInsights(data.insights || []);
      }
    } catch (err) {
      console.error('Fetch insights failed:', err);
    } finally {
      setIsTableLoading(false);
    }
  };

  /**
   * Fetches refuted negative knowledge hypotheses from Qdrant.
   */
  const fetchFalsified = async () => {
    setIsTableLoading(true);
    try {
      const res = await fetch(`${gatewayUrl}/api/synthesis/falsified?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setFalsified(data.falsified || []);
      }
    } catch (err) {
      console.error('Fetch falsified hypotheses failed:', err);
    } finally {
      setIsTableLoading(false);
    }
  };

  /**
   * Fetches active Tier 2 relational concept bridges.
   */
  const fetchBridges = async () => {
    setIsTableLoading(true);
    try {
      const res = await fetch(`${gatewayUrl}/api/synthesis/bridges?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setBridges(data.bridges || []);
      }
    } catch (err) {
      console.error('Fetch bridges failed:', err);
    } finally {
      setIsTableLoading(false);
    }
  };

  /**
   * Refreshes all statistics and data tables in parallel.
   */
  const refreshAll = () => {
    fetchTieredStats();
    fetchInsights();
    fetchFalsified();
    fetchBridges();
  };

  useEffect(() => {
    refreshAll();
  }, [gatewayUrl]);

  /**
   * Triggers LangGraph multi-hop reasoning and empirical sandbox simulation.
   */
  const handleRunMultiHop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryInput.trim() || isSynthesizing) return;

    setIsSynthesizing(true);
    setSynthesisError(null);
    setSynthesisResult(null);

    try {
      const res = await fetch(`${gatewayUrl}/api/synthesis/run-multihop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryInput.trim() }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${res.status}`);
      }
      const data: SynthesisResult = await res.json();
      setSynthesisResult(data);
      refreshAll();
    } catch (err: any) {
      setSynthesisError(err.message || 'Lỗi khi thực thi suy luận đa chặng.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  /**
   * Triggers offline sleep-phase consolidation across stored memories.
   */
  const handleRunSleepPhase = async () => {
    if (isSleepRunning) return;
    setIsSleepRunning(true);
    setSleepError(null);
    setSleepResult(null);

    try {
      const res = await fetch(`${gatewayUrl}/api/synthesis/sleep-phase-discovery`, {
        method: 'POST',
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${res.status}`);
      }
      const data: SleepPhaseResult = await res.json();
      setSleepResult(data);
      refreshAll();
    } catch (err: any) {
      setSleepError(err.message || 'Lỗi khi kích hoạt giấc mơ AI.');
    } finally {
      setIsSleepRunning(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6 text-slate-100">
      {/* Page Title & Mission */}
      <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Knowledge Synthesis Engine & Sandbox Verifier
              </h1>
              <p className="text-xs text-slate-400">
                Vượt trội hơn RAG thuần: Hybrid GraphRAG • Multi-Hop Reasoning • Sandbox Code Verifier • Negative Knowledge (Học từ thất bại)
              </p>
            </div>
          </div>
          <button
            onClick={refreshAll}
            disabled={isStatsLoading}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isStatsLoading ? 'animate-spin' : ''}`} />
            Làm mới dữ liệu
          </button>
        </div>
      </div>

      {/* 5 Tiered Memory Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tier 1: Raw Facts</span>
            <Database className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-sky-400">{tieredStats.tier_1_raw}</div>
          <p className="mt-1 text-xs text-slate-400">Đoạn văn gốc & Dữ liệu thực tế</p>
        </div>

        <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tier 2: Bridges</span>
            <Network className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-400">{tieredStats.tier_2_bridge}</div>
          <p className="mt-1 text-xs text-slate-400">Bộ ba thực thể [A -&gt; Y -&gt; B]</p>
        </div>

        <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tier 3: Verified Laws</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400">{tieredStats.tier_3_synthesized}</div>
          <p className="mt-1 text-xs text-slate-400">Đã qua Sandbox kiểm nghiệm</p>
        </div>

        <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Negative Memory</span>
            <ShieldAlert className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-400">
            {tieredStats.falsified_hypotheses ?? tieredStats.tier_falsified ?? 0}
          </div>
          <p className="mt-1 text-xs text-slate-400">Giả thuyết bác bỏ (Học từ sai)</p>
        </div>

        <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tổng Vector Khả dụng</span>
            <ShieldCheck className="h-4 w-4 text-violet-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-violet-400">{tieredStats.total_active}</div>
          <p className="mt-1 text-xs text-slate-400">Toàn bộ tri thức có căn cứ</p>
        </div>
      </div>

      {/* Main Execution Panels: Multi-Hop Reasoning & Sleep Phase Discovery */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Multi-Hop Query Execution (7 cols) */}
        <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5 lg:col-span-7">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Compass className="h-5 w-5 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">Agentic Multi-Hop Reasoning & Sandbox Verification</h2>
          </div>
          <p className="text-xs leading-relaxed text-slate-300">
            Quy trình khép kín: Phân rã bài toán -&gt; Truy vấn đuổi các tầng -&gt; Tổng hợp biện chứng -&gt; <strong>Chạy thực nghiệm trong Sandbox</strong> -&gt; Ghi nhận vào Tier 3 (nếu đúng) hoặc Negative Knowledge Memory (nếu sai).
          </p>

          <form onSubmit={handleRunMultiHop} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-slate-500">Gợi ý bài toán:</span>
                {[
                  {
                    label: 'gRPC + GPU Zero-Copy',
                    text: 'Làm thế nào kết hợp cơ chế Zero-Copy Buffer của gRPC với Page-Locked Memory trên GPU để tối ưu thông lượng dữ liệu?',
                  },
                  {
                    label: 'Postgres WAL + LSM-Tree',
                    text: 'Mối liên hệ giữa cơ chế Write-Ahead Logging (WAL) của PostgreSQL và cấu trúc LSM-Tree trong việc chống suy giảm hiệu năng ghi?',
                  },
                  {
                    label: 'Distributed Lock + Raft',
                    text: 'Làm sao kết hợp Redis Distributed Lock với thuật toán đồng thuận Raft để ngăn chặn hiện tượng Split-Brain?',
                  },
                ].map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setQueryInput(s.text)}
                    className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 border border-slate-700 hover:bg-emerald-600/30 hover:text-emerald-200 transition"
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  const samples = [
                    'Làm thế nào kết hợp cơ chế Zero-Copy Buffer của gRPC với Page-Locked Memory trên GPU để tối ưu thông lượng dữ liệu?',
                    'Mối liên hệ giữa cơ chế Write-Ahead Logging (WAL) của PostgreSQL và cấu trúc LSM-Tree trong việc chống suy giảm hiệu năng ghi?',
                    'Làm sao kết hợp Redis Distributed Lock với thuật toán đồng thuận Raft để ngăn chặn hiện tượng Split-Brain?',
                    'Chiến lược tối ưu hóa Garbage Collection trong Go và JVM khi xử lý hàng triệu kết nối WebSocket đồng thời?',
                    'Làm thế nào áp dụng định lý CAP và cơ chế CRDTs để xây dựng hệ thống cơ sở dữ liệu Multi-Region có độ trễ cực thấp?',
                  ];
                  setQueryInput(samples[Math.floor(Math.random() * samples.length)]);
                }}
                className="flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400 hover:text-white transition"
              >
                <Shuffle className="h-2.5 w-2.5" />
                Random bài toán
              </button>
            </div>

            <textarea
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              rows={3}
              placeholder="Nhập vấn đề phức tạp cần suy luận bắc cầu và kiểm nghiệm thực tế..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSynthesizing || !queryInput.trim()}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {isSynthesizing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Đang thực thi 5 chặng LangGraph + Sandbox...
                  </>
                ) : (
                  <>
                    <Cpu className="h-3.5 w-3.5" />
                    Bắt đầu Tổng hợp & Kiểm nghiệm Sandbox
                  </>
                )}
              </button>
            </div>
          </form>

          {synthesisError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{synthesisError}</span>
            </div>
          )}

          {synthesisResult && (
            <div className="flex flex-col gap-4 rounded-lg border border-slate-800 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Kết quả Chu trình Nhận thức & Thực nghiệm</span>
                {synthesisResult.sandbox_verification?.is_experiment_verified ? (
                  <span className="flex items-center gap-1 rounded bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    [VERIFIED] Đã lưu vào Tier 3
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-400 border border-rose-500/20">
                    <XCircle className="h-3.5 w-3.5" />
                    [FALSIFIED] Đã lưu vào Negative Memory
                  </span>
                )}
              </div>

              {/* Reasoning Trace Steps */}
              {synthesisResult.reasoning_steps && synthesisResult.reasoning_steps.length > 0 && (
                <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                  <span className="text-[11px] font-semibold text-slate-400">Dấu vết Suy luận qua các Chặng (Trace):</span>
                  <ul className="flex flex-col gap-1 text-[11px] text-slate-300">
                    {synthesisResult.reasoning_steps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 font-mono">
                        <ArrowRight className="h-3 w-3 mt-0.5 text-emerald-400 shrink-0" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Sub Questions & Hypotheses */}
              {((synthesisResult.initial_hypotheses && synthesisResult.initial_hypotheses.length > 0) || (synthesisResult as any).initial_hypothesis) && (
                <div className="flex flex-col gap-1.5 text-xs">
                  <span className="font-semibold text-slate-300">Giả thuyết Ban đầu:</span>
                  <ul className="list-disc pl-4 text-slate-400">
                    {(synthesisResult.initial_hypotheses || [(synthesisResult as any).initial_hypothesis])
                      .filter(Boolean)
                      .map((hypo, idx) => (
                        <li key={idx}>{hypo}</li>
                      ))}
                  </ul>
                </div>
              )}

              {/* Synthesized Output */}
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3.5">
                <div className="text-xs font-semibold text-emerald-300 mb-1">Luận điểm & Định luật Kết tinh:</div>
                <div className="whitespace-pre-wrap text-xs leading-relaxed text-slate-200">
                  {synthesisResult.synthesized_insight || (synthesisResult as any).new_law_or_insight || 'Đã đúc kết thành công phát hiện mới.'}
                </div>
              </div>

              {/* Sandbox Code / Simulation Verification Display */}
              {synthesisResult.sandbox_verification && (
                <div className="flex flex-col gap-2.5 rounded-lg border border-slate-800 bg-slate-900/80 p-3.5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                      <Terminal className="h-4 w-4 text-sky-400" />
                      <span>Sandbox Code & Simulation Verifier</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Thời gian chạy: {synthesisResult.sandbox_verification.execution_time_ms}ms
                    </span>
                  </div>

                  {/* Verification Code Block */}
                  {synthesisResult.sandbox_verification.verification_code && (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <Code2 className="h-3.5 w-3.5 text-amber-400" />
                        <span>Mã Python Benchmark & Kiểm nghiệm Tự động:</span>
                      </div>
                      <pre className="max-h-36 overflow-x-auto rounded bg-slate-950 p-2.5 font-mono text-[11px] text-slate-300 border border-slate-800">
                        <code>{synthesisResult.sandbox_verification.verification_code}</code>
                      </pre>
                    </div>
                  )}

                  {/* Terminal Execution Output */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-slate-400">Kết quả Thực thi (Stdout / Stderr):</span>
                    <div className="rounded bg-black/90 p-2.5 font-mono text-[11px] border border-slate-800">
                      {synthesisResult.sandbox_verification.simulation_stdout && (
                        <div className="text-emerald-400 whitespace-pre-wrap">
                          {synthesisResult.sandbox_verification.simulation_stdout}
                        </div>
                      )}
                      {synthesisResult.sandbox_verification.simulation_stderr && (
                        <div className="text-rose-400 whitespace-pre-wrap mt-1">
                          {synthesisResult.sandbox_verification.simulation_stderr}
                        </div>
                      )}
                      {synthesisResult.sandbox_verification.falsified_reason && (
                        <div className="text-rose-300 text-[10px] mt-1 border-t border-rose-500/20 pt-1">
                          Lý do bác bỏ: {synthesisResult.sandbox_verification.falsified_reason}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Sleep Phase Discovery (5 cols) */}
        <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5 lg:col-span-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Moon className="h-5 w-5 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Giấc mơ AI (Sleep Phase Discovery)</h2>
          </div>
          <p className="text-xs leading-relaxed text-slate-300">
            Cơ chế gom cụm khi hệ thống nghỉ: Tự động ghép nối các mảnh tri thức có khoảng cách ngữ nghĩa tương đồng vừa phải (Cosine Similarity 0.55 - 0.78), tìm điểm giao cắt ẩn, suy luận thoái quy (Abductive Synthesis) và dùng Critic Agent kiểm chứng để sinh định luật mới.
          </p>

          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Trạng thái Tiến trình Ngầm:</span>
              <span className="text-emerald-400 font-mono font-medium">Sẵn sàng kích hoạt</span>
            </div>
            <button
              onClick={handleRunSleepPhase}
              disabled={isSleepRunning}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {isSleepRunning ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Đang quét cụm & suy luận giấc mơ...
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5" />
                  Kích hoạt Giấc mơ AI ngay lập tức
                </>
              )}
            </button>
          </div>

          {sleepError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{sleepError}</span>
            </div>
          )}

          {sleepResult && (
            <div className="flex flex-col gap-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300">Kết quả Đợt Gom Cụm Giấc Mơ</span>
                <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] text-indigo-300 border border-indigo-500/30">
                  {sleepResult.discovered_insights_count ?? (sleepResult as any).discovered_count ?? 0} phát hiện mới
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {(sleepResult.discovered_insights_count ?? (sleepResult as any).discovered_count ?? 0) > 0
                  ? `Đã phát hiện và ghi nhận ${sleepResult.discovered_insights_count ?? (sleepResult as any).discovered_count} tri thức mới vào Qdrant Tier 3 sau khi vượt qua bài kiểm chứng của Critic Agent.`
                  : (sleepResult as any).message || 'Không có cặp tri thức nào trong khoảng tương đồng đạt ngưỡng kiểm chứng mới ở chu kỳ này.'}
              </p>
              {sleepResult.details && sleepResult.details.length > 0 && (
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {sleepResult.details.map((item, idx) => (
                    <div key={idx} className="rounded border border-indigo-500/20 bg-slate-950 p-2.5 text-xs">
                      <div className="font-semibold text-emerald-400">{item.new_law || item.insight}</div>
                      <div className="text-slate-400 text-[11px] mt-1">{item.core_thesis || item.insight}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tri thức Phân tầng Data Tables: Tab 1, Tab 2, Tab 3 */}
      <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('insights')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === 'insights'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Tier 3: Tri thức Đã Kiểm nghiệm ({insights.length})
            </button>

            <button
              onClick={() => setActiveTab('falsified')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === 'falsified'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Negative Memory: Giả thuyết Bác bỏ ({falsified.length})
              <span className="rounded bg-rose-500/20 px-1.5 py-0.2 text-[10px] text-rose-200 border border-rose-500/30">
                Học từ thất bại
              </span>
            </button>

            <button
              onClick={() => setActiveTab('bridges')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === 'bridges'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Network className="h-3.5 w-3.5" />
              Tier 2: Cầu nối Khái niệm Đồ thị ({bridges.length})
            </button>
          </div>

          <button
            onClick={() => {
              if (activeTab === 'insights') fetchInsights();
              else if (activeTab === 'falsified') fetchFalsified();
              else fetchBridges();
            }}
            disabled={isTableLoading}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
          >
            <RefreshCw className={`h-3 w-3 ${isTableLoading ? 'animate-spin' : ''}`} />
            Tải lại bảng
          </button>
        </div>

        {/* Content of Tab 1: Synthesized Insights (Tier 3) */}
        {activeTab === 'insights' && (
          <div className="mt-4 overflow-x-auto">
            {insights.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Chưa có tri thức Tier 3 nào được tổng hợp. Hãy thực thi Multi-Hop Reasoning hoặc chạy Giấc mơ AI phía trên.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2.5 px-3">Định luật Mới (New Law)</th>
                    <th className="py-2.5 px-3">Luận điểm Cốt lõi & Chuỗi Nhân quả</th>
                    <th className="py-2.5 px-3">Bằng chứng Sandbox</th>
                    <th className="py-2.5 px-3">Độ tin cậy</th>
                    <th className="py-2.5 px-3">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {insights.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-3 font-medium text-emerald-400 align-top max-w-xs">
                        {item.new_law || (item as any).topic || (item as any).document?.substring(0, 80) || 'Định luật kết hợp mới'}
                      </td>
                      <td className="py-3 px-3 text-slate-300 align-top max-w-md">
                        <p>{item.core_thesis || (item as any).document || ''}</p>
                        {item.causal_chain && item.causal_chain.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {item.causal_chain.map((c, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 border border-slate-700"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-400 align-top max-w-xs text-[11px]">
                        {item.benchmark_output ? (
                          <div className="rounded bg-slate-950 p-1.5 font-mono text-[10px] text-emerald-300 border border-slate-800">
                            {item.benchmark_output.substring(0, 100)}
                          </div>
                        ) : (
                          item.contradiction_resolved || 'Kiểm nghiệm logic thành công'
                        )}
                      </td>
                      <td className="py-3 px-3 align-top">
                        <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-mono text-emerald-400 border border-emerald-500/20">
                          {(() => {
                            const raw = item.confidence_score;
                            const num = typeof raw === 'number' && !isNaN(raw) ? (raw <= 1 ? raw * 100 : raw) : 85;
                            return `${num.toFixed(0)}%`;
                          })()}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 align-top whitespace-nowrap text-[11px]">
                        {item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Content of Tab 2: Falsified Hypotheses (Negative Knowledge Memory) */}
        {activeTab === 'falsified' && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-300">
              <span className="font-semibold text-rose-200">Kho tàng Tri thức về những Cái Sai (Negative Knowledge): </span>
              Lưu trữ lại các giả thuyết không vượt qua được bài kiểm nghiệm thực tế trong Sandbox hoặc mô phỏng logic sai lệch. AI tham chiếu kho tàng này để <strong>không bao giờ lặp lại vết xe đổ</strong> trong tương lai.
            </div>

            {falsified.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Chưa có giả thuyết nào bị bác bỏ. Khi một bài toán kiểm nghiệm trong Sandbox bị lỗi assert hoặc đo đạc sai lệch, hệ thống sẽ lưu vào đây.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2.5 px-3">Giả thuyết Bị Bác Bỏ</th>
                      <th className="py-2.5 px-3">Lý do Thất Bại / Lỗi Đo Đạc</th>
                      <th className="py-2.5 px-3">Mã Kiểm Nghiệm Thất Bại</th>
                      <th className="py-2.5 px-3">Kết quả Terminal</th>
                      <th className="py-2.5 px-3">Thời gian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {falsified.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-3 font-medium text-rose-300 align-top max-w-xs">
                          {item.hypothesis}
                        </td>
                        <td className="py-3 px-3 text-slate-300 align-top max-w-sm">
                          <span className="rounded bg-rose-500/10 px-2 py-0.5 text-[11px] font-mono text-rose-400 border border-rose-500/20">
                            {item.falsified_reason}
                          </span>
                        </td>
                        <td className="py-3 px-3 align-top max-w-xs">
                          {item.failed_code ? (
                            <pre className="max-h-24 overflow-x-auto rounded bg-slate-950 p-1.5 font-mono text-[10px] text-slate-300 border border-slate-800">
                              <code>{item.failed_code}</code>
                            </pre>
                          ) : (
                            <span className="text-slate-500 text-[10px]">N/A</span>
                          )}
                        </td>
                        <td className="py-3 px-3 align-top max-w-xs">
                          <div className="rounded bg-black/80 p-1.5 font-mono text-[10px] text-rose-300 border border-slate-800 whitespace-pre-wrap max-h-24 overflow-y-auto">
                            {item.execution_output || 'Lỗi thực thi'}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-500 align-top whitespace-nowrap text-[11px]">
                          {item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Content of Tab 3: Concept Bridges (Tier 2) */}
        {activeTab === 'bridges' && (
          <div className="mt-4 overflow-x-auto">
            {bridges.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Chưa có bộ ba quan hệ Tier 2 nào. Khi hệ thống phân tích các đoạn văn, các bộ ba quan hệ sẽ xuất hiện ở đây.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2.5 px-3">Thực thể A</th>
                    <th className="py-2.5 px-3">Mối quan hệ (Relation)</th>
                    <th className="py-2.5 px-3">Thực thể B</th>
                    <th className="py-2.5 px-3">Điểm cầu nối (Bridge Node)</th>
                    <th className="py-2.5 px-3">Độ tin cậy</th>
                    <th className="py-2.5 px-3">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {bridges.map((bridge) => (
                    <tr key={bridge.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-3 font-semibold text-amber-300 align-top">
                        {bridge.entity_a}
                      </td>
                      <td className="py-3 px-3 text-slate-300 align-top">
                        <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-300 border border-slate-700">
                          {bridge.relation}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-sky-300 align-top">
                        {bridge.entity_b}
                      </td>
                      <td className="py-3 px-3 text-slate-400 align-top text-[11px]">
                        {bridge.bridge_node || 'Trực tiếp'}
                      </td>
                      <td className="py-3 px-3 align-top">
                        <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-mono text-amber-400 border border-amber-500/20">
                          {(() => {
                            const raw = bridge.confidence;
                            const num = typeof raw === 'number' && !isNaN(raw) ? (raw <= 1 ? raw * 100 : raw) : 90;
                            return `${num.toFixed(0)}%`;
                          })()}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 align-top whitespace-nowrap text-[11px]">
                        {bridge.created_at ? new Date(bridge.created_at).toLocaleString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
