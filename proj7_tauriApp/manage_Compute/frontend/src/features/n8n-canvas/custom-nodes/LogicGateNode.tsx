import { useState } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { Layers } from 'lucide-react';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { NodeExecutionHeader, getNodeCardBorderClass } from '../components/NodeExecutionHeader';

export function LogicGateNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
    const deleteNode = useWorkflowStore((s) => s.deleteNode);
    const activeExecutingNodeId = useWorkflowStore((s) => s.activeExecutingNodeId);
    const executionStatus = useWorkflowStore((s) => s.executionStatusMap[id]);

    const isExecuting = activeExecutingNodeId === id;
    const [gateType, setGateType] = useState<'AND' | 'OR'>(data.gate_type || 'AND');
    data.gate_type = gateType;

    return (
        <div className="relative h-full w-full min-w-[240px] min-h-[160px]">
            {/* Node Resizer */}
            <NodeResizer
                minWidth={230}
                minHeight={150}
                isVisible={selected}
                lineClassName="!border-amber-500 !border-dashed"
                handleClassName="!w-2.5 !h-2.5 !bg-zinc-950 !border-2 !border-amber-500 !rounded"
            />

            <div
                className={`h-full w-full rounded-xl bg-zinc-900 border-2 shadow-xl select-none flex flex-col justify-between overflow-hidden transition-all ${
                    getNodeCardBorderClass('MIDDLE', isExecuting, executionStatus, true, 'border-amber-500/50 shadow-amber-950/20')
                }`}
            >
                {/* 2 Input Handles (Left) */}
                <Handle
                    id="in-a"
                    type="target"
                    position={Position.Left}
                    className="!w-3 !h-3 !bg-amber-400 !border-2 !border-zinc-900 !top-[35%]"
                    title="Input Signal A"
                />
                <Handle
                    id="in-b"
                    type="target"
                    position={Position.Left}
                    className="!w-3 !h-3 !bg-amber-400 !border-2 !border-zinc-900 !top-[65%]"
                    title="Input Signal B"
                />

                {/* Header tích hợp Live Tracer Progress & Tier MIDDLE Badge */}
                <NodeExecutionHeader
                    id={id}
                    tier="MIDDLE"
                    tierBadge="COMBINER"
                    title="Logic Gate"
                    subtitle="MULTI-SIGNAL GATE"
                    icon={<Layers className="w-4 h-4 text-amber-400" />}
                    extraRight={
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {gateType}
                        </span>
                    }
                    onDelete={() => deleteNode(id)}
                />

                {/* Body Controls */}
                <div className="p-3 space-y-2.5 text-xs flex-1 flex flex-col justify-between">
                    <div>
                        <label className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
                            Toán Tử Logic:
                        </label>
                        <div className="grid grid-cols-2 gap-1 bg-zinc-950 p-0.5 rounded border border-zinc-800">
                            <button
                                onClick={() => setGateType('AND')}
                                className={`py-1 rounded text-center font-bold text-xs transition-colors cursor-pointer ${
                                    gateType === 'AND'
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                AND (VÀ)
                            </button>
                            <button
                                onClick={() => setGateType('OR')}
                                className={`py-1 rounded text-center font-bold text-xs transition-colors cursor-pointer ${
                                    gateType === 'OR'
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                OR (HOẶC)
                            </button>
                        </div>
                    </div>

                    <div className="bg-zinc-950/60 p-2 rounded border border-zinc-800/80 text-[10px] text-zinc-400 space-y-1">
                        <div className="flex items-center justify-between">
                            <span>Ngõ vào A:</span>
                            <span className="font-mono text-amber-400">Handle [in-a]</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Ngõ vào B:</span>
                            <span className="font-mono text-amber-400">Handle [in-b]</span>
                        </div>
                        <div className="text-[9px] text-zinc-500 italic pt-0.5">
                            {gateType === 'AND'
                                ? 'Yêu cầu cả 2 điều kiện đều kích hoạt mới chuyển tiếp'
                                : 'Chỉ cần 1 trong 2 điều kiện kích hoạt là chuyển tiếp'}
                        </div>
                    </div>
                </div>

                {/* Output Handle (Right) */}
                <Handle
                    id="out"
                    type="source"
                    position={Position.Right}
                    className="!w-3 !h-3 !bg-amber-400 !border-2 !border-zinc-900"
                    title="Output Signal"
                />
            </div>
        </div>
    );
}
