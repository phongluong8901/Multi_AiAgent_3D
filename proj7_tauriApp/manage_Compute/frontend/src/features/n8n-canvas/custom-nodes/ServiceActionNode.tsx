import { Handle, Position } from '@xyflow/react';
import { Zap } from 'lucide-react';

export function ServiceActionNode({ data }: { data: any }) {
    return (
        <div className="w-64 rounded-xl bg-zinc-900 border-2 border-zinc-700 shadow-xl">
            <Handle
                type="target"
                position={Position.Left}
                className="!w-3 !h-3 !bg-amber-400 !border-2 !border-zinc-900"
            />

            <div className="bg-amber-500/15 border-b border-zinc-800 px-3 py-2 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-zinc-100">SERVICE ACTION</span>
            </div>

            <div className="p-3 space-y-2 text-xs">
                <div className="flex justify-between text-zinc-400">
                    <span>Action Type:</span>
                    <span className="font-mono text-amber-300">{data.action_type}</span>
                </div>
                <div className="bg-zinc-950 p-2 rounded border border-zinc-800 font-mono text-[11px] text-zinc-300 truncate">
                    {data.command || `Target PID: ${data.pid}`}
                </div>
            </div>
        </div>
    );
}