import { X, Workflow, Server, LineChart, Activity, ShieldAlert, Sparkles } from 'lucide-react';
import { useWorkbenchStore } from '../../stores/useWorkbenchStore';

export function TabBar() {
    const { tabs, activeTabId, setActiveTab, closeTab } = useWorkbenchStore();

    return (
        <div className="h-9 bg-zinc-900 border-b border-zinc-800 flex items-center px-2 gap-1 overflow-x-auto select-none">
            {tabs.map((tab) => {
                const active = tab.id === activeTabId;
                return (
                    <div
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-md text-xs cursor-pointer border-t-2 transition-colors ${
                            active
                                ? 'bg-zinc-950 text-zinc-100 border-emerald-500'
                                : 'bg-zinc-900/50 text-zinc-400 border-transparent hover:bg-zinc-800/60 hover:text-zinc-200'
                        }`}
                    >
                        {tab.type === 'dashboard-metrics' ? (
                            <LineChart className="w-3.5 h-3.5 text-blue-400" />
                        ) : tab.type === 'process-chart' ? (
                            <Activity className="w-3.5 h-3.5 text-purple-400" />
                        ) : tab.type === 'workflow-canvas' || tab.type === 'n8n-canvas' ? (
                            <Workflow className="w-3.5 h-3.5 text-emerald-400" />
                        ) : tab.type === 'incident-log' ? (
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                        ) : tab.type === 'health-advisor' ? (
                            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        ) : (
                            <Server className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <span className="max-w-[160px] truncate">{tab.title}</span>
                        {tabs.length > 1 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeTab(tab.id);
                                }}
                                className="opacity-60 hover:opacity-100 hover:bg-zinc-700 rounded p-0.5"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
