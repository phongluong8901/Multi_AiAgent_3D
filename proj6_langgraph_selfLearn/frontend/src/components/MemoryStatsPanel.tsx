import { Database } from 'lucide-react';
import type { MemoryStats } from '../types';

interface MemoryStatsPanelProps {
  stats: MemoryStats;
  onRefresh: () => void;
}

export default function MemoryStatsPanel({
  stats,
  onRefresh,
}: MemoryStatsPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-sky-400">
          <Database className="h-4 w-4" />
          Bộ nhớ dài hạn (Qdrant)
        </h2>
        <button
          onClick={onRefresh}
          className="text-xs text-slate-400 hover:text-white"
        >
          Làm mới
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Tri thức (Semantic)" value={stats.total_knowledge_facts} />
        <StatCard label="Kinh nghiệm (Episodic)" value={stats.total_experiences} />
      </div>
    </section>
  );
}

interface StatCardProps {
  label: string;
  value: number;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950 p-4 text-center">
      <div className="text-3xl font-bold text-emerald-400">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{label}</div>
    </div>
  );
}
