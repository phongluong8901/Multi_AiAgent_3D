import { Brain, MessageSquare, Sparkles, RefreshCw } from 'lucide-react';

interface AppHeaderProps {
  status: string;
  sessionId: string;
  activeTab: 'chat' | 'synthesis';
  onTabChange: (tab: 'chat' | 'synthesis') => void;
  onNewSession: () => void;
}

export default function AppHeader({
  status,
  sessionId,
  activeTab,
  onTabChange,
  onNewSession,
}: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-6 py-3.5 shadow-md backdrop-blur">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <Brain className="h-7 w-7 text-emerald-400" />
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">Self-Learning Agent</h1>
            <p className="text-[11px] text-slate-400">
              LangGraph • Hybrid GraphRAG • Continual Learning
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/60 p-1">
          <button
            onClick={() => onTabChange('chat')}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === 'chat'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Trợ lý Hội thoại & Bộ nhớ
          </button>

          <button
            onClick={() => onTabChange('synthesis')}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === 'synthesis'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Knowledge Synthesis Engine
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
              Mới
            </span>
          </button>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <span className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs text-emerald-400 font-mono">
          {status}
        </span>
        <button
          onClick={onNewSession}
          title="Tạo session mới để kiểm tra bộ nhớ dài hạn Qdrant"
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-slate-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Session: {sessionId}
        </button>
      </div>
    </header>
  );
}
