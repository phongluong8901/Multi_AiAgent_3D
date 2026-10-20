// src/app/seller/page.tsx
'use client'

import { useSeller } from '@/hooks/useSeller'
import { useHardwareNode } from '@/hooks/useHardwareNode'

export default function SellerPage() {
    const { nodeDetails, registerNode, sendHeartbeat, saving, loading: sellerLoading } = useSeller()
    const { report, isRegistered, loading: nodeLoading } = useHardwareNode()

    const handleRegister = async () => {
        await registerNode(report)
    }

    const handlePing = async () => {
        await sendHeartbeat()
    }

    return (
        <div className="p-8 max-w-4xl mx-auto text-white">
            <h1 className="text-2xl font-bold mb-2">Quản lý Cửa hàng & Hardware Node</h1>
            <p className="text-zinc-400 text-sm mb-6">Đăng ký và giám sát trạng thái tài nguyên phần cứng của bạn.</p>

            {(sellerLoading || nodeLoading) ? (
                <div className="text-zinc-500 text-sm">Đang tải thông tin phần cứng...</div>
            ) : (
                <div className="space-y-6">
                    {/* Thông tin phần cứng hiện tại */}
                    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
                        <h2 className="text-lg font-semibold mb-4 text-blue-400">Thông số phần cứng thiết bị</h2>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/60">
                                <span className="text-zinc-500 block">CPU Cores:</span>
                                <span className="font-medium">{report?.cpuCores || 2} Cores</span>
                            </div>
                            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/60">
                                <span className="text-zinc-500 block">RAM:</span>
                                <span className="font-medium">{report?.deviceMemoryGB || 4} GB</span>
                            </div>
                            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/60">
                                <span className="text-zinc-500 block">Hỗ trợ WebGPU:</span>
                                <span className="font-medium">{report?.hasWebGPU ? 'Có' : 'Không'}</span>
                            </div>
                            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/60">
                                <span className="text-zinc-500 block">GPU Name:</span>
                                <span className="font-medium">{report?.gpuName || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Trạng thái đăng ký node */}
                    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold text-white">Trạng thái Node trên hệ thống</h3>
                            <p className="text-xs text-zinc-400 mt-1">
                                {isRegistered ? 'Node đã được kích hoạt và sẵn sàng.' : 'Node chưa được đăng ký với Gateway.'}
                            </p>
                        </div>

                        {!isRegistered ? (
                            <button
                                onClick={handleRegister}
                                disabled={saving}
                                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                                {saving ? 'Đang đăng ký...' : 'Đăng ký Node'}
                            </button>
                        ) : (
                            <button
                                onClick={handlePing}
                                className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-zinc-700"
                            >
                                Gửi Heartbeat Ping
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}