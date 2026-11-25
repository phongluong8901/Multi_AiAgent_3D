import { useState } from 'react';
import { Cpu, Radio, Pause, Play, Skull, WifiOff, ShieldCheck, Sparkles, AlertTriangle, Activity, HardDrive } from 'lucide-react';
import { Handle, Position, useNodeConnections, NodeResizer } from '@xyflow/react';
import { useTelemetryStore } from '../../../stores/useTelemetryStore';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { useWorkbenchStore } from '../../../stores/useWorkbenchStore';
import { Sparkline } from '../../../components/common/Sparkline';
import { httpClient } from '../../../services/httpClient';
import { NodeExecutionHeader, getNodeCardBorderClass } from '../components/NodeExecutionHeader';

export function ProcessNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
    const connections = useNodeConnections();
    const isConnected = connections.length > 0;
    const deleteNode = useWorkflowStore((s) => s.deleteNode);
    const openTab = useWorkbenchStore((s) => s.openTab);

    const processLookup = useTelemetryStore((s) => s.processLookup);
    const processHistory = useTelemetryStore((s) => s.processHistory);
    const addLog = useTelemetryStore((s) => s.addLog);

    const pid = Number(data.pid || 0);
    const liveProc = processLookup[pid];
    const liveHistory = processHistory[pid] || [];
    const [showConfirmKill, setShowConfirmKill] = useState(false);
    const activeExecutingNodeId = useWorkflowStore((s) => s.activeExecutingNodeId);
    const executionStatus = useWorkflowStore((s) => s.executionStatusMap[id]);
    const isExecutingThis = activeExecutingNodeId === id;

    const cpuVal = liveProc?.cpu_percent ?? data.cpu_percent ?? 0;
    const ramMb = liveProc?.memory_mb ?? data.memory_mb ?? 0;
    const status = liveProc?.status ?? data.status ?? 'active';
    const ports = liveProc?.open_ports ?? data.open_ports ?? [];

    const handleAction = async (action: 'suspend' | 'resume' | 'terminate') => {
        if (!pid) return;
        try {
            await httpClient.controlProcess(pid, action);
            addLog('ACTION', `Process Node [${data.name}] (PID ${pid}): Sent '${action.toUpperCase()}' signal`);
        } catch (err: any) {
            addLog('ALERT', `Failed to execute ${action} on PID ${pid}: ${err.message}`);
        }
    };

    const handleTrimMemory = async () => {
        if (!pid) return;
        try {
            const res = await httpClient.trimMemory(pid);
            if (res.freed) {
                addLog('ACTION', `[SYSTEM OPTIMIZER] Trimmed RAM for ${data.name} (PID ${pid}). Working Set released to OS.`);
            } else {
                addLog('INFO', `[SYSTEM OPTIMIZER] EmptyWorkingSet completed for PID ${pid}`);
            }
        } catch (err: any) {
            addLog('ALERT', `Trim RAM failed for PID ${pid}: ${err.message}`);
        }
    };

    const handleOpenProcessChart = () => {
        openTab({
            id: `tab-proc-chart-${pid || Date.now()}`,
            title: `${data.name || 'Process'} [${pid || 'Live'}] Chart`,
            type: 'process-chart',
        });
    };

    return (
        <div className="relative h-full w-full min-w-[270px] min-h-[170px]">
            {/* Thanh co giãn kích thước Node Resizer */}
            <NodeResizer
                minWidth={260}
                minHeight={160}
                isVisible={selected}
                lineClassName="!border-emerald-500 !border-dashed"
                handleClassName="!w-2.5 !h-2.5 !bg-zinc-950 !border-2 !border-emerald-500 !rounded"
            />

            <div
                className={`h-full w-full rounded-xl bg-zinc-900 border-2 shadow-2xl transition-all select-none flex flex-col justify-between overflow-hidden ${
                    getNodeCardBorderClass('START', isExecutingThis, executionStatus, isConnected, 'border-zinc-800 opacity-90')
                }`}
            >
                <Handle
                    type="target"
                    position={Position.Left}
                    className={`!w-3 !h-3 !border-2 !border-zinc-900 transition-colors ${
                        isConnected ? '!bg-cyan-400' : '!bg-zinc-600'
                    }`}
                />

                {/* Header tích hợp Live Tracer Progress & Tier START Badge */}
                <NodeExecutionHeader
                    id={id}
                    tier="START"
                    tierBadge="PROC SOURCE"
                    title={data.name || 'Process Node'}
                    subtitle={`PID: ${pid || 'N/A'}`}
                    onTitleClick={handleOpenProcessChart}
                    icon={
                        <div className="w-5 h-5 rounded bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
                            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                        </div>
                    }
                    extraRight={
                        <div
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                                isConnected
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50'
                            }`}
                        >
                            {isConnected ? (
                                <>
                                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                    <span>GUARDED</span>
                                </>
                            ) : (
                                <>
                                    <WifiOff className="w-3 h-3 text-zinc-500" />
                                    <span>STANDBY</span>
                                </>
                            )}
                        </div>
                    }
                    onDelete={() => deleteNode(id)}
                />

                {/* Thân Node */}
                <div className="p-3 space-y-2.5 text-xs flex-1 flex flex-col justify-between">
                    {isConnected ? (
                        <>
                            {/* Thông số Realtime */}
                            <div className="grid grid-cols-2 gap-2 shrink-0">
                                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800/80">
                                    <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                                        <Activity className="w-3 h-3 text-emerald-400" /> CPU
                                    </div>
                                    <div className="text-sm font-mono font-bold text-emerald-400 mt-0.5">
                                        {cpuVal.toFixed(1)}%
                                    </div>
                                </div>

                                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800/80">
                                    <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                                        <HardDrive className="w-3 h-3 text-blue-400" /> RAM
                                    </div>
                                    <div className="text-sm font-mono font-bold text-blue-400 mt-0.5">
                                        {ramMb.toFixed(0)} <span className="text-[10px] font-normal text-zinc-500">MB</span>
                                    </div>
                                </div>
                            </div>

                            {/* Live SVG Sparkline Waveform */}
                            <div className="space-y-1 flex-1 flex flex-col justify-center min-h-[36px]">
                                <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400">
                                    <span className="flex items-center gap-1">
                                        <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" /> Live Telemetry
                                    </span>
                                    <span className="text-[9px] text-zinc-500">30 samples</span>
                                </div>
                                <Sparkline
                                    data={liveHistory.length > 0 ? liveHistory : [cpuVal, cpuVal, cpuVal]}
                                    color="#10b981"
                                    height={28}
                                />
                            </div>

                            {/* Cụm điều khiển nhanh trạng thái tiến trình */}
                            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400 shrink-0">
                                <div className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    <span className="capitalize text-zinc-300 font-mono text-[10px]">{status}</span>
                                    {ports.length > 0 && (
                                        <span className="text-[9px] font-mono bg-zinc-800 text-zinc-400 px-1 py-0.2 rounded ml-1">
                                            :{ports[0]}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={handleTrimMemory}
                                        title="Trim Process Working Set RAM (Win32 EmptyWorkingSet)"
                                        className="p-1 rounded text-cyan-400 hover:text-cyan-200 hover:bg-cyan-950/80 border border-transparent hover:border-cyan-500/40 transition-all cursor-pointer"
                                    >
                                        <Sparkles className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleAction('suspend')}
                                        title="Suspend Process (Pause)"
                                        className="p-1 rounded text-amber-400 hover:text-amber-200 hover:bg-amber-950/80 border border-transparent hover:border-amber-500/40 transition-all cursor-pointer"
                                    >
                                        <Pause className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleAction('resume')}
                                        title="Resume Process"
                                        className="p-1 rounded text-emerald-400 hover:text-emerald-200 hover:bg-emerald-950/80 border border-transparent hover:border-emerald-500/40 transition-all cursor-pointer"
                                    >
                                        <Play className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => setShowConfirmKill(true)}
                                        title="Terminate Process (Requires Confirmation)"
                                        className="p-1 rounded text-rose-400 hover:text-rose-100 hover:bg-rose-950/90 border border-transparent hover:border-rose-500/60 hover:shadow-md hover:shadow-rose-950/50 transition-all cursor-pointer"
                                    >
                                        <Skull className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Inline Confirm Terminate Dialog */}
                            {showConfirmKill && (
                                <div className="mt-2 p-2 bg-rose-950/70 border border-rose-500/50 rounded-lg flex items-center justify-between gap-2 animate-in fade-in duration-100">
                                    <div className="flex items-center gap-1.5 text-rose-300 font-mono text-[10px]">
                                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                        <span>Kill PID {pid}?</span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={() => setShowConfirmKill(false)}
                                            className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                                        >
                                            No
                                        </button>
                                        <button
                                            onClick={async () => {
                                                setShowConfirmKill(false);
                                                await handleAction('terminate');
                                            }}
                                            className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-700 hover:bg-rose-600 text-white shadow-sm transition-colors cursor-pointer"
                                        >
                                            Confirm
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="py-4 px-1 text-center space-y-1.5 flex-1 flex flex-col justify-center">
                            <div className="text-[11px] text-zinc-400 font-medium">
                                Kéo dây nối node này để kích hoạt
                            </div>
                            <p className="text-[10px] text-zinc-600 font-mono">
                                Nối với Alert hoặc Action để nhận luồng telemetry thời gian thực qua WebSocket.
                            </p>
                        </div>
                    )}
                </div>

                <Handle
                    type="source"
                    position={Position.Right}
                    className={`!w-3 !h-3 !border-2 !border-zinc-900 transition-colors ${
                        isConnected ? '!bg-emerald-400' : '!bg-zinc-600'
                    }`}
                />
            </div>
        </div>
    );
}
