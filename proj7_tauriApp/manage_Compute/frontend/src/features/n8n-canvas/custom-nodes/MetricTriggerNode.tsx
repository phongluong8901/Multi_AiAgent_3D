import { Handle, Position } from '@xyflow/react';
import { Gauge } from 'lucide-react';
import { useTelemetryStore } from '../../../stores/useTelemetryStore';

export function MetricTriggerNode({ data }: { data: any }) {
    const snapshot = useTelemetryStore((s) => s.snapshot);

    const currentVal =
        data.metric === 'ram_percent'
            ? snapshot?.ram.percent ?? 0
            : data.metric === 'gpu_temp'
                ? snapshot?.gpus?.[0]?.temp_c ?? 0
                : snapshot?.cpu.percent ?? 0;

    const isTriggered = currentVal > Number(data.threshold || 80);

    return (
        <div
            className={`w-64 rounded-xl bg-zinc-900 border-2 shadow-xl transition-colors ${isTriggered ? 'border-rose-500 shadow-rose-500/10' : 'border-zinc-700'
                }`}
        >
            <div className="bg-emerald-500/15 border-b border-zinc-800 px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-zinc-100">METRIC TRIGGER</span>
                </div>
                <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isTriggered ? 'bg-rose-500/20 text-rose-300' : 'bg-zinc-800 text-zinc-400'
                        }`}
                >
                    {isTriggered ? 'TRIGGERED' : 'WATCHING'}
                </span>
            </div>

            <div className="p-3 space-y-2 text-xs">
                <div className="flex justify-between text-zinc-400">
                    <span>Condition:</span>
                    <span className="font-mono text-emerald-400">
                        {data.metric} {data.operator} {data.threshold}%
                    </span>
                </div>

                <div className="flex justify-between items-center pt-1 border-t border-zinc-800">
                    <span className="text-zinc-400">Live Value:</span>
                    <span className="text-sm font-mono font-bold text-zinc-100">{currentVal}%</span>
                </div>
            </div>

            <Handle
                type="source"
                position={Position.Right}
                className="!w-3 !h-3 !bg-emerald-400 !border-2 !border-zinc-900"
            />
        </div>
    );
}