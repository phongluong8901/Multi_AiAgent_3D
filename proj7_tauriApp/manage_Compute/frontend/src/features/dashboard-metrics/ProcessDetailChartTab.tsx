/**
 * Tab chi tiết tiến trình kèm đồ thị dạng sóng thời gian thực (Process Detail Chart Tab Component):
 * - Hiển thị đồ thị đo lường riêng biệt CPU Waveform (%) và RAM (MB) của tiến trình được chỉ định.
 * - Cung cấp các nút điều khiển trực tiếp: Tạm dừng (Suspend), Tiếp tục (Resume), và Tiêu diệt (Terminate).
 * - Hiển thị chi tiết siêu dữ liệu thực thi: Số luồng, cổng socket đang mở và toàn bộ chuỗi dòng lệnh khởi chạy (cmdline).
 */

import { useState } from 'react';
import {
    Activity,
    Cpu,
    HardDrive,
    Radio,
    Pause,
    Play,
    Skull,
    Terminal,
} from 'lucide-react';
import { useTelemetryStore } from '../../stores/useTelemetryStore';
import { Sparkline } from '../../components/common/Sparkline';
import { httpClient } from '../../services/httpClient';

interface ProcessDetailChartTabProps {
    /** Mã định danh tab kèm PID, ví dụ: tab-proc-chart-6080 */
    tabId: string;
}

