import { Server, Layers, HardDrive, Activity } from 'lucide-react';
import { useTelemetryStore } from '../../stores/useTelemetryStore';
import { useWorkbenchStore } from '../../stores/useWorkbenchStore';

export function SidebarExplorer() {
    const snapshot = useTelemetryStore((s) => s.snapshot);
    const openTab = useWorkbenchStore((s) => s.openTab);

    return (
        <div className="h-full w-full bg-zinc-900/70 flex flex-col text-xs select-none overflow-hidden">
            <div className="px-3 py-2.5 font-bold tracking-wider text-zinc-400 border-b border-zinc-800 flex items-center justify-between shrink-0">
                <span className="truncate whitespace-nowrap">COMPUTE EXPLORER</span>
                <span className="text-[10px] font-mono text-emerald-400 shrink-0">LOCAL</span>
            </div>

            {/* Tóm tắt phần cứng Realtime ngay trên Sidebar */}
            <div className="p-3 border-b border-zinc-800 space-y-2.5 bg-zinc-950/40 shrink-0">
                <div className="flex items-center justify-between">
                    <span className="text-zinc-400 flex items-center gap-1.5 whitespace-nowrap truncate">
                        <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> CPU ({snapshot?.cpu.logical_cores || 0} threads)
                    </span>
                    <span className="font-mono text-zinc-200 shrink-0">{snapshot?.cpu.percent ?? 0}%</span>
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-zinc-400 flex items-center gap-1.5 whitespace-nowrap truncate">
                        <HardDrive className="w-3.5 h-3.5 text-blue-400 shrink-0" /> RAM ({snapshot?.ram.total_gb || 0} GB)
                    </span>
                    <span className="font-mono text-zinc-200 shrink-0">
                        {snapshot?.ram.used_gb ?? 0} GB ({snapshot?.ram.percent ?? 0}%)
                    </span>
                </div>

                {snapshot?.gpus?.map((gpu) => (
                    <div key={gpu.id} className="pt-1.5 border-t border-zinc-800/80 flex flex-col gap-1">
                        <div className="flex justify-between text-purple-300 font-medium">
                            <span className="truncate max-w-[130px] whitespace-nowrap">{gpu.name}</span>
                            <span className="font-mono shrink-0">{gpu.temp_c}°C</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-zinc-400 font-mono">
                            <span className="whitespace-nowrap">Load: {gpu.load_percent}%</span>
                            <span className="whitespace-nowrap">VRAM: {gpu.memory_used_mb}MB</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Cây thư mục kiểu Postman Collections */}
            <div className="p-2 space-y-1 flex-1 overflow-y-auto">
                <div className="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Collections</div>

                <button
                    onClick={() => openTab({ id: 'tab-canvas-1', title: 'Auto-Guard GPU Pipeline', type: 'n8n-canvas' })}
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
            </div>
        </div>
    );
}
