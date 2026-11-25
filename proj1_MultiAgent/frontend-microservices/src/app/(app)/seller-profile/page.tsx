'use client'

import { useState, useEffect } from 'react'
import { useSeller } from '@/hooks/useSeller'

export default function SellerPage() {
    const {
        nodeDetails,
        loading,
        saving,
        error,
        fetchNodeDetails,
        registerNode,
        sendHeartbeat,
    } = useSeller()

    // Form state để đăng ký node mới
    const [nodeName, setNodeName] = useState('')
    const [cpuCores, setCpuCores] = useState(4)
    const [ramGB, setRamGB] = useState(16)
    const [gpuName, setGpuName] = useState('')
    const [hasWebGPU, setHasWebGPU] = useState(false)
    const [autoPing, setAutoPing] = useState(false)

    // Tự động đồng bộ thông tin nếu node đã tồn tại
    useEffect(() => {
        if (nodeDetails) {
            setNodeName(nodeDetails.name || nodeDetails.nodeName || '')
            setCpuCores(nodeDetails.rentConfig?.allocatedCores || nodeDetails.allocatedCores || nodeDetails.cpuCores || 4)
            setRamGB(nodeDetails.rentConfig?.allocatedRAMGB || nodeDetails.allocatedRAMGB || nodeDetails.deviceMemoryGB || nodeDetails.ramGB || 16)
            setGpuName(nodeDetails.gpuName || '')
            setHasWebGPU(Boolean(nodeDetails.hasWebGPU))
        }
    }, [nodeDetails])

    // Effect tự động gửi Heartbeat mỗi 30 giây nếu bật Auto Ping
    useEffect(() => {
        let interval: NodeJS.Timeout
        if (autoPing) {
            interval = setInterval(() => {
                sendHeartbeat().catch(() => { })
            }, 30000)
        }
        return () => clearInterval(interval)
    }, [autoPing, sendHeartbeat])

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        await registerNode({
            nodeName: nodeName.trim(),
            cpuCores: Number(cpuCores),
            deviceMemoryGB: Number(ramGB),
            gpuName: gpuName.trim(),
            hasWebGPU,
        })
    }

    if (loading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center text-sm text-zinc-500">
                Đang tải thông tin Seller Node...
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-5xl space-y-8 pb-16">
            {/* Header Banner */}
            <div className="rounded-3xl border border-zinc-800 bg-gradient-to-r from-emerald-950/60 via-teal-950/40 to-zinc-900 p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                            Seller Dashboard
                        </span>
                        <h1 className="text-2xl font-bold text-white mt-1">
                            Quản lý AI Hardware Node
                        </h1>
                        <p className="text-xs text-zinc-400 mt-1">
                            Chia sẻ tài nguyên phần cứng để nhận thưởng khi chạy AI Agent.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => sendHeartbeat()}
                            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
                        >
                            Ping Heartbeat
                        </button>
                        <button
                            type="button"
                            onClick={() => fetchNodeDetails()}
                            className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition"
                        >
                            Làm mới
                        </button>
                    </div>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
                    {error}
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-3">
                {/* Status & Overview */}
                <div className="space-y-4 md:col-span-1">
                    <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200 border-b border-zinc-800 pb-3">
                            Trạng thái Node
                        </h2>

                        <div className="space-y-3">
                            <div>
                                <span className="text-xs text-zinc-500 block">Tình trạng:</span>
                                <div className="mt-1 flex items-center gap-2">
                                    <span
                                        className={`h-2.5 w-2.5 rounded-full ${nodeDetails?.status === 'BUSY'
                                                ? 'bg-amber-500 animate-pulse'
                                                : nodeDetails?.status === 'IDLE' || nodeDetails?.status === 'ONLINE'
                                                    ? 'bg-emerald-500'
                                                    : 'bg-zinc-600'
                                            }`}
                                    />
                                    <span className="text-sm font-semibold text-white uppercase">
                                        {nodeDetails?.status || 'OFFLINE / CHƯA ĐĂNG KÝ'}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <span className="text-xs text-zinc-500 block">Tên Node:</span>
                                <p className="text-xs font-medium text-zinc-300 mt-0.5">
                                    {nodeDetails?.name || nodeDetails?.nodeName || 'Chưa thiết lập'}
                                </p>
                            </div>

                            <div>
                                <span className="text-xs text-zinc-500 block">Lần Heartbeat cuối:</span>
                                <p className="text-xs font-mono text-zinc-400 mt-0.5">
                                    {nodeDetails?.lastHeartbeat
                                        ? new Date(nodeDetails.lastHeartbeat).toLocaleString('vi-VN')
                                        : 'Chưa có dữ liệu'}
                                </p>
                            </div>

                            <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                                <span className="text-xs text-zinc-400">Tự động Ping (30s):</span>
                                <input
                                    type="checkbox"
                                    checked={autoPing}
                                    onChange={(e) => setAutoPing(e.target.checked)}
                                    className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-emerald-600 focus:ring-emerald-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Form Đăng ký / Cập nhật Node */}
                <form
                    onSubmit={handleRegister}
                    className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 md:col-span-2"
                >
                    <h2 className="border-b border-zinc-800 pb-3 text-base font-bold text-white">
                        {nodeDetails ? 'Cập nhật cấu hình Node' : 'Đăng ký Hardware Node mới'}
                    </h2>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <label className="mb-1.5 block text-xs text-zinc-400">Tên Node / Thiết bị *</label>
                            <input
                                required
                                value={nodeName}
                                onChange={(e) => setNodeName(e.target.value)}
                                placeholder="Ví dụ: RTX-4090-Rig-01"
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs text-zinc-400">Số Cores CPU</label>
                            <input
                                type="number"
                                min={1}
                                value={cpuCores}
                                onChange={(e) => setCpuCores(Number(e.target.value))}
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs text-zinc-400">Dung lượng RAM (GB)</label>
                            <input
                                type="number"
                                min={1}
                                value={ramGB}
                                onChange={(e) => setRamGB(Number(e.target.value))}
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs text-zinc-400">Tên Card Đồ Hoạ (GPU)</label>
                            <input
                                value={gpuName}
                                onChange={(e) => setGpuName(e.target.value)}
                                placeholder="NVIDIA RTX 4090 / Apple M2 Ultra"
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                            />
                        </div>

                        <div className="flex items-center gap-3 sm:pt-6">
                            <input
                                type="checkbox"
                                id="webgpu"
                                checked={hasWebGPU}
                                onChange={(e) => setHasWebGPU(e.target.checked)}
                                className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-emerald-600 focus:ring-emerald-500"
                            />
                            <label htmlFor="webgpu" className="text-xs text-zinc-300 font-medium cursor-pointer">
                                Bật hỗ trợ WebGPU
                            </label>
                        </div>
                    </div>

                    <div className="flex justify-end border-t border-zinc-800 pt-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition"
                        >
                            {saving ? 'Đang lưu...' : nodeDetails ? 'Cập nhật Node' : 'Đăng ký Node'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}