import { useState, useEffect } from 'react';
import {
    Activity,
    ShieldCheck,
    AlertTriangle,
    Sparkles,
    RefreshCw,
    Cpu,
    HardDrive,
    Flame,
    Zap,
    Camera,
    CheckCircle2,
} from 'lucide-react';
import { httpClient } from '../../services/httpClient';
import { useTelemetryStore } from '../../stores/useTelemetryStore';

interface HealthData {
    score: number;
    status: 'OPTIMAL' | 'HEALTHY' | 'WARNING' | 'CRITICAL';
    deductions: Array<{ factor: string; points: number; value: string }>;
    recommendations: Array<{
        id: string;
        type: string;
        title: string;
        action: string;
        suggested_action: string;
        priority: string;
        pid?: number;
        proc_name?: string;
    }>;
    summary: string;
}

export function SystemHealthAdvisorView() {
    const [health, setHealth] = useState<HealthData | null>(null);
    const [loading, setLoading] = useState(false);
    const [actionMsg, setActionMsg] = useState<string | null>(null);
    const addLog = useTelemetryStore((s) => s.addLog);
    const snapshot = useTelemetryStore((s) => s.snapshot);

    const fetchHealth = async () => {
        setLoading(true);
        try {
            const data = await httpClient.getSystemHealth();
            setHealth(data);
        } catch (err: any) {
            addLog('ALERT', `[HEALTH] Failed to fetch system health: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHealth();
        const interval = setInterval(fetchHealth, 4000);
        return () => clearInterval(interval);
    }, []);

    const handleApplyRecommendation = async (rec: HealthData['recommendations'][0]) => {
        setActionMsg(`Applying action: ${rec.title}...`);
        try {
            if (rec.suggested_action === 'trim_memory') {
                const targetPid = rec.pid || (snapshot?.processes?.[0]?.pid ?? 0);
                if (targetPid) {
                    await httpClient.trimMemory(targetPid);
                    addLog('ACTION', `[ADVISOR] Executed Win32 EmptyWorkingSet on PID ${targetPid}`);
                }
            } else if (rec.suggested_action === 'set_priority' && rec.pid) {
                await httpClient.setPriority(rec.pid, 'idle');
                addLog('ACTION', `[ADVISOR] Lowered CPU priority to IDLE for PID ${rec.pid}`);
            } else if (rec.suggested_action === 'set_affinity' && rec.pid) {
                await httpClient.setAffinity(rec.pid, [0, 1]);
                addLog('ACTION', `[ADVISOR] Bound PID ${rec.pid} to CPU Cores [0, 1]`);
            } else if (rec.suggested_action === 'suspend_pid' && rec.pid) {
                await httpClient.controlProcess(rec.pid, 'suspend');
                addLog('ACTION', `[ADVISOR] Suspended high-temperature PID ${rec.pid}`);
            }
            setActionMsg(`Successfully executed: ${rec.title}`);
            fetchHealth();
        } catch (err: any) {
            setActionMsg(`Execution failed: ${err.message}`);
            addLog('ALERT', `[ADVISOR] Action error: ${err.message}`);
        } finally {
            setTimeout(() => setActionMsg(null), 4000);
        }
    };

    const handleCaptureDiagnosticScreenshot = async () => {
        try {
            const res = await httpClient.captureScreen();
            addLog('ACTION', `[DIAGNOSTIC] Screenshot captured: ${res.filepath}`);
            setActionMsg(`Diagnostic screenshot saved: ${res.filename}`);
            setTimeout(() => setActionMsg(null), 4000);
        } catch (err: any) {
            addLog('ALERT', `[DIAGNOSTIC] Screenshot failed: ${err.message}`);
        }
    };

    const score = health?.score ?? 100;
    const scoreColor =
        score >= 85
            ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20'
            : score >= 70
            ? 'text-cyan-400 border-cyan-500/40 bg-cyan-950/20'
            : score >= 45
            ? 'text-amber-400 border-amber-500/40 bg-amber-950/20'
            : 'text-rose-400 border-rose-500/40 bg-rose-950/20';

    return (
        <div className="h-full w-full bg-zinc-950 text-zinc-100 flex flex-col overflow-y-auto select-none p-5 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div>
                    <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-emerald-400" />
                        System Health Score &amp; AI Advisor
                    </h1>
                    <p className="text-xs text-zinc-400 mt-0.5">
                        Real-time heuristic evaluation (0-100), memory leak analysis, and automated remediation actions.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleCaptureDiagnosticScreenshot}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded-lg flex items-center gap-1.5 border border-zinc-700 transition-colors cursor-pointer"
                    >
                        <Camera className="w-3.5 h-3.5 text-cyan-400" />
                        Capture Incident Frame
                    </button>

                    <button
                        onClick={fetchHealth}
                        disabled={loading}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded-lg flex items-center gap-1.5 border border-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
                        Scan Diagnostics
                    </button>
                </div>
            </div>

            {actionMsg && (
                <div className="px-4 py-2.5 rounded-lg bg-zinc-900 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{actionMsg}</span>
                </div>
            )}

            {/* Main Score & Status Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Score Card */}
                <div className={`p-5 rounded-2xl border flex flex-col justify-between items-center text-center ${scoreColor}`}>
                    <div className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">System Health Index</div>
                    <div className="my-2">
                        <span className="text-6xl font-black font-mono">{score}</span>
                        <span className="text-zinc-500 text-lg font-mono">/100</span>
                    </div>
                    <div className="px-3 py-1 rounded-full text-xs font-bold font-mono tracking-widest uppercase border border-current">
                        {health?.status || 'OPTIMAL'}
                    </div>
                </div>

                {/* Hardware Telemetry Snapshot */}
                <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between space-y-3">
                    <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-cyan-400" /> Real-time Compute State
                    </div>
                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center bg-zinc-950/60 px-3 py-2 rounded-lg border border-zinc-850">
                            <span className="text-zinc-400 flex items-center gap-1.5">
                                <Cpu className="w-3.5 h-3.5 text-emerald-400" /> CPU Load
                            </span>
                            <span className="font-mono font-bold text-zinc-100">{snapshot?.cpu.percent ?? 0}%</span>
                        </div>
                        <div className="flex justify-between items-center bg-zinc-950/60 px-3 py-2 rounded-lg border border-zinc-850">
                            <span className="text-zinc-400 flex items-center gap-1.5">
                                <HardDrive className="w-3.5 h-3.5 text-blue-400" /> RAM Used
                            </span>
                            <span className="font-mono font-bold text-zinc-100">
                                {snapshot?.ram.used_gb ?? 0} GB ({snapshot?.ram.percent ?? 0}%)
                            </span>
                        </div>
                        {snapshot?.gpus && snapshot.gpus.length > 0 && (
                            <div className="flex justify-between items-center bg-zinc-950/60 px-3 py-2 rounded-lg border border-zinc-850">
                                <span className="text-zinc-400 flex items-center gap-1.5">
                                    <Flame className="w-3.5 h-3.5 text-purple-400" /> GPU Thermal
                                </span>
                                <span className="font-mono font-bold text-zinc-100">
                                    {snapshot.gpus[0].temp_c}°C ({snapshot.gpus[0].load_percent}% load)
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Score Deductions Breakdown */}
                <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between">
                    <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-400" /> Score Deductions
                    </div>
                    <div className="space-y-1.5 mt-2 flex-1 overflow-y-auto max-h-32">
                        {health?.deductions && health.deductions.length > 0 ? (
                            health.deductions.map((d, idx) => (
                                <div
                                    key={idx}
                                    className="flex justify-between items-center text-xs px-2.5 py-1.5 rounded bg-zinc-950/50 border border-zinc-850"
                                >
                                    <span className="text-zinc-300">{d.factor}</span>
                                    <span className="font-mono text-rose-400 font-bold">{d.points} pts</span>
                                </div>
                            ))
                        ) : (
                            <div className="h-full flex items-center justify-center text-xs text-zinc-500 italic">
                                Zero performance penalties detected. System runs optimal.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* AI Advisor Recommendations */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        AI Advisor Remediation Actions ({health?.recommendations.length || 0})
                    </h2>
                    <span className="text-[11px] text-zinc-500 font-mono">One-click OS system optimizations</span>
                </div>

                {health?.recommendations && health.recommendations.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {health.recommendations.map((rec) => (
                            <div
                                key={rec.id}
                                className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all flex flex-col justify-between space-y-3"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                            {rec.title}
                                        </span>
                                        <span
                                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                                                rec.priority === 'CRITICAL'
                                                    ? 'bg-rose-950/60 text-rose-400 border-rose-500/40'
                                                    : rec.priority === 'HIGH'
                                                    ? 'bg-amber-950/60 text-amber-400 border-amber-500/40'
                                                    : 'bg-blue-950/60 text-blue-400 border-blue-500/40'
                                            }`}
                                        >
                                            {rec.priority}
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-400 leading-relaxed">{rec.action}</p>
                                </div>

                                <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                                    <span className="text-[11px] font-mono text-zinc-500">
                                        Target: {rec.proc_name ? `${rec.proc_name} [PID ${rec.pid}]` : 'System OS'}
                                    </span>
                                    <button
                                        onClick={() => handleApplyRecommendation(rec)}
                                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                        <Zap className="w-3 h-3" /> Execute Remediation
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-8 rounded-xl bg-zinc-900/40 border border-dashed border-zinc-800 text-center space-y-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                        <div className="text-xs font-semibold text-zinc-300">System Running at Peak Performance</div>
                        <div className="text-[11px] text-zinc-500">
                            No immediate memory leaks, port collisions, or thermal throttling detected.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
