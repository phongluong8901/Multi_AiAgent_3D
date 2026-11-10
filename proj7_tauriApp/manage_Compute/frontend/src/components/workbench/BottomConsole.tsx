/**
 * Khung điều khiển và nhật ký kỹ thuật dưới đáy bàn làm việc (Bottom Console Component):
 * - Hiển thị luồng nhật ký Telemetry thời gian thực nhận từ WebSocket hoặc API.
 * - Cho phép sao chép toàn bộ log (Copy All) hoặc sao chép từng dòng log riêng lẻ.
 * - Tích hợp sơ đồ thu nhỏ MiniMap của đồ thị ReactFlow nằm liền mạch bên phải khi đang mở Tab Canvas.
 */

import { useState } from 'react';
import { Terminal, Trash2, Map, Copy, Check } from 'lucide-react';
import { MiniMap } from '@xyflow/react';
import { useTelemetryStore } from '../../stores/useTelemetryStore';
import { useWorkbenchStore } from '../../stores/useWorkbenchStore';

export function BottomConsole() {
    const { logs, clearLogs, snapshot } = useTelemetryStore();
    const { tabs, activeTabId } = useWorkbenchStore();
    const [copiedAll, setCopiedAll] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Kiểm tra xem tab hiện tại có phải là Canvas đồ thị workflow hay không
    const currentTab = tabs.find((t) => t.id === activeTabId);
    const isCanvasTab = currentTab?.type === 'workflow-canvas' || currentTab?.type === 'n8n-canvas';

    /**
     * Sao chép toàn bộ các dòng nhật ký hiện có vào Clipboard.
     */
    const handleCopyAll = async () => {
        if (logs.length === 0) return;
        const text = logs.map((l) => `[${l.time}] [${l.type}] ${l.message}`).join('\n');
        try {
            await navigator.clipboard.writeText(text);
            setCopiedAll(true);
            setTimeout(() => setCopiedAll(false), 2000);
        } catch {
            // Dự phòng khi trình duyệt chặn quyền truy cập Clipboard
        }
    };

    /**
     * Sao chép nội dung của một dòng nhật ký cụ thể.
     */
    const handleCopyLine = async (id: string, text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 1500);
        } catch {
            // Dự phòng
        }
    };

    return (
        <div className="h-full bg-zinc-950 flex flex-col text-xs font-mono">
            {/* Header thanh console */}
            <div className="px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between select-none shrink-0">
                <div className="flex items-center gap-2 text-zinc-300">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-sans font-medium">Console &amp; Realtime Telemetry</span>
                </div>
                <div className="flex items-center gap-3">
                    {/* Hiển thị tóm tắt chỉ số CPU / RAM / Disk thời gian thực */}
                    {snapshot && (
                        <span className="text-[11px] text-zinc-400 font-mono hidden md:inline">
                            CPU: <strong className="text-emerald-400">{snapshot.cpu.percent}%</strong> | RAM:{' '}
                            <strong className="text-blue-400">{snapshot.ram.percent}%</strong> | Disk Free:{' '}
                            <strong className="text-zinc-200">{snapshot.io.disk_free_gb}GB</strong>
                        </span>
                    )}

                    {/* Nút sao chép toàn bộ nhật ký */}
                    <button
                        onClick={handleCopyAll}
                        title="Copy all console logs to clipboard"
                        disabled={logs.length === 0}
                        className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center gap-1 font-sans text-[11px] transition-colors cursor-pointer disabled:opacity-40"
                    >
                        {copiedAll ? (
                            <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Copied</span>
                            </>
                        ) : (
                            <>
                                <Copy className="w-3 h-3 text-zinc-400" />
                                <span>Copy All</span>
                            </>
                        )}
                    </button>

                    {/* Nút xóa sạch nhật ký */}
                    <button
                        onClick={clearLogs}
                        className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-sans cursor-pointer transition-colors text-[11px]"
                    >
                        <Trash2 className="w-3.5 h-3.5" /> Clear
                    </button>
                </div>
            </div>

            {/* Nội dung: Danh sách Log bên trái, MiniMap nằm cùng hàng bên phải */}
            <div className="flex-1 flex overflow-hidden">
                <div className="p-2.5 overflow-y-auto flex-1 space-y-0.5 select-text cursor-text">
                    {logs.length === 0 ? (
                        <div className="text-zinc-600 italic py-4">Console idle. No telemetry logs recorded yet.</div>
                    ) : (
                        logs.map((log) => {
                            const rawLine = `[${log.time}] [${log.type}] ${log.message}`;
                            const isThisCopied = copiedId === log.id;
                            return (
                                <div
                                    key={log.id}
                                    className="flex items-start justify-between gap-2 leading-relaxed group hover:bg-zinc-900/60 px-1 py-0.5 rounded transition-colors"
                                >
                                    <div className="flex gap-2 min-w-0">
                                        <span className="text-zinc-500 shrink-0 select-none">[{log.time}]</span>
                                        <span
                                            className={`shrink-0 font-semibold select-none ${
                                                log.type === 'ACTION'
                                                    ? 'text-amber-400'
                                                    : log.type === 'ALERT'
                                                    ? 'text-rose-400'
                                                    : 'text-emerald-400'
                                            }`}
                                        >
                                            [{log.type}]
                                        </span>
                                        <span className="text-zinc-300 break-all select-text">{log.message}</span>
                                    </div>

                                    {/* Nút sao chép 1 dòng xuất hiện khi rê chuột hover */}
                                    <button
                                        onClick={() => handleCopyLine(log.id, rawLine)}
                                        title="Copy this log line"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 shrink-0 cursor-pointer select-none"
                                    >
                                        {isThisCopied ? (
                                            <Check className="w-3 h-3 text-emerald-400" />
                                        ) : (
                                            <Copy className="w-3 h-3" />
                                        )}
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Sơ đồ thu nhỏ MiniMap đồng bộ vị trí khi đang mở Tab Workflow Canvas */}
                {isCanvasTab && (
                    <div className="w-60 h-full border-l border-zinc-800 bg-zinc-900/60 p-2 flex flex-col shrink-0 select-none">
                        <div className="flex items-center justify-between text-[10px] text-zinc-400 font-sans font-semibold mb-1 uppercase tracking-wider">
                            <span className="flex items-center gap-1.5 text-zinc-300">
                                <Map className="w-3.5 h-3.5 text-cyan-400" /> Canvas Overview
                            </span>
                            <span className="font-mono text-zinc-500 text-[9px]">MINIMAP</span>
                        </div>
                        <div className="flex-1 relative rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 shadow-inner">
                            <MiniMap
                                nodeStrokeColor="#3b82f6"
                                nodeColor="#18181b"
                                maskColor="rgba(0, 0, 0, 0.75)"
                                className="!absolute !inset-0 !w-full !h-full !m-0 !border-none !rounded-none !bg-zinc-950"
                                zoomable
                                pannable
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
