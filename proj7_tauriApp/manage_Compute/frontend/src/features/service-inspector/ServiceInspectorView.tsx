import { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw, Skull, Pause, Play, TerminalSquare } from 'lucide-react';
import { httpClient } from '../../services/httpClient';
import type { ProcessInfo, ProcessActionType } from '../../types/compute';
import { useTelemetryStore } from '../../stores/useTelemetryStore';

export function ServiceInspectorView() {
    const [processes, setProcesses] = useState<ProcessInfo[]>([]);
    const [sortBy, setSortBy] = useState<'memory' | 'cpu'>('memory');
    const [spawnCmd, setSpawnCmd] = useState('python -m http.server 8090');
    const [isLoading, setIsLoading] = useState(false);
    const addLog = useTelemetryStore((s) => s.addLog);
    const connected = useTelemetryStore((s) => s.connected);
    const hasReportedError = useRef(false);

    const loadProcesses = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await httpClient.getProcesses(40, sortBy);
            setProcesses(Array.isArray(data) ? data : []);
            hasReportedError.current = false;
        } catch (e: any) {
            if (!hasReportedError.current) {
                if (connected) {
                    addLog('ALERT', `Failed to load processes: ${e.message}`);
                }
                hasReportedError.current = true;
            }
        } finally {
            setIsLoading(false);
        }
    }, [sortBy, addLog, connected]);

    useEffect(() => {
        void loadProcesses();
        const timer = setInterval(() => {
            void loadProcesses();
        }, 3000);
        return () => clearInterval(timer);
    }, [loadProcesses]);

    const handleAction = async (pid: number, action: ProcessActionType) => {
        try {
            await httpClient.controlProcess(pid, action);
            addLog('ACTION', `Sent '${action.toUpperCase()}' signal to PID ${pid}`);
            void loadProcesses();
        } catch (e: any) {
            addLog('ALERT', `PID ${pid} error: ${e.message}`);
        }
    };

    const handleSpawn = async () => {
        if (!spawnCmd.trim()) return;
        try {
            const res = await httpClient.spawnService('custom-worker', spawnCmd);
            addLog('ACTION', `Spawned subprocess PID ${res.pid}: ${res.command}`);
            void loadProcesses();
        } catch (e: any) {
            addLog('ALERT', `Spawn error: ${e.message}`);
        }
    };

    return (
        <div className="h-full flex flex-col bg-zinc-950 text-zinc-200 select-none">
            {/* Thanh công cụ Postman style */}
            <div className="p-3 border-b border-zinc-800 flex items-center justify-between gap-4 bg-zinc-900/50 shrink-0">
                <div className="flex items-center gap-2 flex-1 max-w-xl">
                    <span className="text-xs font-mono text-zinc-400 shrink-0">SPAWN CLI:</span>
                    <div className="relative flex-1">
                        <TerminalSquare className="w-4 h-4 absolute left-2.5 top-2 text-zinc-500" />
                        <input
                            type="text"
                            value={spawnCmd}
                            onChange={(e) => setSpawnCmd(e.target.value)}
                            placeholder="Enter command to spawn background daemon..."
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 pl-8 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
                        />
                    </div>
                    <button
                        onClick={handleSpawn}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold tracking-wide transition-colors cursor-pointer shrink-0"
                    >
                        Spawn
                    </button>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-zinc-400">Sort by:</span>
                    <button
                        onClick={() => setSortBy('memory')}
                        className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${sortBy === 'memory'
                            ? 'bg-zinc-800 text-emerald-400 border border-emerald-500/30'
                            : 'text-zinc-400 hover:bg-zinc-800'
                            }`}
                    >
                        RAM Usage
                    </button>
                    <button
                        onClick={() => setSortBy('cpu')}
                        className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${sortBy === 'cpu'
                            ? 'bg-zinc-800 text-emerald-400 border border-emerald-500/30'
                            : 'text-zinc-400 hover:bg-zinc-800'
                            }`}
                    >
                        CPU Usage
                    </button>
                    <button
                        onClick={loadProcesses}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
                        title="Refresh process list"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Bảng danh sách Process */}
            <div className="flex-1 overflow-auto">
                <table className="w-full min-w-[850px] text-left border-collapse text-xs">
                    <thead className="bg-zinc-900/80 sticky top-0 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
                        <tr>
                            <th className="py-2.5 px-3">PID</th>
                            <th className="py-2.5 px-3">NAME</th>
                            <th className="py-2.5 px-3">STATUS</th>
                            <th className="py-2.5 px-3">CPU %</th>
                            <th className="py-2.5 px-3">RAM (MB)</th>
                            <th className="py-2.5 px-3">LISTEN PORTS</th>
                            <th className="py-2.5 px-4 text-right pr-6">CONTROLS</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 font-mono text-zinc-300">
                        {processes.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="py-12 text-center text-zinc-500">
                                    {connected
                                        ? 'No processes found matching criteria'
                                        : 'Connecting to Python Engine (127.0.0.1:14200)...'}
                                </td>
                            </tr>
                        ) : (
                            processes.map((p) => {
                                const ports = p.open_ports ?? (p as any).ports ?? [];
                                const cpuPercent = (p.cpu_percent ?? 0).toFixed(1);
                                const memoryMb = (p.memory_mb ?? 0).toFixed(1);

                                return (
                                    <tr key={p.pid} className="hover:bg-zinc-900/40 transition-colors group">
                                        <td className="py-2 px-3 text-emerald-400 font-semibold">{p.pid}</td>
                                        <td className="py-2 px-3 font-sans text-zinc-200">
                                            <div className="font-medium truncate max-w-[220px]" title={p.name}>
                                                {p.name}
                                            </div>
                                        </td>
                                        <td className="py-2 px-3">
                                            <span
                                                className={`px-1.5 py-0.5 rounded text-[10px] ${p.status === 'running'
                                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                                                    : 'bg-zinc-800 text-zinc-400'
                                                    }`}
                                            >
                                                {p.status}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3 text-zinc-300">{cpuPercent}%</td>
                                        <td className="py-2 px-3 text-zinc-300">{memoryMb} MB</td>
                                        <td className="py-2 px-3 text-blue-400">
                                            {ports.length > 0 ? ports.join(', ') : '-'}
                                        </td>
                                        <td className="py-2 px-4 text-right space-x-1 pr-6 shrink-0">
                                            <button
                                                onClick={() => handleAction(p.pid, 'suspend')}
                                                title="Suspend Process"
                                                className="p-1 hover:bg-zinc-800 rounded text-amber-400 cursor-pointer"
                                            >
                                                <Pause className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleAction(p.pid, 'resume')}
                                                title="Resume Process"
                                                className="p-1 hover:bg-zinc-800 rounded text-blue-400 cursor-pointer"
                                            >
                                                <Play className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleAction(p.pid, 'terminate')}
                                                title="Terminate Process"
                                                className="p-1 hover:bg-zinc-800 rounded text-rose-400 cursor-pointer"
                                            >
                                                <Skull className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
