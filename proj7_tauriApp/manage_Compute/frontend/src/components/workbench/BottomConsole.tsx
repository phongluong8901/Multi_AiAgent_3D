import { Terminal, Trash2 } from 'lucide-react';
import { useTelemetryStore } from '../../stores/useTelemetryStore';

export function BottomConsole() {
    const { logs, clearLogs, snapshot } = useTelemetryStore();

    return (
        <div className="h-full bg-zinc-950 flex flex-col text-xs font-mono">
            <div className="px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between select-none">
                <div className="flex items-center gap-2 text-zinc-300">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-sans font-medium">Console & Realtime Telemetry</span>
                </div>
                <div className="flex items-center gap-4">
                    {snapshot && (
                        <span className="text-[11px] text-zinc-400">
                            CPU: <strong className="text-emerald-400">{snapshot.cpu.percent}%</strong> | RAM:{' '}
                            <strong className="text-blue-400">{snapshot.ram.percent}%</strong> | Disk Free:{' '}
                            <strong>{snapshot.io.disk_free_gb}GB</strong>
                        </span>
                    )}
                    <button
                        onClick={clearLogs}
                        className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-sans"
                    >
                        <Trash2 className="w-3.5 h-3.5" /> Clear
                    </button>
                </div>
            </div>

            <div className="p-2.5 overflow-y-auto flex-1 space-y-1">
                {logs.map((log) => (
                    <div key={log.id} className="flex gap-2 leading-relaxed">
                        <span className="text-zinc-500 shrink-0">[{log.time}]</span>
                        <span
                            className={`shrink-0 font-semibold ${log.type === 'ACTION'
                                    ? 'text-amber-400'
                                    : log.type === 'ALERT'
                                        ? 'text-rose-400'
                                        : 'text-emerald-400'
                                }`}
                        >
                            [{log.type}]
                        </span>
                        <span className="text-zinc-300 break-all">{log.message}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}