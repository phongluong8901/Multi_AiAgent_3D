import { useState, useEffect } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { Clock, Play, Sliders, Calendar, CheckCircle2 } from 'lucide-react';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { useTelemetryStore } from '../../../stores/useTelemetryStore';
import { httpClient } from '../../../services/httpClient';
import { NodeExecutionHeader, getNodeCardBorderClass } from '../components/NodeExecutionHeader';

export function ScheduleTriggerNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
    const deleteNode = useWorkflowStore((s) => s.deleteNode);
    const isDeployed = useWorkflowStore((s) => s.isDeployed);
    const activeExecutingNodeId = useWorkflowStore((s) => s.activeExecutingNodeId);
    const executionStatus = useWorkflowStore((s) => s.executionStatusMap[id]);
    const addLog = useTelemetryStore((s) => s.addLog);

    const isExecuting = activeExecutingNodeId === id;

    const [intervalSec, setIntervalSec] = useState<number>(Number(data.interval_sec || 2.0));
    const [mode, setMode] = useState<'interval' | 'cron'>(data.mode || 'interval');
    const [cronExpr, setCronExpr] = useState<string>(data.cron_expr || '*/5 * * * *');
    const [lastTriggerTime, setLastTriggerTime] = useState<string>('Not triggered');
    const [isTriggering, setIsTriggering] = useState(false);

    // Đồng bộ lại data prop
    data.interval_sec = intervalSec;
    data.mode = mode;
    data.cron_expr = cronExpr;

    // Hiệu ứng nhịp đập tick khi Scheduler đang deployed
    const [pulse, setPulse] = useState(false);
    useEffect(() => {
        if (!isDeployed) return;
        const timer = setInterval(() => {
            setPulse((p) => !p);
        }, Math.max(800, intervalSec * 1000));
        return () => clearInterval(timer);
    }, [isDeployed, intervalSec]);

    const handleManualTick = async () => {
        setIsTriggering(true);
        try {
            const timeStr = new Date().toLocaleTimeString();
            setLastTriggerTime(timeStr);
            addLog('ACTION', `[SCHEDULE] Manual tick dispatched at ${timeStr} (Interval: ${intervalSec}s)`);
            // Trigger flow once via run-once
            await httpClient.runWorkflowOnce({
                workflow_id: `manual-tick-${Date.now()}`,
                name: 'Manual Scheduled Tick',
                nodes: [{ id, type: 'schedule_trigger', data: { interval_sec: intervalSec } }],
                edges: [],
                interval_sec: intervalSec,
            });
        } catch (err: any) {
            addLog('ALERT', `[SCHEDULE] Manual trigger error: ${err.message}`);
        } finally {
            setTimeout(() => setIsTriggering(false), 400);
        }
    };

    return (
        <div className="relative h-full w-full min-w-[270px] min-h-[175px]">
            {/* Thanh co giãn kích thước Node Resizer */}
            <NodeResizer
                minWidth={260}
                minHeight={165}
                isVisible={selected}
                lineClassName="!border-cyan-500 !border-dashed"
                handleClassName="!w-2.5 !h-2.5 !bg-zinc-950 !border-2 !border-cyan-500 !rounded"
            />

            <div
                className={`h-full w-full rounded-xl bg-zinc-900 border-2 shadow-xl select-none flex flex-col justify-between overflow-hidden transition-all ${
                    getNodeCardBorderClass('START', isExecuting, executionStatus, isDeployed, 'border-zinc-700 hover:border-zinc-600')
                }`}
            >
                {/* Header tích hợp Live Tracer Progress & Tier START Badge */}
                <NodeExecutionHeader
                    id={id}
                    tier="START"
                    title="Schedule Trigger"
                    subtitle="Periodic Watchdog"
                    icon={
                        <div
                            className={`w-6 h-6 rounded flex items-center justify-center ${
                                isDeployed ? 'bg-cyan-500/20 text-cyan-400' : 'bg-zinc-800 text-zinc-400'
                            }`}
                        >
                            <Clock className={`w-3.5 h-3.5 ${isDeployed && pulse ? 'animate-spin' : ''}`} />
                        </div>
                    }
                    extraRight={
                        <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold flex items-center gap-1 ${
                                isDeployed
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                    : 'bg-zinc-800 text-zinc-400'
                            }`}
                        >
                            {isDeployed ? (
                                <>
                                    <CheckCircle2 className="w-2.5 h-2.5" /> ACTIVE
                                </>
                            ) : (
                                'IDLE'
                            )}
                        </span>
                    }
                    onDelete={() => deleteNode(id)}
                />

                {/* Body Controls */}
                <div className="p-3 space-y-2.5 text-xs flex-1 flex flex-col justify-between">
                    {/* Mode Toggle: Interval vs Cron */}
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-cyan-400" /> Loại Lập Lịch:
                        </span>
                        <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded border border-zinc-800 text-[10px]">
                            <button
                                onClick={() => setMode('interval')}
                                className={`px-2 py-0.5 rounded cursor-pointer ${
                                    mode === 'interval'
                                        ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                Interval
                            </button>
                            <button
                                onClick={() => setMode('cron')}
                                className={`px-2 py-0.5 rounded cursor-pointer ${
                                    mode === 'cron'
                                        ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                Cron
                            </button>
                        </div>
                    </div>

                    {mode === 'interval' ? (
                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-zinc-400 flex items-center gap-1">
                                    <Sliders className="w-3 h-3 text-zinc-500" /> Chu Kỳ Quét:
                                </span>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        min="0.5"
                                        max="300"
                                        step="0.5"
                                        value={intervalSec}
                                        onChange={(e) => setIntervalSec(Math.max(0.5, Number(e.target.value)))}
                                        className="w-14 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 font-mono text-cyan-400 text-right text-xs focus:outline-none focus:border-cyan-500"
                                    />
                                    <span className="font-mono text-zinc-400 text-xs">giây</span>
                                </div>
                            </div>

                            {/* Preset Buttons */}
                            <div className="grid grid-cols-4 gap-1 text-[10px]">
                                {[1.0, 2.5, 5.0, 10.0].map((val) => (
                                    <button
                                        key={val}
                                        onClick={() => setIntervalSec(val)}
                                        className={`py-0.5 rounded font-mono border transition-colors cursor-pointer text-center ${
                                            intervalSec === val
                                                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold'
                                                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                        }`}
                                    >
                                        {val}s
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-semibold text-zinc-400 block">
                                Biểu Thức Cron:
                            </label>
                            <input
                                type="text"
                                value={cronExpr}
                                onChange={(e) => setCronExpr(e.target.value)}
                                placeholder="*/5 * * * *"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-zinc-200 font-mono text-[11px] focus:outline-none focus:border-cyan-500"
                            />
                        </div>
                    )}

                    {/* Status & Manual Trigger */}
                    <div className="pt-2 border-t border-zinc-800 flex items-center justify-between shrink-0">
                        <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[140px]">
                            Last: {lastTriggerTime}
                        </span>
                        <button
                            onClick={handleManualTick}
                            disabled={isTriggering}
                            className="px-2 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                        >
                            <Play className="w-3 h-3" /> {isTriggering ? 'Ticking...' : 'Tick Now'}
                        </button>
                    </div>
                </div>

                {/* Output Handle (Right) - Nối sang ProcessNode hoặc MetricTriggerNode */}
                <Handle
                    type="source"
                    position={Position.Right}
                    className="!w-3 !h-3 !bg-cyan-400 !border-2 !border-zinc-900"
                />
            </div>
        </div>
    );
}

