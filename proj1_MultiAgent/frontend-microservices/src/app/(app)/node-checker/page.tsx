'use client'

import { useState } from 'react'
import { useHardwareNode } from '@/hooks/useHardwareNode'

export default function NodeCheckerPage() {
    const { loading, submitting, report, isRegistered, registerNode } = useHardwareNode()
    const [message, setMessage] = useState('')

    const handleRegisterNode = async () => {
        setMessage('')
        const res = await registerNode()
        if (res.success) {
            setMessage('Đã cập nhật và kích hoạt Node AI thành công.')
        } else {
            setMessage('Cập nhật thất bại: ' + (res.error || 'Lỗi kết nối server'))
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12 text-xs text-zinc-500">
                Đang kiểm tra thông số thiết bị và đồng bộ trạng thái Node...
            </div>
        )
    }

    return (
        <div className="mx-auto my-6 max-w-2xl space-y-6">
            {/* Header trang */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                            <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                            <line x1="6" y1="6" x2="6.01" y2="6" />
                            <line x1="6" y1="18" x2="6.01" y2="18" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-white tracking-wide">
                            Node Inspector & Trạng thái Node
                        </h1>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            Đóng góp tài nguyên trình duyệt vào mạng lưới tính toán AI phân tán.
                        </p>
                    </div>
                </div>

                {/* Status Badge */}
                {report && (
                    <div className="flex flex-col items-end gap-1">
                        <span
                            className={`px-3 py-1 text-xs font-bold rounded-full border ${report.status === 'BUSY'
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                    : report.status === 'IDLE'
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                        : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                }`}
                        >
                            ● {report.status || 'IDLE'}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                            Cập nhật: {report.lastSeen ? new Date(report.lastSeen).toLocaleTimeString() : 'Vừa xong'}
                        </span>
                    </div>
                )}
            </div>

            {/* Thông số phần cứng */}
            <div className="grid grid-cols-2 gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 text-xs">
                <div>
                    <span className="text-zinc-500 block mb-1">Luồng CPU:</span>
                    <span className="text-sm font-semibold text-zinc-200">{report?.cpuCores} Cores</span>
                </div>
                <div>
                    <span className="text-zinc-500 block mb-1">Dung lượng RAM:</span>
                    <span className="text-sm font-semibold text-zinc-200">&ge; {report?.deviceMemoryGB} GB</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-zinc-800/60">
                    <span className="text-zinc-500 block mb-1">Tăng tốc WebGPU:</span>
                    <span className={`text-xs font-medium ${report?.hasWebGPU ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {report?.hasWebGPU ? `Khả dụng (${report.gpuName})` : 'Không hỗ trợ (Chạy chế độ CPU)'}
                    </span>
                </div>
            </div>

            {/* Danh sách Model tương thích */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-3">
                <h3 className="text-xs font-semibold text-zinc-300">Mô hình AI tương thích với RAM thiết bị:</h3>
                {report?.canRunAI ? (
                    <div className="flex flex-wrap gap-2">
                        {report.recommendedModels.map((model) => (
                            <span
                                key={model}
                                className="px-3 py-1.5 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-300 text-xs font-medium font-mono"
                            >
                                {model}
                            </span>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-rose-400">RAM khả dụng quá thấp (&lt; 4GB), không đủ điều kiện chạy AI Node.</p>
                )}
            </div>

            {/* Action Button */}
            {report?.canRunAI && (
                <button
                    onClick={handleRegisterNode}
                    disabled={submitting}
                    className={`w-full rounded-xl py-3 text-xs font-semibold text-white shadow-lg transition disabled:opacity-50 ${isRegistered
                            ? 'bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300'
                            : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                        }`}
                >
                    {submitting
                        ? 'Đang đồng bộ tín hiệu...'
                        : isRegistered
                            ? 'Đã Kích Hoạt (Nhấn để cập nhật lại)'
                            : 'Cập nhật & Kích hoạt Node Tính Toán'}
                </button>
            )}

            {message && (
                <p className="text-center text-xs font-medium text-zinc-300 mt-2">{message}</p>
            )}
        </div>
    )
}