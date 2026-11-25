import { useState } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import {
    Cpu,
    HardDrive,
    Sliders,
    Zap,
    CheckCircle2,
    Shield,
    RotateCcw,
    Layers,
    Activity,
} from 'lucide-react';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { useTelemetryStore } from '../../../stores/useTelemetryStore';
import { httpClient } from '../../../services/httpClient';
import { findConnectedProcess } from '../utils/flowGraphUtils';
import { NodeExecutionHeader, getNodeCardBorderClass } from '../components/NodeExecutionHeader';

export function ResourceQuotaNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
    const deleteNode = useWorkflowStore((s) => s.deleteNode);
    const nodes = useWorkflowStore((s) => s.nodes);
    const edges = useWorkflowStore((s) => s.edges);
    const activeExecutingNodeId = useWorkflowStore((s) => s.activeExecutingNodeId);
    const executionStatus = useWorkflowStore((s) => s.executionStatusMap[id]);
    const addLog = useTelemetryStore((s) => s.addLog);
    const snapshot = useTelemetryStore((s) => s.snapshot);
    const processLookup = useTelemetryStore((s) => s.processLookup);

    // Tìm tiến trình kết nối từ đồ thị
    const connectedProc = findConnectedProcess(id, nodes, edges);
    const targetPid = connectedProc?.pid ?? (data.pid ? Number(data.pid) : null);
    const targetName = connectedProc?.name ?? data.name ?? 'Target Process';
    const liveProc = targetPid ? processLookup[targetPid] : null;

    const isExecutingThis = activeExecutingNodeId === id;

    const totalCores = snapshot?.cpu.logical_cores || 8;
    const defaultCores = data.cores || [0, 1];

    const [selectedCores, setSelectedCores] = useState<number[]>(defaultCores);
    const [maxRamMb, setMaxRamMb] = useState<number>(Number(data.max_ram_mb || 2048));
    const [maxCpuPercent, setMaxCpuPercent] = useState<number>(Number(data.max_cpu_percent || 40));
    const [gpuIndex, setGpuIndex] = useState<number | string>(data.gpu_index ?? 0);
    const [policy, setPolicy] = useState<string>(data.policy || 'TRIM_AND_THROTTLE');
    const [statusMsg, setStatusMsg] = useState<string | null>(null);
    const [isApplying, setIsApplying] = useState(false);

    const assignedGpu = snapshot?.gpus?.find((g) => g.id === Number(gpuIndex));
    const gpuInfoText =
        gpuIndex === 'all'
            ? 'All GPUs (CUDA: 0, 1...)'
            : assignedGpu
            ? `${assignedGpu.name} (${assignedGpu.temp_c}°C | ${assignedGpu.memory_used_mb}MB)`
            : `GPU ${gpuIndex} (Dedicated Device)`;

    // Đồng bộ data vào node cho workflow DAG runner
    data.action_type = 'apply_quota';
    data.cores = selectedCores;
    data.max_ram_mb = maxRamMb;
    data.max_cpu_percent = maxCpuPercent;
    data.gpu_index = gpuIndex === 'all' ? null : Number(gpuIndex);
    data.policy = policy;
    if (targetPid) {
        data.pid = targetPid;
        data.proc_name = targetName;
    }

    const toggleCore = (coreIdx: number) => {
        let updated: number[];
        if (selectedCores.includes(coreIdx)) {
            if (selectedCores.length === 1) return; // Luôn giữ ít nhất 1 core
            updated = selectedCores.filter((c) => c !== coreIdx);
        } else {
            updated = [...selectedCores, coreIdx].sort((a, b) => a - b);
        }
        setSelectedCores(updated);
    };

    const handleApplyQuotaNow = async () => {
        if (!targetPid) {
            setStatusMsg('Please connect or select a process PID');
            setTimeout(() => setStatusMsg(null), 3000);
            return;
        }

        setIsApplying(true);
        try {
            await httpClient.applyResourceQuota(targetPid, {
                cores: selectedCores,
                max_ram_mb: maxRamMb,
                max_cpu_percent: maxCpuPercent,
                gpu_index: gpuIndex === 'all' ? undefined : Number(gpuIndex),
                policy,
            });

            addLog(
                'ACTION',
                `[QUOTA] Enforced quota on ${targetName} [PID ${targetPid}]: Cores ${JSON.stringify(selectedCores)}, RAM max ${maxRamMb}MB, CPU max ${maxCpuPercent}%`
            );
            setStatusMsg(`Quota enforced successfully on PID ${targetPid}`);
        } catch (err: any) {
            addLog('ALERT', `[QUOTA] Failed to apply quota: ${err.message}`);
            setStatusMsg(`Error: ${err.message}`);
        } finally {
            setIsApplying(false);
            setTimeout(() => setStatusMsg(null), 4000);
        }
    };

    const handleRemoveQuota = async () => {
        if (!targetPid) return;
        try {
            await httpClient.removeResourceQuota(targetPid);
            addLog('INFO', `[QUOTA] Removed all resource limits for ${targetName} [PID ${targetPid}]. Restored normal.`);
            setStatusMsg(`Limits cleared for PID ${targetPid}`);
        } catch (err: any) {
            addLog('ALERT', `[QUOTA] Error removing quota: ${err.message}`);
        } finally {
            setTimeout(() => setStatusMsg(null), 3000);
        }
    };

    return (
        <div className="relative h-full w-full min-w-[320px] min-h-[380px]">
            <NodeResizer
                minWidth={310}
                minHeight={370}
                isVisible={selected}
                lineClassName="!border-emerald-500 !border-dashed"
                handleClassName="!w-2.5 !h-2.5 !bg-zinc-950 !border-2 !border-emerald-500 !rounded"
            />

            <div
                className={`h-full w-full rounded-xl bg-zinc-900 border-2 transition-all select-none flex flex-col justify-between overflow-hidden shadow-2xl ${
                    getNodeCardBorderClass('MIDDLE', isExecutingThis, executionStatus, !!connectedProc, 'border-emerald-500/40 shadow-emerald-950/20 hover:border-emerald-500')
                }`}
            >
                <Handle
                    type="target"
                    position={Position.Left}
                    className="!w-3 !h-3 !bg-amber-400 !border-2 !border-zinc-900"
                />

                {/* Header tích hợp Live Tracer Progress & Tier MIDDLE Badge */}
                <NodeExecutionHeader
                    id={id}
                    tier="MIDDLE"
                    tierBadge="SANDBOX"
                    title="Resource Quota Sandbox"
                    subtitle={targetPid ? `Target: PID ${targetPid}` : 'Target Process'}
                    icon={<Shield className="w-4 h-4 text-emerald-400" />}
                    extraRight={
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            QUOTA JAIL
                        </span>
                    }
                    onDelete={() => deleteNode(id)}
                />

                {/* Body Content */}
                <div className="p-3 space-y-3 flex-1 overflow-y-auto text-xs">
                    {/* Process Target Badge */}
                    <div className="p-2 rounded-lg bg-zinc-950/70 border border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-emerald-400 shrink-0" />
                            <div className="truncate max-w-[170px]">
                                <div className="font-semibold text-zinc-200 truncate">{targetName}</div>
                                <div className="text-[10px] text-zinc-500 font-mono">
                                    {targetPid ? `PID: ${targetPid}` : 'Connect a ProcessNode to bind'}
                                </div>
                            </div>
                        </div>

                        {liveProc && (
                            <div className="text-right font-mono text-[10px]">
                                <div className="text-emerald-400 font-bold">{liveProc.memory_mb.toFixed(0)} MB</div>
                                <div className="text-zinc-400">{liveProc.cpu_percent.toFixed(1)}% CPU</div>
                            </div>
                        )}
                    </div>

                    {/* Live Hardware Allocation & Realtime Consumption Gauge */}
                    <div className="p-2.5 rounded-lg bg-zinc-950/90 border border-emerald-500/30 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                                <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
                                <span>Active Resource Allocation</span>
                            </span>
                            <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                                    targetPid
                                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                        : 'bg-zinc-800 text-zinc-400'
                                }`}
                            >
                                {targetPid ? `BOUND TO PID ${targetPid}` : 'STANDBY'}
                            </span>
                        </div>

                        {/* Cores Allocation & Realtime Load */}
                        <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="text-zinc-400 flex items-center gap-1">
                                    <Cpu className="w-3 h-3 text-cyan-400" /> Active CPU Cores:
                                </span>
                                <span className="font-mono text-cyan-300 font-bold">
                                    {selectedCores.map((c) => `C${c}`).join(', ')} ({liveProc ? `${liveProc.cpu_percent.toFixed(1)}%` : '0%'} / Cap {maxCpuPercent}%)
                                </span>
                            </div>
                            <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-300 ${
                                        (liveProc?.cpu_percent ?? 0) > maxCpuPercent ? 'bg-rose-500' : 'bg-cyan-400'
                                    }`}
                                    style={{
                                        width: `${Math.min(100, ((liveProc?.cpu_percent ?? 0) / maxCpuPercent) * 100)}%`,
                                    }}
                                />
                            </div>
                        </div>

                        {/* RAM Allocation & Realtime Consumption */}
                        <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="text-zinc-400 flex items-center gap-1">
                                    <HardDrive className="w-3 h-3 text-blue-400" /> Current RAM Used:
                                </span>
                                <span className="font-mono text-blue-300 font-bold">
                                    {liveProc ? `${liveProc.memory_mb.toFixed(0)} MB` : '0 MB'} / {maxRamMb} MB (
                                    {liveProc ? Math.round((liveProc.memory_mb / maxRamMb) * 100) : 0}%)
                                </span>
                            </div>
                            <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-300 ${
                                        (liveProc?.memory_mb ?? 0) > maxRamMb
                                            ? 'bg-rose-500'
                                            : (liveProc?.memory_mb ?? 0) > maxRamMb * 0.8
                                            ? 'bg-amber-400'
                                            : 'bg-emerald-400'
                                    }`}
                                    style={{
                                        width: `${Math.min(
                                            100,
                                            ((liveProc?.memory_mb ?? 0) / maxRamMb) * 100
                                        )}%`,
                                    }}
                                />
                            </div>
                        </div>

                        {/* GPU Device Allocation */}
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-zinc-900">
                            <span className="text-zinc-400 flex items-center gap-1">
                                <Layers className="w-3 h-3 text-purple-400" /> GPU Allocation:
                            </span>
                            <span className="font-mono text-purple-300 truncate max-w-[170px]" title={gpuInfoText}>
                                {gpuInfoText}
                            </span>
                        </div>
                    </div>

                    {/* 1. CPU Core Affinity Checklist */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-zinc-400">
                            <span className="flex items-center gap-1.5 font-medium">
                                <Cpu className="w-3.5 h-3.5 text-cyan-400" /> Dedicated CPU Cores:
                            </span>
                            <span className="font-mono text-cyan-300 font-bold text-[11px]">
                                {selectedCores.length}/{totalCores} Cores
                            </span>
                        </div>

                        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1">
                            {Array.from({ length: Math.min(16, totalCores) }, (_, i) => {
                                const isSelected = selectedCores.includes(i);
                                return (
                                    <button
                                        key={i}
                                        onClick={() => toggleCore(i)}
                                        className={`py-1 text-center font-mono text-[10px] font-bold rounded border transition-colors cursor-pointer ${
                                            isSelected
                                                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/60 shadow-sm'
                                                : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:border-zinc-700'
                                        }`}
                                    >
                                        C{i}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 2. RAM Quota Cap (MB) */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-zinc-400">
                            <span className="flex items-center gap-1.5 font-medium">
                                <HardDrive className="w-3.5 h-3.5 text-blue-400" /> Max RAM Cap:
                            </span>
                            <span className="font-mono text-blue-300 font-bold">{maxRamMb} MB</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min={256}
                                max={8192}
                                step={256}
                                value={maxRamMb}
                                onChange={(e) => setMaxRamMb(Number(e.target.value))}
                                className="w-full accent-blue-500 cursor-pointer"
                            />
                            <input
                                type="number"
                                min={128}
                                max={65536}
                                value={maxRamMb}
                                onChange={(e) => setMaxRamMb(Number(e.target.value))}
                                className="w-20 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 font-mono text-right text-zinc-200 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* 3. Max CPU Rate Limit (%) & GPU Assignment */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label className="text-[11px] text-zinc-400 flex items-center gap-1">
                                <Sliders className="w-3 h-3 text-emerald-400" /> Max CPU %:
                            </label>
                            <input
                                type="number"
                                min={5}
                                max={100}
                                value={maxCpuPercent}
                                onChange={(e) => setMaxCpuPercent(Number(e.target.value))}
                                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 font-mono text-zinc-200 text-xs focus:outline-none focus:border-emerald-500"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] text-zinc-400 flex items-center gap-1">
                                <Layers className="w-3 h-3 text-purple-400" /> GPU Device:
                            </label>
                            <select
                                value={gpuIndex}
                                onChange={(e) => setGpuIndex(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-purple-500 cursor-pointer"
                            >
                                <option value="0">GPU 0 (Primary)</option>
                                <option value="1">GPU 1 (Secondary)</option>
                                <option value="all">All Available</option>
                            </select>
                        </div>
                    </div>

                    {/* 4. Violation Enforcement Policy */}
                    <div className="space-y-1">
                        <label className="text-[11px] text-zinc-400">On Quota Breach Policy:</label>
                        <select
                            value={policy}
                            onChange={(e) => setPolicy(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer font-medium"
                        >
                            <option value="TRIM_AND_THROTTLE">Win32 EmptyWorkingSet Trim + IDLE Priority</option>
                            <option value="SUSPEND">Suspend Process (Tạm dừng khi vượt ngưỡng)</option>
                            <option value="KILL">Terminate Process (Cưỡng chế dừng)</option>
                            <option value="LOG_ONLY">Log Alert &amp; Notify Only</option>
                        </select>
                    </div>

                    {statusMsg && (
                        <div className="p-1.5 rounded bg-zinc-950 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="truncate">{statusMsg}</span>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-2.5 bg-zinc-950/70 border-t border-zinc-800 flex items-center justify-between gap-2 shrink-0">
                    <button
                        onClick={handleRemoveQuota}
                        disabled={!targetPid}
                        className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs rounded-lg flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40"
                        title="Hủy bỏ giới hạn và trả lại toàn bộ tài nguyên"
                    >
                        <RotateCcw className="w-3 h-3" />
                        <span>Clear</span>
                    </button>

                    <button
                        onClick={handleApplyQuotaNow}
                        disabled={isApplying || !targetPid}
                        className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md disabled:opacity-40"
                    >
                        <Zap className="w-3.5 h-3.5" />
                        <span>{isApplying ? 'Applying...' : 'Enforce Quota Now'}</span>
                    </button>
                </div>

                <Handle
                    type="source"
                    position={Position.Right}
                    className="!w-3 !h-3 !bg-emerald-400 !border-2 !border-zinc-900"
                />
            </div>
        </div>
    );
}
