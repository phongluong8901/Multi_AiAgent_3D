import { useState, useEffect } from 'react';
import {
    Activity,
    Cpu,
    ShieldCheck,
    ShieldAlert,
    Flame,
    Zap,
    Workflow,
    ArrowUpRight,
    RefreshCw,
} from 'lucide-react';
import { useTelemetryStore } from '../../stores/useTelemetryStore';
import { useWorkflowStore } from '../../stores/useWorkflowStore';
import { useWorkbenchStore } from '../../stores/useWorkbenchStore';
import { Sparkline } from '../../components/common/Sparkline';
import { httpClient, type GuardStatus } from '../../services/httpClient';

export function DashboardMetricsView() {
    const snapshot = useTelemetryStore((s) => s.snapshot);
    const cpuHistory = useTelemetryStore((s) => s.cpuHistory);
    const ramHistory = useTelemetryStore((s) => s.ramHistory);
    const gpuHistory = useTelemetryStore((s) => s.gpuHistory);
    const addLog = useTelemetryStore((s) => s.addLog);

    const openTab = useWorkbenchStore((s) => s.openTab);
    const setNodes = useWorkflowStore((s) => s.setNodes);
    const guardArmed = useWorkflowStore((s) => s.guardArmed);
    const setGuardArmed = useWorkflowStore((s) => s.setGuardArmed);

    const [guardStatus, setGuardStatus] = useState<GuardStatus | null>(null);

    const fetchGuard = async () => {
        try {
            const res = await httpClient.getGuardStatus();
            setGuardStatus(res);
            setGuardArmed(res.guard_armed);
        } catch {
            // Ignore when offline/initializing
        }
    };

    useEffect(() => {
        fetchGuard();
        const interval = setInterval(fetchGuard, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleToggleGuard = async () => {
        try {
            const res = await httpClient.toggleGuard();
            setGuardArmed(res.guard_armed);
            fetchGuard();
            addLog(
                'ACTION',
                `[AUTOGUARD] Protection status toggled to: ${res.guard_armed ? 'ARMED' : 'DISARMED'}`
            );
        } catch (e: any) {
            addLog('ALERT', `Failed to toggle guard: ${e.message}`);
        }
    };

    // Nút tắt đưa nhanh 1 tiến trình vào Auto-Guard Canvas
    const handleProtectProcess = (proc: any) => {
        const id = `proc-${Date.now()}`;
        setNodes((nds) => [
            ...nds,
            {
                id,
                type: 'process_node',
                position: { x: 380, y: nds.length * 80 + 60 },
                data: {
                    pid: proc.pid,
                    name: proc.name,
                    cpu_percent: proc.cpu_percent,
                    memory_mb: proc.memory_mb,
                    open_ports: proc.open_ports,
                    status: proc.status,
                },
            },
        ]);
        addLog('INFO', `[AUTOGUARD] Process [${proc.name}] (PID ${proc.pid}) injected into Auto-Guard Canvas.`);
        openTab({ id: 'tab-canvas-1', title: 'Auto-Guard GPU Pipeline', type: 'workflow-canvas' });
    };

    const cpuPercent = snapshot?.cpu?.percent ?? 0;
    const ramPercent = snapshot?.ram?.percent ?? 0;
    const ramUsedGb = snapshot?.ram?.used_gb ?? 0;
    const ramTotalGb = snapshot?.ram?.total_gb ?? 0;
    const primaryGpu = snapshot?.gpus?.[0];
    const gpuTemp = primaryGpu?.temp_c ?? 0;
    const gpuVramPercent = primaryGpu?.memory_percent ?? 0;
    const diskFreeGb = snapshot?.io?.disk_free_gb ?? 0;
    const processes = snapshot?.processes || [];

    return (
        <div className="h-full flex flex-col bg-zinc-950 text-zinc-100 overflow-y-auto select-none">
            {/* Header Dashboard */}
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/40 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                        <Activity className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-zinc-100 tracking-wide">
                            Compute & Telemetry Dashboard
                        </h1>
                        <p className="text-[11px] text-zinc-500 font-mono">
                            Realtime hardware metrics, GPU thermal watch & Auto-Guard status
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleToggleGuard}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all ${
                            guardArmed
                                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/80'
                                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                        }`}
                    >
                        {guardArmed ? (
                            <>
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                                <span>AUTOGUARD ARMED</span>
                            </>
                        ) : (
                            <>
                                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                                <span>GUARD DISARMED</span>
                            </>
                        )}
                    </button>

                    <button
                        onClick={() =>
                            openTab({
                                id: 'tab-canvas-1',
                                title: 'Auto-Guard GPU Pipeline',
                                type: 'workflow-canvas',
                            })
                        }
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                        <Workflow className="w-3.5 h-3.5 text-emerald-400" /> Open Guard Canvas
                    </button>

                    <button
                        onClick={fetchGuard}
                        title="Refresh metrics"
                        className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="p-4 space-y-4 flex-1">
                {/* 4 Khối Telemetry KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Card 1: CPU */}
                    <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5 uppercase tracking-wider">
                                <Cpu className="w-3.5 h-3.5 text-emerald-400" /> CPU Load
                            </span>
                            <span className="text-xs font-mono font-bold text-emerald-400">{cpuPercent}%</span>
                        </div>
                        <div className="mb-2">
                            <Sparkline data={cpuHistory} color="#10b981" height={36} />
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono flex justify-between border-t border-zinc-800/80 pt-1.5">
                            <span>Cores: {snapshot?.cpu?.logical_cores || 'N/A'}</span>
                            <span>{cpuPercent > 80 ? 'Heavy Load' : 'Normal'}</span>
                        </div>
                    </div>

                    {/* Card 2: RAM */}
                    <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5 uppercase tracking-wider">
                                <Activity className="w-3.5 h-3.5 text-blue-400" /> System RAM
                            </span>
                            <span className="text-xs font-mono font-bold text-blue-400">{ramPercent}%</span>
                        </div>
                        <div className="mb-2">
                            <Sparkline data={ramHistory} color="#3b82f6" height={36} />
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono flex justify-between border-t border-zinc-800/80 pt-1.5">
                            <span>Used: {ramUsedGb.toFixed(1)}GB</span>
                            <span>Total: {ramTotalGb.toFixed(0)}GB</span>
                        </div>
                    </div>

                    {/* Card 3: GPU Thermal & VRAM */}
                    <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5 uppercase tracking-wider">
                                <Flame className="w-3.5 h-3.5 text-purple-400" /> GPU Thermal
                            </span>
                            <span className="text-xs font-mono font-bold text-purple-400">{gpuTemp}°C</span>
                        </div>
                        <div className="mb-2">
                            <Sparkline data={gpuHistory} color="#a855f7" height={36} />
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono flex justify-between border-t border-zinc-800/80 pt-1.5">
                            <span>VRAM: {gpuVramPercent}%</span>
                            <span>{gpuTemp >= 80 ? 'THROTTLING' : 'OPTIMAL'}</span>
                        </div>
                    </div>

                    {/* Card 4: Auto-Guard Watchdog State */}
                    <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5 uppercase tracking-wider">
                                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Guard Interventions
                            </span>
                            <span className="text-xs font-mono font-bold text-amber-400">
                                {guardStatus?.interventions_count ?? 0}
                            </span>
                        </div>
                        <div className="py-2 space-y-1">
                            <div className="text-xs font-medium text-zinc-200">
                                {guardArmed ? 'Active Auto-Protection' : 'Protection Paused'}
                            </div>
                            <div className="text-[10px] text-zinc-500 font-mono">
                                Watchdog Cooldown: 5.0s window
                            </div>
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono flex justify-between border-t border-zinc-800/80 pt-1.5">
                            <span>Disk Free: {diskFreeGb.toFixed(0)}GB</span>
                            <span className="text-emerald-400 font-semibold">Active</span>
                        </div>
                    </div>
                </div>

                {/* Phần Bảng Top Tiến Trình & Khả năng Bảo Vệ Nhanh */}
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-bold text-zinc-100 uppercase tracking-wide">
                                Active Processes & Guard Enrollment
                            </span>
                        </div>
                        <span className="text-[11px] text-zinc-500 font-mono">
                            Bấm "Guard" để đưa tiến trình vào canvas bảo vệ tức thì
                        </span>
                    </div>

                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-zinc-950 text-zinc-400 font-mono text-[10px] uppercase border-b border-zinc-800 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-2">PID</th>
                                    <th className="px-4 py-2">Process Name</th>
                                    <th className="px-4 py-2">Status</th>
                                    <th className="px-4 py-2">CPU Load</th>
                                    <th className="px-4 py-2">RAM Usage</th>
                                    <th className="px-4 py-2 text-right">Protection Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50 font-mono text-[11px]">
                                {processes.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-zinc-500 italic">
                                            Scanning system processes...
                                        </td>
                                    </tr>
                                ) : (
                                    processes.slice(0, 15).map((proc) => (
                                        <tr key={proc.pid} className="hover:bg-zinc-800/40 transition-colors">
                                            <td className="px-4 py-2 text-zinc-400">{proc.pid}</td>
                                            <td className="px-4 py-2 font-medium text-zinc-200">
                                                {proc.name}
                                            </td>
                                            <td className="px-4 py-2">
                                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                    {proc.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-emerald-400 font-semibold">
                                                {proc.cpu_percent}%
                                            </td>
                                            <td className="px-4 py-2 text-blue-400 font-semibold">
                                                {proc.memory_mb.toFixed(1)} MB
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                <button
                                                    onClick={() => handleProtectProcess(proc)}
                                                    className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded text-[10px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                                                >
                                                    <ShieldCheck className="w-3 h-3" /> + Guard In Canvas
                                                    <ArrowUpRight className="w-2.5 h-2.5 opacity-60" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

