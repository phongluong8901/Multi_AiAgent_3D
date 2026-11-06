/**
 * Màn hình Quản lý & Khảo sát Tiến trình Hệ điều hành (Service & Process Inspector View):
 * - Liệt kê chi tiết các tiến trình hệ thống, sắp xếp theo RAM (Working Set RSS) hoặc CPU %.
 * - Hỗ trợ các hành động can thiệp trực tiếp: Tạm dừng (Suspend), Tiếp tục (Resume), Cắt tỉa RAM (EmptyWorkingSet),
 *   Đặt hạn ngạch tài nguyên (Apply Resource Quota), Khảo sát socket mạng (Inspect Network) và Hủy tiến trình (Terminate/Kill).
 * - Khởi tạo tiến trình mới (Spawn CLI subprocess) và gắn luồng log stdout vào Bottom Console.
 * - Hộp thoại xác nhận hủy tiến trình (Confirm Kill Modal) bảo vệ an toàn cho các tác vụ quan trọng.
 */

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

    /**
     * Tải danh sách tiến trình từ backend.
     */
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

    // Chu kỳ cập nhật mỗi 3 giây
    useEffect(() => {
        void loadProcesses();
        const timer = setInterval(() => {
            void loadProcesses();
        }, 3000);
        return () => clearInterval(timer);
    }, [loadProcesses]);

    /**
     * Gửi tín hiệu điều khiển tiến trình (suspend, resume, etc.).
     */
    const handleAction = async (pid: number, action: ProcessActionType) => {
        try {
            await httpClient.controlProcess(pid, action);
            addLog('ACTION', `Sent '${action.toUpperCase()}' signal to PID ${pid}`);
            void loadProcesses();
        } catch (e: any) {
            addLog('ALERT', `PID ${pid} error: ${e.message}`);
        }
    };

    /**
     * Mở hộp thoại xác nhận hủy tiến trình.
     */
    const handlePromptKill = (p: ProcessInfo, defaultAction: 'terminate' | 'kill' = 'terminate') => {
        setConfirmKill({
            pid: p.pid,
            name: p.name,
            memoryMb: Number((p.memory_mb ?? 0).toFixed(1)),
            cpuPercent: Number((p.cpu_percent ?? 0).toFixed(1)),
            action: defaultAction,
        });
    };

    /**
     * Xác nhận hủy tiến trình sau khi người dùng đồng ý trong modal.
     */
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

    /**
     * Cắt tỉa bộ nhớ RAM của tiến trình qua Windows API EmptyWorkingSet.
     */
    const handleTrimRam = async (pid: number, name: string) => {
        try {
            const res = await httpClient.trimMemory(pid);
            addLog('ACTION', `[OPTIMIZE] Executed Win32 EmptyWorkingSet on ${name} [PID ${pid}] (freed: ${res.freed})`);
            void loadProcesses();
        } catch (e: any) {
            addLog('ALERT', `Trim RAM failed for PID ${pid}: ${e.message}`);
        }
    };

    /**
     * Khảo sát các socket mạng của tiến trình.
     */
    const handleInspectNetwork = async (p: ProcessInfo) => {
        try {
            const data = await httpClient.getProcessNetwork(p.pid);
            setInspectNetProc(data);
        } catch (e: any) {
            addLog('ALERT', `Failed to inspect network for PID ${p.pid}: ${e.message}`);
        }
    };

    /**
     * Mở modal cấu hình định mức tài nguyên (Resource Quota Sandbox).
     */
    const handleOpenQuota = (p: ProcessInfo) => {
        setQuotaProc(p);
        setQuotaCores([0, 1]);
        setQuotaRam(Math.max(1024, Math.round(p.memory_mb * 1.3)));
        setQuotaCpu(Math.max(30, Math.round(p.cpu_percent * 1.5)));
        setModalMsg(null);
    };

    /**
     * Lưu và áp dụng hạn ngạch tài nguyên cho tiến trình.
     */
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

    /**
     * Bật/tắt ghim lõi CPU trong modal quota.
     */
    const toggleModalCore = (c: number) => {
        if (quotaCores.includes(c)) {
            if (quotaCores.length === 1) return;
            setQuotaCores(quotaCores.filter((x) => x !== c));
        } else {
            setQuotaCores([...quotaCores, c].sort((a, b) => a - b));
        }
    };

    /**
     * Khởi chạy tiến trình mới từ thanh dòng lệnh SPAWN CLI.
     */
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
                    {/* Sắp xếp theo RAM */}
                    <button
                        onClick={() => setSortBy('memory')}
                        className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${sortBy === 'memory'
                            ? 'bg-zinc-800 text-emerald-400 border border-emerald-500/30'
                            : 'text-zinc-400 hover:bg-zinc-800'
                            }`}
                    >
                        RAM Usage
                    </button>
                    {/* Sắp xếp theo CPU */}
                    <button
                        onClick={() => setSortBy('cpu')}
                        className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${sortBy === 'cpu'
                            ? 'bg-zinc-800 text-emerald-400 border border-emerald-500/30'
                            : 'text-zinc-400 hover:bg-zinc-800'
                            }`}
                    >
                        CPU Usage
                    </button>
                    {/* Nút mở bản đồ mạng API Traffic */}
                    <button
                        onClick={() => openTab({ id: 'tab-network-1', title: 'API & Network Traffic', type: 'network-traffic' })}
                        className="px-2.5 py-1 rounded bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border border-blue-500/40 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Open System API & Network Traffic Map"
                    >
                        <Globe className="w-3.5 h-3.5 text-blue-400" />
                        <span>API Traffic Map</span>
                    </button>
                    {/* Nút làm mới */}
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
                                        <td className="py-2 px-3 text-zinc-400">{p.pid}</td>
                                        <td className="py-2 px-3 font-sans font-medium text-zinc-200">
                                            <button
                                                onClick={() =>
                                                    openTab({
                                                        id: `tab-proc-chart-${p.pid}`,
                                                        title: `${p.name} [PID ${p.pid}]`,
                                                        type: 'process-chart',
                                                    })
                                                }
                                                className="hover:text-emerald-400 hover:underline cursor-pointer text-left truncate max-w-[200px]"
                                                title={`Click to open real-time charts for ${p.name}`}
                                            >
                                                {p.name}
                                            </button>
                                        </td>
                                        <td className="py-2 px-3">
                                            <span
                                                className={`px-1.5 py-0.5 rounded text-[10px] ${p.status === 'running'
                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                    : 'bg-zinc-800 text-zinc-400'
                                                    }`}
                                            >
                                                {p.status}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3 text-emerald-400">{cpuPercent}%</td>
                                        <td className="py-2 px-3 text-blue-400">{memoryMb} MB</td>
                                        <td className="py-2 px-3 text-zinc-400">
                                            {ports.length > 0 ? (
                                                <div className="flex gap-1 flex-wrap">
                                                    {ports.map((port: number) => (
                                                        <span
                                                            key={port}
                                                            className="px-1.5 py-0.5 bg-zinc-800/80 border border-zinc-700/60 rounded text-[10px] text-zinc-300 font-mono"
                                                        >
                                                            :{port}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-zinc-600">-</span>
                                            )}
                                        </td>
                                        <td className="py-2 px-4 text-right pr-6">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {/* Nút cắt tỉa RAM */}
                                                <button
                                                    onClick={() => handleTrimRam(p.pid, p.name)}
                                                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-emerald-400 border border-zinc-700 text-[10px] font-sans flex items-center gap-1 transition-colors cursor-pointer"
                                                    title="Trim memory (Win32 EmptyWorkingSet)"
                                                >
                                                    <Sparkles className="w-3 h-3 text-emerald-400" />
                                                    <span>Trim RAM</span>
                                                </button>

                                                {/* Nút cấu hình Quota */}
                                                <button
                                                    onClick={() => handleOpenQuota(p)}
                                                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-cyan-400 border border-zinc-700 text-[10px] font-sans flex items-center gap-1 transition-colors cursor-pointer"
                                                    title="Enforce Resource Quota (Cores, Max RAM, Max CPU %)"
                                                >
                                                    <Shield className="w-3 h-3 text-cyan-400" />
                                                    <span>Quota</span>
                                                </button>

                                                {/* Nút khảo sát socket mạng */}
                                                <button
                                                    onClick={() => handleInspectNetwork(p)}
                                                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-blue-400 border border-zinc-700 text-[10px] font-sans flex items-center gap-1 transition-colors cursor-pointer"
                                                    title="Inspect network sockets & domains"
                                                >
                                                    <Globe className="w-3 h-3 text-blue-400" />
                                                    <span>Net</span>
                                                </button>

                                                {/* Nút tạm dừng / tiếp tục */}
                                                {p.status === 'suspended' ? (
                                                    <button
                                                        onClick={() => handleAction(p.pid, 'resume')}
                                                        className="p-1 rounded hover:bg-zinc-800 text-emerald-400 transition-colors cursor-pointer"
                                                        title="Resume Process"
                                                    >
                                                        <Play className="w-3.5 h-3.5" />
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleAction(p.pid, 'suspend')}
                                                        className="p-1 rounded hover:bg-zinc-800 text-amber-400 transition-colors cursor-pointer"
                                                        title="Suspend Process"
                                                    >
                                                        <Pause className="w-3.5 h-3.5" />
                                                    </button>
                                                )}

                                                {/* Nút yêu cầu dừng tiến trình */}
                                                <button
                                                    onClick={() => handlePromptKill(p, 'terminate')}
                                                    className="p-1 rounded hover:bg-rose-950/50 text-rose-400 transition-colors cursor-pointer"
                                                    title="Terminate Process"
                                                >
                                                    <Skull className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal Quản lý Hạn ngạch Tài nguyên (Resource Quota Modal) */}
            {quotaProc && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4 text-xs text-zinc-300">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                            <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-cyan-400" />
                                <span className="font-semibold text-sm text-zinc-100">
                                    Resource Quota Sandbox: {quotaProc.name} [PID {quotaProc.pid}]
                                </span>
                            </div>
                            <button
                                onClick={() => setQuotaProc(null)}
                                className="text-zinc-500 hover:text-zinc-200 cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {modalMsg && (
                            <div className="p-2.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs">
                                {modalMsg}
                            </div>
                        )}

                        <div className="space-y-3 font-mono">
                            {/* Cấu hình ghim lõi CPU */}
                            <div>
                                <label className="block text-[11px] text-zinc-400 mb-1 font-sans">
                                    Pin CPU Cores ({quotaCores.length} selected):
                                </label>
                                <div className="grid grid-cols-8 gap-1">
                                    {Array.from({ length: totalCores }, (_, i) => i).map((c) => {
                                        const isPinned = quotaCores.includes(c);
                                        return (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => toggleModalCore(c)}
                                                className={`py-1 rounded text-center text-xs transition-colors cursor-pointer ${isPinned
                                                    ? 'bg-cyan-600 text-white font-bold'
                                                    : 'bg-zinc-950 text-zinc-500 hover:bg-zinc-800'
                                                    }`}
                                            >
                                                #{c}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Giới hạn trần RAM */}
                            <div>
                                <div className="flex justify-between text-[11px] text-zinc-400 mb-1 font-sans">
                                    <span>Max RAM Quota Limit:</span>
                                    <span className="text-cyan-400 font-bold">{quotaRam} MB</span>
                                </div>
                                <input
                                    type="range"
                                    min="256"
                                    max="16384"
                                    step="256"
                                    value={quotaRam}
                                    onChange={(e) => setQuotaRam(Number(e.target.value))}
                                    className="w-full accent-cyan-500 cursor-pointer"
                                />
                            </div>

                            {/* Giới hạn trần CPU */}
                            <div>
                                <div className="flex justify-between text-[11px] text-zinc-400 mb-1 font-sans">
                                    <span>Max CPU Throttle Ceiling:</span>
                                    <span className="text-cyan-400 font-bold">{quotaCpu}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="5"
                                    max="100"
                                    step="5"
                                    value={quotaCpu}
                                    onChange={(e) => setQuotaCpu(Number(e.target.value))}
                                    className="w-full accent-cyan-500 cursor-pointer"
                                />
                            </div>

                            {/* Chính sách xử phạt */}
                            <div>
                                <label className="block text-[11px] text-zinc-400 mb-1 font-sans">Enforcement Policy:</label>
                                <select
                                    value={quotaPolicy}
                                    onChange={(e) => setQuotaPolicy(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded p-1.5 text-xs text-zinc-200"
                                >
                                    <option value="TRIM_AND_THROTTLE">Trim RAM (EmptyWorkingSet) + Throttle Priority to IDLE</option>
                                    <option value="SUSPEND_ON_BREACH">Auto Suspend Process on Quota Breach</option>
                                    <option value="TERMINATE_ON_BREACH">Terminate Process on Severe Memory Leak</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                            <button
                                onClick={() => setQuotaProc(null)}
                                className="px-3 py-1.5 rounded text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveQuota}
                                className="px-4 py-1.5 rounded text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-colors cursor-pointer"
                            >
                                Apply Quota
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Xác Nhận Hủy Tiến Trình (Confirm Kill Modal) */}
            {confirmKill && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-zinc-900 border border-rose-800/80 rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4 text-xs text-zinc-300">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                            <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span>Terminate Process Confirmation</span>
                            </div>
                            <button
                                onClick={() => setConfirmKill(null)}
                                className="text-zinc-500 hover:text-zinc-200 p-1 cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-3 font-sans">
                            <p className="text-zinc-200 text-xs leading-relaxed">
                                Are you sure you want to send a termination signal to this process? Any unsaved work in the target service may be lost.
                            </p>

                            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 space-y-1.5 font-mono text-xs">
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Process Name:</span>
                                    <span className="text-zinc-100 font-bold">{confirmKill.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">PID:</span>
                                    <span className="text-zinc-300">{confirmKill.pid}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">RAM Allocation:</span>
                                    <span className="text-blue-400">{confirmKill.memoryMb} MB</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">CPU Usage:</span>
                                    <span className="text-emerald-400">{confirmKill.cpuPercent}%</span>
                                </div>
                            </div>

                            {/* Lựa chọn tín hiệu kết thúc: Graceful hoặc Force Kill */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] text-zinc-400 font-medium">Select Signal Type:</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setConfirmKill({ ...confirmKill, action: 'terminate' })}
                                        className={`px-3 py-2 rounded-lg border text-left cursor-pointer transition-all ${
                                            confirmKill.action === 'terminate'
                                                ? 'bg-rose-950/70 border-rose-500 text-rose-200'
                                                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-850'
                                        }`}
                                    >
                                        <div className="font-semibold text-xs">Terminate (SIGTERM)</div>
                                        <div className="text-[10px] text-zinc-500 mt-0.5">Graceful shutdown request</div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setConfirmKill({ ...confirmKill, action: 'kill' })}
                                        className={`px-3 py-2 rounded-lg border text-left cursor-pointer transition-all ${
                                            confirmKill.action === 'kill'
                                                ? 'bg-rose-950/70 border-rose-500 text-rose-200'
                                                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-850'
                                        }`}
                                    >
                                        <div className="font-semibold text-xs">Force Kill (SIGKILL)</div>
                                        <div className="text-[10px] text-zinc-500 mt-0.5">Immediate OS termination</div>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                            <button
                                onClick={() => setConfirmKill(null)}
                                disabled={isKilling}
                                className="px-3.5 py-1.5 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmKill}
                                disabled={isKilling}
                                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-rose-700 hover:bg-rose-600 text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-rose-950/60 disabled:opacity-50"
                            >
                                <Skull className="w-3.5 h-3.5" />
                                <span>{isKilling ? 'Terminating...' : `Confirm ${confirmKill.action.toUpperCase()}`}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Chi Tiết Mạng Của Tiến Trình */}
            {inspectNetProc && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden text-xs text-zinc-300">
                        <div className="px-4 py-3 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-blue-400" />
                                <span className="font-semibold text-sm text-zinc-100">
                                    Network Sockets: {inspectNetProc.name} [PID {inspectNetProc.pid}]
                                </span>
                            </div>
                            <button
                                onClick={() => setInspectNetProc(null)}
                                className="text-zinc-400 hover:text-zinc-200 p-1 cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-4 space-y-3 overflow-y-auto flex-1 font-mono">
                            <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 text-[10px]">
                                        <tr>
                                            <th className="py-2 px-3">PROTO</th>
                                            <th className="py-2 px-3">LOCAL</th>
                                            <th className="py-2 px-3">REMOTE HOST</th>
                                            <th className="py-2 px-3">REMOTE IP:PORT</th>
                                            <th className="py-2 px-3">STATUS</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/60 text-[11px]">
                                        {inspectNetProc.outbound_connections.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-6 text-center text-zinc-500 font-sans">
                                                    No active socket connections found for this process.
                                                </td>
                                            </tr>
                                        ) : (
                                            inspectNetProc.outbound_connections.map((c, idx) => (
                                                <tr key={idx} className="hover:bg-zinc-900/60">
                                                    <td className="py-2 px-3 text-cyan-400 font-semibold">{c.protocol}</td>
                                                    <td className="py-2 px-3 text-zinc-400">
                                                        {c.local_ip}:{c.local_port}
                                                    </td>
                                                    <td className="py-2 px-3 text-zinc-200">
                                                        {c.remote_host || '-'}
                                                    </td>
                                                    <td className="py-2 px-3 text-zinc-400">
                                                        {c.remote_ip}:{c.remote_port}
                                                    </td>
                                                    <td className="py-2 px-3 text-emerald-400">{c.status}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="px-4 py-2.5 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between">
                            <span className="text-[11px] text-zinc-500">
                                Total Sockets: {inspectNetProc.total_connections}
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
