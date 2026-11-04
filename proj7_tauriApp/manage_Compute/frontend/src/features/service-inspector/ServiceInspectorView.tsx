import { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw, Skull, Pause, Play, TerminalSquare, Sparkles, Shield, X, CheckCircle2, AlertTriangle, Globe, ExternalLink } from 'lucide-react';
import { httpClient } from '../../services/httpClient';
import type { ProcessInfo, ProcessActionType, ProcessNetworkProfile } from '../../types/compute';
import { useTelemetryStore } from '../../stores/useTelemetryStore';
import { useWorkbenchStore } from '../../stores/useWorkbenchStore';

export function ServiceInspectorView() {
    const [processes, setProcesses] = useState<ProcessInfo[]>([]);
    const [sortBy, setSortBy] = useState<'memory' | 'cpu'>('memory');
    const [spawnCmd, setSpawnCmd] = useState('python -m http.server 8090');
    const [isLoading, setIsLoading] = useState(false);
    const [quotaProc, setQuotaProc] = useState<ProcessInfo | null>(null);
    const [quotaCores, setQuotaCores] = useState<number[]>([0, 1]);
    const [quotaRam, setQuotaRam] = useState<number>(2048);
    const [quotaCpu, setQuotaCpu] = useState<number>(40);
    const [quotaPolicy, setQuotaPolicy] = useState<string>('TRIM_AND_THROTTLE');
    const [modalMsg, setModalMsg] = useState<string | null>(null);
    const [confirmKill, setConfirmKill] = useState<{
        pid: number;
        name: string;
        memoryMb: number;
        cpuPercent: number;
        action: 'terminate' | 'kill';
    } | null>(null);
    const [isKilling, setIsKilling] = useState(false);
    const [inspectNetProc, setInspectNetProc] = useState<ProcessNetworkProfile | null>(null);

    const openTab = useWorkbenchStore((s) => s.openTab);

    const addLog = useTelemetryStore((s) => s.addLog);
    const connected = useTelemetryStore((s) => s.connected);
    const snapshot = useTelemetryStore((s) => s.snapshot);
    const hasReportedError = useRef(false);

    const totalCores = snapshot?.cpu.logical_cores || 8;

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

    const handlePromptKill = (p: ProcessInfo, defaultAction: 'terminate' | 'kill' = 'terminate') => {
        setConfirmKill({
            pid: p.pid,
            name: p.name,
            memoryMb: Number((p.memory_mb ?? 0).toFixed(1)),
            cpuPercent: Number((p.cpu_percent ?? 0).toFixed(1)),
            action: defaultAction,
        });
    };

    const handleConfirmKill = async () => {
        if (!confirmKill) return;
        setIsKilling(true);
        try {
            await httpClient.controlProcess(confirmKill.pid, confirmKill.action);
            addLog(
                'ACTION',
                `[PROCESS TERMINATED] Successfully sent '${confirmKill.action.toUpperCase()}' signal to ${confirmKill.name} [PID ${confirmKill.pid}]`
            );
            setConfirmKill(null);
            void loadProcesses();
        } catch (e: any) {
            addLog('ALERT', `Failed to ${confirmKill.action} PID ${confirmKill.pid}: ${e.message}`);
        } finally {
            setIsKilling(false);
        }
    };

    const handleTrimRam = async (pid: number, name: string) => {
        try {
            const res = await httpClient.trimMemory(pid);
            addLog('ACTION', `[OPTIMIZE] Executed Win32 EmptyWorkingSet on ${name} [PID ${pid}] (freed: ${res.freed})`);
            void loadProcesses();
        } catch (e: any) {
            addLog('ALERT', `Trim RAM failed for PID ${pid}: ${e.message}`);
        }
    };

    const handleInspectNetwork = async (p: ProcessInfo) => {
        try {
            const data = await httpClient.getProcessNetwork(p.pid);
            setInspectNetProc(data);
        } catch (e: any) {
            addLog('ALERT', `Failed to inspect network for PID ${p.pid}: ${e.message}`);
        }
    };

    const handleOpenQuota = (p: ProcessInfo) => {
        setQuotaProc(p);
        setQuotaCores([0, 1]);
        setQuotaRam(Math.max(1024, Math.round(p.memory_mb * 1.3)));
        setQuotaCpu(Math.max(30, Math.round(p.cpu_percent * 1.5)));
        setModalMsg(null);
    };

    const handleSaveQuota = async () => {
        if (!quotaProc) return;
        try {
            await httpClient.applyResourceQuota(quotaProc.pid, {
                cores: quotaCores,
                max_ram_mb: quotaRam,
                max_cpu_percent: quotaCpu,
                policy: quotaPolicy,
            });
            addLog(
                'ACTION',
                `[QUOTA] Enforced quota on ${quotaProc.name} [PID ${quotaProc.pid}]: Cores ${JSON.stringify(quotaCores)}, Max RAM ${quotaRam}MB, Max CPU ${quotaCpu}%`
            );
            setModalMsg(`Quota limits successfully applied to PID ${quotaProc.pid}!`);
            setTimeout(() => {
                setQuotaProc(null);
                setModalMsg(null);
            }, 1500);
        } catch (e: any) {
            setModalMsg(`Failed: ${e.message}`);
        }
    };

    const toggleModalCore = (c: number) => {
        if (quotaCores.includes(c)) {
            if (quotaCores.length === 1) return;
            setQuotaCores(quotaCores.filter((x) => x !== c));
        } else {
            setQuotaCores([...quotaCores, c].sort((a, b) => a - b));
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
            {/* Thanh công cụ điều khiển Process & CLI */}
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
                        onClick={() => openTab({ id: 'tab-network-1', title: 'API & Network Traffic', type: 'network-traffic' })}
                        className="px-2.5 py-1 rounded bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border border-blue-500/40 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Open System API & Network Traffic Map"
                    >
                        <Globe className="w-3.5 h-3.5 text-blue-400" />
                        <span>API Traffic Map</span>
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
                                    <tr key={p.pid} className="hover:bg-zinc-900/80 transition-colors group border-y border-transparent hover:border-zinc-800/80">
                                        <td className="py-2.5 px-3 text-emerald-400 font-semibold">{p.pid}</td>
                                        <td className="py-2.5 px-3 font-sans text-zinc-200">
                                            <div className="font-medium truncate max-w-[220px]" title={p.name}>
                                                {p.name}
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <span
                                                className={`px-1.5 py-0.5 rounded text-[10px] ${p.status === 'running'
                                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                                                    : 'bg-zinc-800 text-zinc-400'
                                                    }`}
                                            >
                                                {p.status}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-zinc-300">{cpuPercent}%</td>
                                        <td className="py-2.5 px-3 text-zinc-300">{memoryMb} MB</td>
                                        <td className="py-2.5 px-3 text-blue-400">
                                            {ports.length > 0 ? ports.join(', ') : '-'}
                                        </td>
                                        <td className="py-2.5 px-4 text-right space-x-1.5 pr-6 shrink-0">
                                            <button
                                                onClick={() => handleTrimRam(p.pid, p.name)}
                                                title="Trim Working Set RAM (Win32 EmptyWorkingSet)"
                                                className="p-1.5 rounded-md text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/80 border border-transparent hover:border-emerald-500/40 transition-all cursor-pointer"
                                            >
                                                <Sparkles className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleOpenQuota(p)}
                                                title="Set Resource Quota & Cores"
                                                className="p-1.5 rounded-md text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/80 border border-transparent hover:border-cyan-500/40 transition-all cursor-pointer"
                                            >
                                                <Shield className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleInspectNetwork(p)}
                                                title="Inspect Process Outbound API & Network Sockets"
                                                className="p-1.5 rounded-md text-blue-400 hover:text-blue-300 hover:bg-blue-950/80 border border-transparent hover:border-blue-500/40 transition-all cursor-pointer"
                                            >
                                                <Globe className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleAction(p.pid, 'suspend')}
                                                title="Suspend Process (Pause)"
                                                className="p-1.5 rounded-md text-amber-400 hover:text-amber-300 hover:bg-amber-950/80 border border-transparent hover:border-amber-500/40 transition-all cursor-pointer"
                                            >
                                                <Pause className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleAction(p.pid, 'resume')}
                                                title="Resume Process"
                                                className="p-1.5 rounded-md text-blue-400 hover:text-blue-300 hover:bg-blue-950/80 border border-transparent hover:border-blue-500/40 transition-all cursor-pointer"
                                            >
                                                <Play className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handlePromptKill(p, 'terminate')}
                                                title="Terminate / Kill Process (Requires Confirmation)"
                                                className="p-1.5 rounded-md text-rose-400 hover:text-rose-200 hover:bg-rose-950/90 border border-transparent hover:border-rose-500/60 hover:shadow-lg hover:shadow-rose-950/50 transition-all cursor-pointer"
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

            {/* Modal Thiết lập Quota cho Process */}
            {quotaProc && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-4 py-3 bg-zinc-950/80 border-b border-zinc-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-emerald-400" />
                                <span className="font-semibold text-xs text-zinc-100">
                                    Set Resource Quota - {quotaProc.name} [PID {quotaProc.pid}]
                                </span>
                            </div>
                            <button
                                onClick={() => setQuotaProc(null)}
                                className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-4 space-y-3.5 text-xs">
                            {/* CPU Cores Selector */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-zinc-400">
                                    <span>Assign Dedicated Cores:</span>
                                    <span className="font-mono text-cyan-300 font-bold">{quotaCores.join(', ')}</span>
                                </div>
                                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1">
                                    {Array.from({ length: Math.min(16, totalCores) }, (_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => toggleModalCore(i)}
                                            className={`py-1 text-center font-mono text-[10px] font-bold rounded border cursor-pointer ${
                                                quotaCores.includes(i)
                                                    ? 'bg-cyan-950 text-cyan-300 border-cyan-500/60'
                                                    : 'bg-zinc-950 text-zinc-500 border-zinc-800'
                                            }`}
                                        >
                                            C{i}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* RAM Quota Limit */}
                            <div className="space-y-1">
                                <div className="flex justify-between text-zinc-400">
                                    <span>Max RAM Cap (MB):</span>
                                    <span className="font-mono text-blue-300 font-bold">{quotaRam} MB</span>
                                </div>
                                <input
                                    type="range"
                                    min={256}
                                    max={8192}
                                    step={256}
                                    value={quotaRam}
                                    onChange={(e) => setQuotaRam(Number(e.target.value))}
                                    className="w-full accent-blue-500 cursor-pointer"
                                />
                            </div>

                            {/* Max CPU Limit */}
                            <div className="space-y-1">
                                <div className="flex justify-between text-zinc-400">
                                    <span>Max CPU Bandwidth (%):</span>
                                    <span className="font-mono text-emerald-300 font-bold">{quotaCpu}%</span>
                                </div>
                                <input
                                    type="range"
                                    min={10}
                                    max={100}
                                    step={5}
                                    value={quotaCpu}
                                    onChange={(e) => setQuotaCpu(Number(e.target.value))}
                                    className="w-full accent-emerald-500 cursor-pointer"
                                />
                            </div>

                            {/* Quota Policy */}
                            <div className="space-y-1">
                                <span className="text-zinc-400">Enforcement Policy on Breach:</span>
                                <select
                                    value={quotaPolicy}
                                    onChange={(e) => setQuotaPolicy(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                                >
                                    <option value="TRIM_AND_THROTTLE">Win32 EmptyWorkingSet Trim + IDLE Priority</option>
                                    <option value="SUSPEND">Suspend Process (Tạm dừng tiến trình)</option>
                                    <option value="KILL">Terminate Process (Cưỡng chế dừng)</option>
                                    <option value="LOG_ONLY">Log Alert &amp; Notify Only</option>
                                </select>
                            </div>

                            {modalMsg && (
                                <div className="p-2 rounded bg-zinc-950 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <span>{modalMsg}</span>
                                </div>
                            )}
                        </div>

                        <div className="px-4 py-3 bg-zinc-950/80 border-t border-zinc-800 flex justify-end gap-2">
                            <button
                                onClick={() => setQuotaProc(null)}
                                className="px-3 py-1.5 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveQuota}
                                className="px-4 py-1.5 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                            >
                                Enforce Limits
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Xác Nhận Dừng / Hủy Tiến Trình (Process Termination Confirmation) */}
            {confirmKill && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-zinc-900 border border-rose-500/50 rounded-xl shadow-2xl max-w-md w-full overflow-hidden text-xs text-zinc-300">
                        {/* Header */}
                        <div className="px-4 py-3 bg-rose-950/40 border-b border-rose-500/30 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-rose-300 font-semibold text-sm">
                                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                                <span>Confirm Process Termination</span>
                            </div>
                            <button
                                onClick={() => setConfirmKill(null)}
                                className="text-zinc-400 hover:text-zinc-200 cursor-pointer p-1 rounded hover:bg-rose-950/60 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Nội dung cảnh báo */}
                        <div className="p-4 space-y-3.5">
                            <div className="text-zinc-300 text-xs leading-relaxed">
                                Are you sure you want to send a termination signal to this process? Any unsaved data or active socket connections may be immediately interrupted.
                            </div>

                            {/* Chi tiết tiến trình mục tiêu */}
                            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-500 font-medium">Process Name:</span>
                                    <span className="font-semibold text-zinc-100 font-mono truncate max-w-[200px]" title={confirmKill.name}>
                                        {confirmKill.name}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-500 font-medium">Process ID (PID):</span>
                                    <span className="font-mono text-emerald-400 font-semibold">{confirmKill.pid}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-500 font-medium">Current Memory:</span>
                                    <span className="font-mono text-zinc-300">{confirmKill.memoryMb} MB</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-500 font-medium">CPU Usage:</span>
                                    <span className="font-mono text-zinc-300">{confirmKill.cpuPercent}%</span>
                                </div>
                            </div>

                            {/* Lựa chọn loại Signal */}
                            <div className="space-y-1.5">
                                <span className="text-zinc-400 font-medium">Signal Mode:</span>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setConfirmKill({ ...confirmKill, action: 'terminate' })}
                                        className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                                            confirmKill.action === 'terminate'
                                                ? 'bg-amber-950/60 border-amber-500/50 text-amber-200'
                                                : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                        }`}
                                    >
                                        <div className="font-semibold text-[11px]">Terminate (Graceful)</div>
                                        <div className="text-[10px] text-zinc-400 mt-0.5">SIGTERM request</div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setConfirmKill({ ...confirmKill, action: 'kill' })}
                                        className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                                            confirmKill.action === 'kill'
                                                ? 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                                                : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                        }`}
                                    >
                                        <div className="font-semibold text-[11px]">Force Kill (Immediate)</div>
                                        <div className="text-[10px] text-zinc-400 mt-0.5">SIGKILL / Abort</div>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Footer Controls */}
                        <div className="px-4 py-3 bg-zinc-950/80 border-t border-zinc-800 flex justify-end gap-2">
                            <button
                                onClick={() => setConfirmKill(null)}
                                disabled={isKilling}
                                className="px-3.5 py-1.5 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmKill}
                                disabled={isKilling}
                                className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg ${
                                    confirmKill.action === 'kill'
                                        ? 'bg-rose-700 hover:bg-rose-600 text-white shadow-rose-950/60'
                                        : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/60'
                                } disabled:opacity-50`}
                            >
                                <Skull className="w-3.5 h-3.5" />
                                <span>{isKilling ? 'Sending Signal...' : confirmKill.action === 'kill' ? 'Force Kill Process' : 'Terminate Process'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Chi Tiết Điểm Cuối Socket & API Của Process */}
            {inspectNetProc && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden text-xs text-zinc-300">
                        <div className="px-4 py-3 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-blue-400" />
                                <span className="font-semibold text-sm text-zinc-100">
                                    Network Sockets &amp; Outbound API Calls: {inspectNetProc.name} [PID {inspectNetProc.pid}]
                                </span>
                            </div>
                            <button
                                onClick={() => setInspectNetProc(null)}
                                className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-4 space-y-3 overflow-y-auto flex-1">
                            <div className="space-y-1">
                                <span className="text-zinc-400 font-medium text-[11px]">Contacted Domains &amp; Endpoints:</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {inspectNetProc.domains_contacted.length === 0 ? (
                                        <span className="text-zinc-500 italic text-[11px]">No active external domain calls.</span>
                                    ) : (
                                        inspectNetProc.domains_contacted.map((domain, i) => (
                                            <span
                                                key={i}
                                                className="px-2 py-0.5 rounded-full bg-blue-950/60 border border-blue-500/40 text-blue-300 font-mono text-[11px]"
                                            >
                                                {domain}
                                            </span>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 font-mono text-[10px]">
                                        <tr>
                                            <th className="py-2 px-3">PROTO</th>
                                            <th className="py-2 px-3">TARGET URL / ENDPOINT</th>
                                            <th className="py-2 px-3">REMOTE HOST / IP:PORT</th>
                                            <th className="py-2 px-3">CATEGORY</th>
                                            <th className="py-2 px-3">STATUS</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
                                        {inspectNetProc.outbound_connections.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-6 text-center text-zinc-500 font-sans">
                                                    No outbound socket connections recorded for this process.
                                                </td>
                                            </tr>
                                        ) : (
                                            inspectNetProc.outbound_connections.map((c, idx) => (
                                                <tr key={idx} className="hover:bg-zinc-900/60">
                                                    <td className="py-2 px-3 text-cyan-400 font-semibold">{c.protocol}</td>
                                                    <td className="py-2 px-3 font-mono">
                                                        {c.url && c.url !== 'N/A' ? (
                                                            <a
                                                                href={c.url.startsWith('http') ? c.url : undefined}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 font-semibold group/link max-w-[240px] truncate"
                                                                title={c.url}
                                                            >
                                                                <span className="truncate">{c.url}</span>
                                                                <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 shrink-0" />
                                                            </a>
                                                        ) : (
                                                            <span className="text-zinc-500 font-mono text-[11px]">-</span>
                                                        )}
                                                        {c.description && (
                                                            <div className="text-[10px] text-zinc-500 font-sans truncate max-w-[240px]" title={c.description}>
                                                                {c.description}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <div className="text-zinc-200 font-medium truncate max-w-[160px]" title={c.remote_host || ''}>
                                                            {c.remote_host}
                                                        </div>
                                                        <div className="text-zinc-500 text-[10px]">
                                                            {c.remote_ip}:{c.remote_port}
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-medium ${
                                                            c.category === 'AI_LLM'
                                                                ? 'bg-purple-950 text-purple-300 border border-purple-800/40'
                                                                : c.category === 'CLOUD_API'
                                                                ? 'bg-blue-950 text-blue-300 border border-blue-800/40'
                                                                : c.category === 'DATABASE'
                                                                ? 'bg-amber-950 text-amber-300 border border-amber-800/40'
                                                                : c.category === 'LOCAL_SERVICE'
                                                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                                                                : 'bg-zinc-800 text-zinc-400'
                                                        }`}>
                                                            {c.category}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                                            c.status === 'ESTABLISHED'
                                                                ? 'text-emerald-400 font-semibold'
                                                                : 'text-zinc-500'
                                                        }`}>
                                                            {c.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="px-4 py-2.5 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between">
                            <span className="text-[11px] text-zinc-500">
                                Total Sockets: {inspectNetProc.total_connections} | Listening Ports: {inspectNetProc.listening_ports.join(', ') || 'None'}
                            </span>
                            <button
                                onClick={() => setInspectNetProc(null)}
                                className="px-3.5 py-1.5 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