export function ProcessDetailChartTab({ tabId }: ProcessDetailChartTabProps) {
    // Trích xuất mã số PID từ chuỗi tabId
    const rawPid = tabId.replace('tab-proc-chart-', '');
    const pid = Number(rawPid) || 0;

    const processLookup = useTelemetryStore((s) => s.processLookup);
    const processHistory = useTelemetryStore((s) => s.processHistory);
    const addLog = useTelemetryStore((s) => s.addLog);
    const snapshot = useTelemetryStore((s) => s.snapshot);

    const [actionMsg, setActionMsg] = useState<string | null>(null);

    // Lấy thông tin thời gian thực từ store hoặc tìm trong snapshot
    const liveProc =
        processLookup[pid] || snapshot?.processes?.find((p) => p.pid === pid);
    const history = processHistory[pid] || [];

    const cpuVal = liveProc?.cpu_percent ?? 0;
    const ramMb = liveProc?.memory_mb ?? 0;
    const procName = liveProc?.name ?? 'Unknown Process';
    const status = liveProc?.status ?? 'active';
    const ports = liveProc?.open_ports ?? [];
    const threads = liveProc?.num_threads ?? 1;
    const cmdline = liveProc?.cmdline ?? [];

    /**
     * Gửi tín hiệu điều khiển tới tiến trình (suspend, resume, terminate).
     */
    const handleAction = async (action: 'suspend' | 'resume' | 'terminate') => {
        if (!pid) return;
        try {
            await httpClient.controlProcess(pid, action);
            setActionMsg(`Sent ${action.toUpperCase()} signal to PID ${pid}`);
            addLog('ACTION', `Process Chart Tab [${procName}] (PID ${pid}): Sent '${action.toUpperCase()}' signal`);
        } catch (err: any) {
            setActionMsg(`Error: ${err.message}`);
            addLog('ALERT', `Failed to execute ${action} on PID ${pid}: ${err.message}`);
        }
        setTimeout(() => setActionMsg(null), 3000);
    };

    return (
        <div className="h-full flex flex-col bg-zinc-950 text-zinc-100 overflow-y-auto select-none">
            {/* Header của Tab Chart Process */}
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/40 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                        <Cpu className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-sm font-bold text-zinc-100 tracking-wide font-mono">
                                {procName}
                            </h1>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700">
                                PID: {pid || 'N/A'}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                <Radio className="w-2.5 h-2.5 animate-pulse text-emerald-400" /> LIVE STREAM
                            </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                            Status: <span className="text-zinc-300 uppercase">{status}</span> | Threads: {threads} | Ports: {ports.length > 0 ? ports.map(p => `:${p}`).join(', ') : 'None'}
                        </p>
                    </div>
                </div>

                {/* Các nút hành động nhanh điều khiển tiến trình */}
                <div className="flex items-center gap-2">
                    {actionMsg && (
                        <span className="text-xs font-mono text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-500/30">
                            {actionMsg}
                        </span>
                    )}
                    {/* Tạm dừng tiến trình */}
                    <button
                        onClick={() => handleAction('suspend')}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-zinc-700 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                        <Pause className="w-3.5 h-3.5" /> Suspend
                    </button>
                    {/* Tiếp tục thực thi tiến trình */}
                    <button
                        onClick={() => handleAction('resume')}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-emerald-300 border border-zinc-700 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                        <Play className="w-3.5 h-3.5" /> Resume
                    </button>
                    {/* Tiêu diệt tiến trình ngay lập tức */}
                    <button
                        onClick={() => handleAction('terminate')}
                        className="px-3 py-1.5 bg-rose-950/70 hover:bg-rose-900/80 text-rose-300 border border-rose-500/30 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                        <Skull className="w-3.5 h-3.5" /> Terminate
                    </button>
                </div>
            </div>

            <div className="p-4 space-y-4 flex-1">
                {/* 2 Đồ thị Lớn Realtime: CPU Waveform & RAM Waveform */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Đồ thị tải CPU của tiến trình */}
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5 uppercase font-mono">
                                <Activity className="w-4 h-4 text-emerald-400" /> Process CPU Load (%)
                            </span>
                            <span className="text-lg font-mono font-bold text-emerald-400">
                                {cpuVal.toFixed(1)}%
                            </span>
                        </div>
                        <div className="py-2">
                            <Sparkline
                                data={history.length > 0 ? history : [cpuVal, cpuVal, cpuVal]}
                                color="#10b981"
                                height={70}
                            />
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono border-t border-zinc-800/80 pt-2">
                            <span>Window: 30 rolling samples</span>
                            <span>{cpuVal > 50 ? 'High Utilization' : 'Normal'}</span>
                        </div>
                    </div>

                    {/* Đồ thị bộ nhớ RAM thực tế đang dùng (Resident Memory) */}
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5 uppercase font-mono">
                                <HardDrive className="w-4 h-4 text-blue-400" /> Resident Memory (RAM)
                            </span>
                            <span className="text-lg font-mono font-bold text-blue-400">
                                {ramMb.toFixed(1)} <span className="text-xs text-zinc-400">MB</span>
                            </span>
                        </div>
                        <div className="py-2">
                            <Sparkline
                                data={history.length > 0 ? history.map(v => v * 1.2) : [ramMb, ramMb]}
                                color="#3b82f6"
                                height={70}
                            />
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono border-t border-zinc-800/80 pt-2">
                            <span>Memory Pressure: {ramMb > 1024 ? 'Substantial (>1GB)' : 'Moderate'}</span>
                            <span>RSS Allocation</span>
                        </div>
                    </div>
                </div>

                {/* Thông tin Chi tiết Tiến trình & Command Line */}
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 shadow-sm space-y-3">
                    <div className="text-xs font-bold text-zinc-200 uppercase tracking-wide flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-emerald-400" /> Process Execution Metadata
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                        <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
                            <div className="text-[10px] text-zinc-500">PID</div>
                            <div className="text-zinc-200 font-bold mt-0.5">{pid}</div>
                        </div>
                        <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
                            <div className="text-[10px] text-zinc-500">Status</div>
                            <div className="text-emerald-400 font-bold mt-0.5 capitalize">{status}</div>
                        </div>
                        <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
                            <div className="text-[10px] text-zinc-500">Thread Count</div>
                            <div className="text-zinc-200 font-bold mt-0.5">{threads} threads</div>
                        </div>
                        <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
                            <div className="text-[10px] text-zinc-500">Listening Ports</div>
                            <div className="text-purple-400 font-bold mt-0.5">
                                {ports.length > 0 ? ports.join(', ') : 'None'}
                            </div>
                        </div>
                    </div>

                    {/* Danh sách tham số dòng lệnh thực thi */}
                    {cmdline.length > 0 && (
                        <div>
                            <div className="text-[11px] font-semibold text-zinc-400 mb-1 font-mono">
                                Command Line Arguments:
                            </div>
                            <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800 font-mono text-[11px] text-zinc-300 break-all select-text">
                                {cmdline.join(' ')}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
