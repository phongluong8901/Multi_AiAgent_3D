import { Server, Layers, HardDrive, Activity, ShieldAlert, Sparkles, Globe } from 'lucide-react';
import { useTelemetryStore } from '../../stores/useTelemetryStore';
import { useWorkbenchStore } from '../../stores/useWorkbenchStore';
import { Sparkline } from '../common/Sparkline';

export function SidebarExplorer() {
    const snapshot = useTelemetryStore((s) => s.snapshot);
    const cpuHistory = useTelemetryStore((s) => s.cpuHistory);
    const ramHistory = useTelemetryStore((s) => s.ramHistory);
    const gpuHistory = useTelemetryStore((s) => s.gpuHistory);
    const openTab = useWorkbenchStore((s) => s.openTab);

    return (
        <div className="h-full w-full bg-zinc-900/70 flex flex-col text-xs select-none overflow-hidden">
            <div className="px-3 py-2.5 font-bold tracking-wider text-zinc-400 border-b border-zinc-800 flex items-center justify-between shrink-0">
                <span className="truncate whitespace-nowrap">COMPUTE EXPLORER</span>
                <span className="text-[10px] font-mono text-emerald-400 shrink-0">LOCAL</span>
            </div>

            {/* Tóm tắt phần cứng Realtime với Live Sparklines */}
            <div className="p-3 border-b border-zinc-800 space-y-3 bg-zinc-950/40 shrink-0">
                {/* CPU Section */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-zinc-400 flex items-center gap-1.5 whitespace-nowrap truncate">
                            <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> CPU ({snapshot?.cpu.logical_cores || 0} threads)
                        </span>
                        <span className="font-mono text-zinc-200 font-semibold">{snapshot?.cpu.percent ?? 0}%</span>
                    </div>
                    <Sparkline data={cpuHistory} color="emerald" height={26} />
                </div>

                {/* RAM Section */}
                <div className="space-y-1 pt-1 border-t border-zinc-800/60">
                    <div className="flex items-center justify-between">
                        <span className="text-zinc-400 flex items-center gap-1.5 whitespace-nowrap truncate">
                            <HardDrive className="w-3.5 h-3.5 text-blue-400 shrink-0" /> RAM ({snapshot?.ram.total_gb || 0} GB)
                        </span>
                        <span className="font-mono text-zinc-200 font-semibold">
                            {snapshot?.ram.used_gb ?? 0} GB ({snapshot?.ram.percent ?? 0}%)
                        </span>
                    </div>
                    <Sparkline data={ramHistory} color="blue" height={26} />
                </div>

                {/* GPU Section */}
                {snapshot?.gpus && snapshot.gpus.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-zinc-800/60">
                        <div className="flex justify-between text-purple-300 font-medium">
                            <span className="truncate max-w-[140px] whitespace-nowrap">{snapshot.gpus[0].name}</span>
                            <span className="font-mono">{snapshot.gpus[0].temp_c}°C</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-zinc-400 font-mono">
                            <span>Load: {snapshot.gpus[0].load_percent}%</span>
                            <span>VRAM: {snapshot.gpus[0].memory_used_mb}MB</span>
                        </div>
                        <Sparkline data={gpuHistory} color="purple" height={26} />
                    </div>
                )}
            </div>

            {/* Danh mục Pipelines & Services */}
            <div className="p-2 space-y-1 flex-1 overflow-y-auto">
                <div className="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Pipelines & Services</div>

                <button
                    onClick={() => openTab({ id: 'tab-dash-1', title: 'Compute Dashboard', type: 'dashboard-metrics' })}
                    className="w-full px-2.5 py-2 rounded hover:bg-zinc-800/70 flex items-center gap-2 text-zinc-300 text-left transition-colors cursor-pointer"
                >
                    <Activity className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="truncate whitespace-nowrap">Compute Dashboard</span>
                </button>

                <button
                    onClick={() => openTab({ id: 'tab-canvas-1', title: 'Auto-Guard GPU Pipeline', type: 'workflow-canvas' })}
                    className="w-full px-2.5 py-2 rounded hover:bg-zinc-800/70 flex items-center gap-2 text-zinc-300 text-left transition-colors cursor-pointer"
                >
                    <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate whitespace-nowrap">Auto-Guard GPU Pipeline</span>
                </button>

                <button
                    onClick={() => openTab({ id: 'tab-proc-1', title: 'OS Process & Port Inspector', type: 'service-inspector' })}
                    className="w-full px-2.5 py-2 rounded hover:bg-zinc-800/70 flex items-center gap-2 text-zinc-300 text-left transition-colors cursor-pointer"
                >
                    <Server className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate whitespace-nowrap">OS Process & Port Inspector</span>
                </button>

                <button
                    onClick={() => openTab({ id: 'tab-network-1', title: 'API & Network Traffic', type: 'network-traffic' })}
                    className="w-full px-2.5 py-2 rounded hover:bg-zinc-800/70 flex items-center gap-2 text-zinc-300 text-left transition-colors cursor-pointer"
                >
                    <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="truncate whitespace-nowrap">API &amp; Network Traffic</span>
                </button>

                <button
                    onClick={() => openTab({ id: 'tab-partitions-1', title: 'Memory & Partitions', type: 'memory-partitions' })}
                    className="w-full px-2.5 py-2 rounded hover:bg-zinc-800/70 flex items-center gap-2 text-zinc-300 text-left transition-colors cursor-pointer"
                >
                    <HardDrive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate whitespace-nowrap">Memory &amp; Storage Partitions</span>
                </button>

                <button
                    onClick={() => openTab({ id: 'tab-incidents-1', title: 'Incident Audit Trail', type: 'incident-log' })}
                    className="w-full px-2.5 py-2 rounded hover:bg-zinc-800/70 flex items-center gap-2 text-zinc-300 text-left transition-colors cursor-pointer"
                >
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span className="truncate whitespace-nowrap">Incident Audit Trail</span>
                </button>

                <button
                    onClick={() => openTab({ id: 'tab-advisor-1', title: 'Health Score & AI Advisor', type: 'health-advisor' })}
                    className="w-full px-2.5 py-2 rounded hover:bg-zinc-800/70 flex items-center gap-2 text-zinc-300 text-left transition-colors cursor-pointer"
                >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="truncate whitespace-nowrap">Health &amp; AI Advisor</span>
                </button>
            </div>
        </div>
    );
}
