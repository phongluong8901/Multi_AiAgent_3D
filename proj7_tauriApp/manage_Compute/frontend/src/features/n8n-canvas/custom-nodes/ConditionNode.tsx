import { useState } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { GitBranch, Sliders, CheckCircle2, XCircle } from 'lucide-react';
import { useTelemetryStore } from '../../../stores/useTelemetryStore';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { findConnectedProcess } from '../utils/flowGraphUtils';
import { NodeExecutionHeader, getNodeCardBorderClass } from '../components/NodeExecutionHeader';

export function ConditionNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
    const deleteNode = useWorkflowStore((s) => s.deleteNode);
    const nodes = useWorkflowStore((s) => s.nodes);
    const edges = useWorkflowStore((s) => s.edges);
    const activeExecutingNodeId = useWorkflowStore((s) => s.activeExecutingNodeId);
    const executionStatus = useWorkflowStore((s) => s.executionStatusMap[id]);
    const snapshot = useTelemetryStore((s) => s.snapshot);
    const processLookup = useTelemetryStore((s) => s.processLookup);

    const isExecuting = activeExecutingNodeId === id;

    const connectedProc = findConnectedProcess(id, nodes, edges);
    const liveProc = connectedProc?.pid ? processLookup[connectedProc.pid] : null;

    const [targetScope, setTargetScope] = useState<'system' | 'process'>(
        data.targetScope || (data.metric?.startsWith('process_') ? 'process' : 'process')
    );
    const [metric, setMetric] = useState<string>(
        data.metric || (targetScope === 'process' ? 'process_memory_mb' : 'ram_percent')
    );
    const [operator, setOperator] = useState<string>(data.operator || '>=');
    const [threshold, setThreshold] = useState<number>(
        Number(data.threshold || (metric === 'process_memory_mb' ? 1500 : 80))
    );

    // Đồng bộ lại prop data
    data.targetScope = targetScope;
    data.metric = metric;
    data.operator = operator;
    data.threshold = threshold;
    if (connectedProc) {
        data.target_pid = connectedProc.pid;
        data.target_name = connectedProc.name;
    }

    let currentVal = 0;
    let unit = '%';
    if (targetScope === 'process') {
        if (metric === 'process_memory_mb') {
            currentVal = Math.round(liveProc?.memory_mb ?? connectedProc?.memory_mb ?? 0);
            unit = 'MB';
        } else {
            currentVal = Number((liveProc?.cpu_percent ?? connectedProc?.cpu_percent ?? 0).toFixed(1));
            unit = '%';
        }
    } else {
        if (metric === 'cpu_percent') currentVal = snapshot?.cpu?.percent ?? 0;
        else if (metric === 'gpu_temp') {
            currentVal = snapshot?.gpus?.[0]?.temp_c ?? 0;
            unit = '°C';
        } else currentVal = snapshot?.ram?.percent ?? 0;
    }

    let isMatch = false;
    if (operator === '>') isMatch = currentVal > threshold;
    else if (operator === '>=') isMatch = currentVal >= threshold;
    else if (operator === '<') isMatch = currentVal < threshold;
    else if (operator === '<=') isMatch = currentVal <= threshold;
    else if (operator === '==') isMatch = Math.abs(currentVal - threshold) < 0.1;

    return (
        <div className="relative h-full w-full min-w-[280px] min-h-[210px]">
            {/* Node Resizer */}
            <NodeResizer
                minWidth={270}
                minHeight={200}
                isVisible={selected}
                lineClassName="!border-sky-500 !border-dashed"
                handleClassName="!w-2.5 !h-2.5 !bg-zinc-950 !border-2 !border-sky-500 !rounded"
            />

            <div
                className={`h-full w-full rounded-xl bg-zinc-900 border-2 shadow-xl select-none flex flex-col justify-between overflow-hidden transition-all ${
                    getNodeCardBorderClass('MIDDLE', isExecuting, executionStatus, true, 'border-amber-500/50 shadow-amber-950/20')
                }`}
            >
                {/* Input Handle (Left) */}
                <Handle
                    type="target"
                    position={Position.Left}
                    className="!w-3 !h-3 !bg-amber-400 !border-2 !border-zinc-900"
                />

                {/* Header tích hợp Live Tracer Progress & Tier MIDDLE Badge */}
                <NodeExecutionHeader
                    id={id}
                    tier="MIDDLE"
                    tierBadge="ROUTER"
                    title="Condition Router"
                    subtitle="IF / ELSE BRANCHING"
                    icon={<GitBranch className="w-4 h-4 text-amber-400" />}
                    extraRight={
                        <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold flex items-center gap-1 ${
                                isMatch
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                        >
                            {isMatch ? 'TRUE' : 'FALSE'}
                        </span>
                    }
                    onDelete={() => deleteNode(id)}
                />

                {/* Scope & Target Process */}
                <div className="px-3 pt-1.5 pb-1 border-b border-zinc-800/80 bg-zinc-950/40 shrink-0">
                    <div className="flex items-center justify-between text-[10px]">
                        <span className="text-zinc-500">Đầu vào:</span>
                        <span className="font-mono text-sky-300 font-medium truncate max-w-[170px]">
                            {connectedProc ? `${connectedProc.name} (PID ${connectedProc.pid})` : 'Toàn hệ thống'}
                        </span>
                    </div>
                </div>

                {/* Body Controls */}
                <div className="p-3 space-y-2 text-xs flex-1 flex flex-col justify-between">
                    {/* Metric Selector & Operator */}
                    <div className="grid grid-cols-5 gap-1.5 shrink-0">
                        <select
                            value={metric}
                            onChange={(e) => {
                                const nextM = e.target.value;
                                setMetric(nextM);
                                if (nextM.startsWith('process_')) setTargetScope('process');
                                else setTargetScope('system');
                            }}
                            className="col-span-3 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-200 focus:outline-none focus:border-sky-500 cursor-pointer"
                        >
                            <option value="process_memory_mb">Process RAM (MB)</option>
                            <option value="process_cpu_percent">Process CPU (%)</option>
                            <option value="ram_percent">% RAM Toàn máy</option>
                            <option value="cpu_percent">% CPU Toàn máy</option>
                            <option value="gpu_temp">Nhiệt độ GPU (°C)</option>
                        </select>

                        <select
                            value={operator}
                            onChange={(e) => setOperator(e.target.value)}
                            className="col-span-2 bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-[11px] text-zinc-200 text-center focus:outline-none focus:border-sky-500 cursor-pointer font-mono"
                        >
                            <option value=">">&gt; (Lớn hơn)</option>
                            <option value=">=">&gt;= (Từ)</option>
                            <option value="<">&lt; (Nhỏ hơn)</option>
                            <option value="<=">&lt;= (Bằng/Dưới)</option>
                            <option value="==">== (Bằng)</option>
                        </select>
                    </div>

                    {/* Threshold Input */}
                    <div className="flex justify-between items-center text-[11px]">
                        <span className="text-zinc-400 flex items-center gap-1">
                            <Sliders className="w-3 h-3 text-zinc-500" /> Ngưỡng So Sánh:
                        </span>
                        <div className="flex items-center gap-1">
                            <input
                                type="number"
                                min="1"
                                max={metric === 'process_memory_mb' ? 65536 : 100}
                                step={metric === 'process_memory_mb' ? 100 : 1}
                                value={threshold}
                                onChange={(e) => setThreshold(Number(e.target.value))}
                                className="w-16 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 font-mono text-sky-400 text-right text-xs focus:outline-none focus:border-sky-500"
                            />
                            <span className="font-mono text-zinc-400 text-xs">{unit}</span>
                        </div>
                    </div>

                    {/* Live Reading */}
                    <div className="pt-1.5 border-t border-zinc-800 flex items-center justify-between text-[11px] shrink-0">
                        <span className="text-zinc-400">Giá trị hiện tại:</span>
                        <span className="font-mono font-bold text-zinc-200">
                            {currentVal} {unit}
                        </span>
                    </div>

                    {/* Branch Labels Indicators */}
                    <div className="pt-1 text-[10px] space-y-1 shrink-0">
                        <div className="flex items-center justify-end gap-1.5 text-emerald-400 font-mono">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Nhánh TRUE &rarr;</span>
                        </div>
                        <div className="flex items-center justify-end gap-1.5 text-rose-400 font-mono">
                            <XCircle className="w-3 h-3" />
                            <span>Nhánh FALSE &rarr;</span>
                        </div>
                    </div>
                </div>

                {/* Output Handles (Right): TRUE (Top-Right) & FALSE (Bottom-Right) */}
                <Handle
                    id="true"
                    type="source"
                    position={Position.Right}
                    className="!w-3 !h-3 !bg-emerald-400 !border-2 !border-zinc-900 !top-[70%]"
                    title="True Branch (Khi thỏa mãn điều kiện)"
                />
                <Handle
                    id="false"
                    type="source"
                    position={Position.Right}
                    className="!w-3 !h-3 !bg-rose-400 !border-2 !border-zinc-900 !top-[86%]"
                    title="False Branch (Khi không thỏa mãn điều kiện)"
                />
            </div>
        </div>
    );
}
