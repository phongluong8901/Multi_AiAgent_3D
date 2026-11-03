import { Terminal } from 'lucide-react';

interface ReasoningTracePanelProps {
  traces: string[];
}

export default function ReasoningTracePanel({
  traces,
}: ReasoningTracePanelProps) {
  return (
    <section className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-purple-400">
        <Terminal className="h-4 w-4" />
        LangGraph Reasoning Trace
      </h2>
      <div className="flex-1 space-y-2.5 overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950 p-3 font-mono text-xs text-slate-300">
        {traces.length === 0 ? (
          <div className="text-slate-600">Chưa có luồng suy luận nào...</div>
        ) : (
          traces.map((trace, index) => (
            <div
              key={`${index}-${trace}`}
              className="border-b border-slate-900 pb-2 leading-relaxed last:border-none"
            >
              {trace}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
