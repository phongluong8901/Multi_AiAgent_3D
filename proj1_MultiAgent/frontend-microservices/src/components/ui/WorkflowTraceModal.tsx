'use client'

import { useState } from 'react'
import { WorkflowTrace, WorkflowTraceNode } from '@/lib/api'
import {
    IconTrace,
    IconZap,
    IconX,
    IconAlertCircle,
    IconCheckCircle,
    IconTerminal,
    IconLayers,
} from './icons'

type Props = {
    trace: WorkflowTrace | null
    onClose: () => void
    allTraces?: Record<string, WorkflowTrace>
    onSelectTrace?: (trace: WorkflowTrace) => void
}

export default function WorkflowTraceModal({
    trace,
    onClose,
    allTraces = {},
    onSelectTrace,
}: Props) {
    if (!trace) return null

    const [selectedNodeId, setSelectedNodeId] = useState<string>(
        trace.errorNode || trace.nodes[trace.nodes.length - 1]?.id || 'node_input'
    )

    const selectedNode =
        trace.nodes.find((n) => n.id === selectedNodeId) || trace.nodes[0]

    const isError = trace.status === 'error'

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-5xl h-[85vh] rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl flex flex-col overflow-hidden text-zinc-200">
                {/* Header (LangSmith Style) */}
                <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-inner">
                            <IconTrace className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="font-bold text-white text-base tracking-tight">
                                    Workflow Execution Trace (LangSmith View)
                                </h2>
                                <span
                                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border flex items-center gap-1 ${
                                        isError
                                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                                            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                    }`}
                                >
                                    {isError ? (
                                        <>
                                            <IconAlertCircle className="w-3 h-3" />
                                            <span>Lỗi tại node</span>
                                        </>
                                    ) : (
                                        <>
                                            <IconCheckCircle className="w-3 h-3" />
                                            <span>Thành công</span>
                                        </>
                                    )}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                                <span>Agent: <strong className="text-zinc-200">{trace.agentName}</strong></span>
                                <span>·</span>
                                <span>Latency: <strong className="text-blue-400">{trace.totalLatencyMs} ms</strong></span>
                                <span>·</span>
                                <span className="font-mono text-[10px] text-zinc-500">#{trace.traceId}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Selector for other traces in room */}
                        {Object.keys(allTraces).length > 1 && (
                            <select
                                value={trace.traceId}
                                onChange={(e) => {
                                    const found = allTraces[e.target.value]
                                    if (found) onSelectTrace?.(found)
                                }}
                                className="bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none"
                            >
                                {Object.values(allTraces).map((t) => (
                                    <option key={t.traceId} value={t.traceId}>
                                        {t.status === 'error' ? '● [Error]' : '● [OK]'} {t.agentName} — {t.totalLatencyMs}ms
                                    </option>
                                ))}
                            </select>
                        )}

                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition"
                        >
                            <IconX className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Prompt Summary Banner */}
                <div className="px-6 py-2.5 bg-zinc-900/40 border-b border-zinc-800/80 text-xs flex items-center justify-between text-zinc-400">
                    <div className="truncate max-w-2xl">
                        <span className="text-zinc-500 font-semibold mr-1.5">User Prompt:</span>
                        <span className="text-zinc-200 font-mono">"{trace.userMessage}"</span>
                    </div>
                    {trace.error && (
                        <div className="text-rose-400 font-medium text-[11px] truncate max-w-sm flex items-center gap-1">
                            <IconAlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{trace.error}</span>
                        </div>
                    )}
                </div>

                {/* Main Body: Pipeline DAG on Left, Node Inspector on Right */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Panel: Visual DAG Nodes Timeline */}
                    <div className="w-80 border-r border-zinc-800 bg-zinc-950 p-4 overflow-y-auto space-y-3 shrink-0">
                        <div className="text-[11px] uppercase tracking-wider font-bold text-zinc-500 flex items-center gap-1.5">
                            <IconLayers className="w-3.5 h-3.5" />
                            <span>Các bước thực thi (Pipeline Nodes):</span>
                        </div>

                        <div className="relative space-y-2">
                            {trace.nodes.map((node, idx) => {
                                const isSelected = node.id === selectedNodeId
                                const isNodeError = node.status === 'error'

                                return (
                                    <div key={node.id} className="relative">
                                        {/* Connecting Line */}
                                        {idx < trace.nodes.length - 1 && (
                                            <div className="absolute left-4 top-8 bottom--2 w-0.5 bg-zinc-800 z-0" />
                                        )}

                                        <button
                                            onClick={() => setSelectedNodeId(node.id)}
                                            className={`w-full relative z-10 text-left p-3 rounded-2xl border transition flex items-start gap-2.5 ${
                                                isSelected
                                                    ? 'bg-zinc-900 border-blue-500 shadow-lg ring-1 ring-blue-500/40'
                                                    : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                                            } ${isNodeError ? 'border-rose-500/80 bg-rose-950/20' : ''}`}
                                        >
                                            <div
                                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 font-bold ${
                                                    isNodeError
                                                        ? 'bg-rose-500 text-white animate-bounce'
                                                        : node.status === 'completed'
                                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                                        : 'bg-blue-500/20 text-blue-400'
                                                }`}
                                            >
                                                {isNodeError ? '!' : idx + 1}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-xs font-bold truncate ${isNodeError ? 'text-rose-400' : 'text-zinc-200'}`}>
                                                        {node.name}
                                                    </span>
                                                    <span className="text-[10px] font-mono text-zinc-500">
                                                        {node.latencyMs ? `${node.latencyMs}ms` : ''}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-zinc-500 capitalize flex items-center gap-1.5 mt-0.5">
                                                    <span>Node Type: {node.type}</span>
                                                    {isNodeError && (
                                                        <span className="text-rose-400 font-bold">· FAILED</span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Right Panel: Detailed Node Inspector (Inputs, Outputs, Error Diagnostics) */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-900/30">
                        {selectedNode ? (
                            <div className="space-y-5">
                                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base font-bold text-white">
                                                {selectedNode.name}
                                            </h3>
                                            <span
                                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                    selectedNode.status === 'error'
                                                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                }`}
                                            >
                                                {selectedNode.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-zinc-400 mt-0.5">
                                            Kiểu Node: <code className="text-blue-400 font-mono">{selectedNode.type}</code> · Thời gian chạy: <span className="font-mono text-zinc-200">{selectedNode.latencyMs || 0} ms</span>
                                        </p>
                                    </div>
                                </div>

                                {/* RED ERROR DIAGNOSTIC CALLOUT IF NODE FAILED */}
                                {selectedNode.status === 'error' && (
                                    <div className="rounded-2xl bg-rose-950/40 border border-rose-500/60 p-4 space-y-3 shadow-xl">
                                        <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                                            <IconAlertCircle className="w-4 h-4 shrink-0" />
                                            <span>PHÁT HIỆN SỰ CỐ TẠI BƯỚC NÀY (Error Root Cause):</span>
                                        </div>
                                        <div className="text-xs text-rose-200 font-mono bg-black/60 p-3 rounded-xl border border-rose-500/30 whitespace-pre-wrap">
                                            {selectedNode.error || trace.error || 'Unknown execution error'}
                                        </div>
                                        {selectedNode.stackTrace && (
                                            <div className="space-y-1">
                                                <div className="text-[11px] font-semibold text-rose-300 flex items-center gap-1.5">
                                                    <IconTerminal className="w-3.5 h-3.5" />
                                                    <span>Stack Trace chi tiết:</span>
                                                </div>
                                                <pre className="text-[10px] font-mono text-zinc-400 bg-black/70 p-3 rounded-xl overflow-x-auto max-h-48 scrollbar-none border border-zinc-800">
                                                    {selectedNode.stackTrace}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Inputs Inspector */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-blue-400" />
                                            <span>Dữ liệu đầu vào (Inputs):</span>
                                        </span>
                                    </div>
                                    <pre className="text-xs font-mono text-zinc-300 bg-zinc-950 border border-zinc-800 p-4 rounded-2xl overflow-x-auto max-h-60 shadow-inner">
                                        {JSON.stringify(selectedNode.inputs || {}, null, 2)}
                                    </pre>
                                </div>

                                {/* Outputs Inspector */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                            <span>Dữ liệu đầu ra (Outputs):</span>
                                        </span>
                                    </div>
                                    <pre className="text-xs font-mono text-zinc-300 bg-zinc-950 border border-zinc-800 p-4 rounded-2xl overflow-x-auto max-h-60 shadow-inner">
                                        {JSON.stringify(selectedNode.outputs || {}, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-20 text-zinc-500 text-xs">
                                Chọn một bước bên trái để xem chi tiết luồng thực thi.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
