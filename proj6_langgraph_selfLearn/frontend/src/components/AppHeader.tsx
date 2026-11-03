import { Brain, RefreshCw } from 'lucide-react';

interface AppHeaderProps {
  status: string;
  sessionId: string;
  onNewSession: () => void;
}

export default function AppHeader({
  status,
  sessionId,
  onNewSession,
}: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-6 py-4">
      <div className="flex items-center gap-3">
        <Brain className="h-7 w-7 text-emerald-400" />
        <div>
          <h1 className="text-lg font-bold text-white">Self-Learning AI Agent</h1>
          <p className="text-xs text-slate-400">
            FastAPI • LangGraph • Qdrant • Redis • React TS
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-emerald-400">
          {status}
        </span>
        <button
          onClick={onNewSession}
          title="Tạo session mới để kiểm tra bộ nhớ dài hạn"
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs transition hover:bg-slate-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Session: {sessionId}
        </button>
      </div>
    </header>
  );
}
