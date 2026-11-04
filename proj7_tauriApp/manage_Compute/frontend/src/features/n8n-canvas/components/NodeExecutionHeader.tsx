import React from 'react';
import { Activity, CheckCircle2, AlertTriangle, ShieldCheck, X } from 'lucide-react';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import type { NodeTier } from '../utils/connectionValidator';

interface NodeExecutionHeaderProps {
    id: string;
    tier: NodeTier;
    title: string;
    subtitle?: string;
    icon: React.ReactNode;
    tierBadge?: string;
    onDelete?: () => void;
    extraRight?: React.ReactNode;
    onTitleClick?: () => void;
}

export function NodeExecutionHeader({
    id,
    tier,
    title,
    subtitle,
    icon,
    tierBadge,
    onDelete,
    extraRight,
    onTitleClick,
}: NodeExecutionHeaderProps) {
    const activeExecutingNodeId = useWorkflowStore((s) => s.activeExecutingNodeId);
    const executionStatusMap = useWorkflowStore((s) => s.executionStatusMap);

    const isExecuting = activeExecutingNodeId === id;
    const executionStatus = executionStatusMap[id];

    const tierStyles = {
        START: 'border-cyan-500/40 text-cyan-300 bg-cyan-950/60',
        MIDDLE: 'border-amber-500/40 text-amber-300 bg-amber-950/60',
        END: 'border-rose-500/40 text-rose-300 bg-rose-950/60',
    };

    return (
        <div className="flex flex-col shrink-0">
            {/* Live Test / Simulation Progress Banner trực tiếp trên card */}
            {(isExecuting || executionStatus) && (
                <div
                    className={`px-2.5 py-1 text-[10px] font-mono flex items-center justify-between border-b transition-all select-none ${
                        isExecuting
                            ? 'bg-amber-950/90 border-amber-500/60 text-amber-300 animate-pulse'
                            : executionStatus === 'success'
                            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
                            : executionStatus === 'skipped'
                            ? 'bg-zinc-800/90 border-zinc-700 text-zinc-400'
                            : 'bg-rose-950/90 border-rose-500/60 text-rose-300'
                    }`}
                >
                    <div className="flex items-center gap-1.5 font-bold">
                        {isExecuting ? (
                            <>
                                <Activity className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                                <span>EVALUATING IN PROGRESS...</span>
                            </>
                        ) : executionStatus === 'success' ? (
                            <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>STEP PASSED &amp; TRIGGERED</span>
                            </>
                        ) : executionStatus === 'skipped' ? (
                            <>
                                <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
                                <span>EVALUATED: SAFE / SKIPPED</span>
                            </>
                        ) : (
                            <>
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                                <span>STEP EXECUTION FAILED</span>
                            </>
                        )}
                    </div>

                    <span className="text-[9px] font-mono px-1 rounded bg-black/40 text-zinc-300 uppercase">
                        {tier} TIER
                    </span>
                </div>
            )}

            {/* Header thông tin chính của Card */}
            <div className="px-3 py-2 border-b border-zinc-800/80 bg-zinc-950/50 flex items-center justify-between shrink-0">
                <div
                    onClick={onTitleClick}
                    className={`flex items-center gap-2 ${onTitleClick ? 'cursor-pointer group' : ''}`}
                >
                    <div className="shrink-0">{icon}</div>
                    <div className="overflow-hidden">
                        <div className="text-xs font-bold text-zinc-100 truncate max-w-[140px] group-hover:text-emerald-300 transition-colors">
                            {title}
                        </div>
                        {subtitle && (
                            <div className="text-[10px] font-mono text-zinc-500 truncate max-w-[140px]">
                                {subtitle}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    {/* Badge phân tầng START / MIDDLE / END */}
                    <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${
                            tierStyles[tier]
                        }`}
                        title={`Node thuộc Tầng ${tier} trong chuỗi kết nối`}
                    >
                        {tierBadge || tier}
                    </span>

                    {extraRight}

                    {onDelete && (
                        <button
                            onClick={onDelete}
                            title="Xóa node này khỏi canvas"
                            className="p-1 text-zinc-500 hover:text-rose-400 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Trả về class style cho khung bao của card dựa trên trạng thái thực thi hiện thời
 */
export function getNodeCardBorderClass(
    tier: NodeTier,
    isExecuting: boolean,
    executionStatus?: 'pending' | 'running' | 'success' | 'failed' | 'skipped',
    isConnected?: boolean,
    defaultBorderClass?: string
): string {
    if (isExecuting) {
        return 'border-amber-400 ring-4 ring-amber-400/60 ring-offset-2 ring-offset-zinc-950 shadow-2xl shadow-amber-500/20 animate-pulse';
    }
    if (executionStatus === 'success') {
        return 'border-emerald-500 ring-2 ring-emerald-500/50 shadow-xl shadow-emerald-500/10';
    }
    if (executionStatus === 'failed') {
        return 'border-rose-500 ring-2 ring-rose-500/50 shadow-xl shadow-rose-500/10';
    }
    if (executionStatus === 'skipped') {
        return 'border-zinc-700/80 opacity-75';
    }
    if (isConnected) {
        if (tier === 'START') return 'border-cyan-500/80 ring-1 ring-cyan-500/30';
        if (tier === 'MIDDLE') return 'border-amber-500/70 ring-1 ring-amber-500/30';
        return 'border-indigo-500/80 ring-1 ring-indigo-500/30';
    }
    return defaultBorderClass || 'border-zinc-800 hover:border-zinc-700';
}

