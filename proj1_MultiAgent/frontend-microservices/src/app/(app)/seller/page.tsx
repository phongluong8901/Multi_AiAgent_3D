'use client'

import React, { useState, useEffect } from 'react'
import { sellerApi, SellerNodeData, SellerDashboardData } from '@/lib/api/seller'
import { distributedApi } from '@/lib/api/distributed'
import { useConfirm } from '@/context/ConfirmContext'
import { useUser } from '@/hooks/useUser'
import { notify } from '@/lib/toast'
import {
    Server,
    Cpu,
    HardDrive,
    Activity,
    Coins,
    Download,
    Plus,
    MapPin,
    Zap,
    X,
    Radio,
    Layers,
    ShieldCheck,
    CheckCircle2,
    AlertCircle,
    RefreshCw,
    Terminal,
} from 'lucide-react'

export default function SellerComputePage() {
    const { profile } = useUser()
    const { alert: alertModal } = useConfirm()
    const [dashboard, setDashboard] = useState<SellerDashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [isRegisterOpen, setIsRegisterOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [gettingLocation, setGettingLocation] = useState(false)

    const currentSellerId = profile?.id || 'usr_seller_01'
    const currentSellerName = profile?.name || 'Minh Tuấn (AI Developer)'

    // Form đăng ký máy mới
    const [newNode, setNewNode] = useState({
        nodeName: 'PC Gaming RTX - Qwen 2.5 Coder',
        cpuCores: 8,
        ramGB: 16,
        gpuName: 'NVIDIA GeForce RTX 3060',
        vramGB: 12,
        hostedModel: 'qwen-2.5-coder-1.5b',
        modelDisplayName: 'Qwen 2.5 Coder (1.5B Instruct)',
        localEndpoint: 'http://localhost:11434',
        coinsPerHour: 35,
        coinsPer1kTokens: 0.5,
        locationName: 'Cầu Giấy, Hà Nội',
        lng: 105.7828,
        lat: 21.0333,
    })

    const loadDashboard = async () => {
        try {
            const res = await sellerApi.getSellerDashboard(currentSellerId)
            if (res.success) {
                setDashboard(res)
            }
        } catch (err: any) {
            console.error('Lỗi tải dashboard seller:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadDashboard()
    }, [currentSellerId])

    const handleToggleStatus = async (nodeId: string, currentStatus: string) => {
        const nextStatus = currentStatus === 'ONLINE' ? 'OFFLINE' : 'ONLINE'
        try {
            await sellerApi.toggleNodeStatus(nodeId, nextStatus as any)
            await loadDashboard()
            notify.success(`Đã chuyển trạng thái sang ${nextStatus}`)
        } catch (err: any) {
            notify.error('Lỗi cập nhật trạng thái', { description: err.message })
        }
    }

    const handleGetGPS = () => {
        if (!navigator.geolocation) {
            alertModal({
                title: 'Không hỗ trợ Geolocation',
                description: 'Trình duyệt hiện tại không hỗ trợ định vị GPS tự động.',
                variant: 'warning',
            })
            return
        }
        setGettingLocation(true)
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setNewNode((prev) => ({
                    ...prev,
                    lat: Number(pos.coords.latitude.toFixed(4)),
                    lng: Number(pos.coords.longitude.toFixed(4)),
                    locationName: `Tọa độ GPS (${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)})`,
                }))
                setGettingLocation(false)
                notify.success('Đã xác định tọa độ GPS thành công')
            },
            (err) => {
                alertModal({
                    title: 'Lỗi định vị GPS',
                    description: err.message,
                    variant: 'danger',
                })
                setGettingLocation(false)
            }
        )
    }

    const handleRegisterNode = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            await sellerApi.registerNode({
                ...newNode,
                sellerId: currentSellerId,
                sellerName: currentSellerName,
            })
            setIsRegisterOpen(false)
            await loadDashboard()
            await alertModal({
                title: 'Đăng Ký Thành Công',
                description: `Node máy tính "${newNode.nodeName}" đã được ghi nhận và sẵn sàng trên Marketplace.`,
                variant: 'success',
            })
        } catch (err: any) {
            notify.error('Lỗi đăng ký node', { description: err.message })
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                            Seller Compute Host
                        </span>
                        <span className="text-xs text-zinc-500">Đối tác Chia sẻ Tài nguyên &amp; Model AI Local</span>
                    </div>
                    <h1 className="text-xl md:text-2xl font-black text-white mt-1">
                        Quản Lý Máy Cho Thuê &amp; Chạy Local AI
                    </h1>
                    <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
                        Tải ứng dụng Worker về máy cá nhân, chạy model AI offline (Ollama / GGUF) và cho người dùng lân cận thuê tính toán để nhận SaveCoin.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <a
                        href={distributedApi.getDownloadAppUrl()}
                        download
                        className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white text-xs font-semibold rounded-xl border border-zinc-700/80 transition flex items-center gap-2 shadow-sm"
                    >
                        <Download className="w-4 h-4 text-emerald-400" />
                        <span>Tải Worker App (.exe)</span>
                    </a>

                    <button
                        onClick={() => setIsRegisterOpen(true)}
                        className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-amber-600/20 transition flex items-center gap-1.5"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Đăng Ký Máy Mới</span>
                    </button>
                </div>
            </div>

            {/* Quick Onboarding Banner for Sellers */}
            <div className="bg-gradient-to-r from-amber-950/20 via-zinc-900/60 to-zinc-900/30 border border-amber-500/20 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                        <Zap className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-amber-300">Quy Trình 3 Bước Tham Gia Chia Sẻ Compute</h3>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            Bước 1: Tải Worker Setup (.exe) &bull; Bước 2: Bật Ollama chạy model (Qwen, DeepSeek...) &bull; Bước 3: Đăng ký Node và vị trí để nhận việc tự động.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <span className="px-3 py-1 bg-zinc-800/80 rounded-lg text-zinc-300 border border-zinc-700/60 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-400" />
                        <span>Định tuyến theo khoảng cách</span>
                    </span>
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Độ trễ thấp dưới 15ms</span>
                    </span>
                </div>
            </div>

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4 space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-400">Máy Đang Hoạt Động</span>
                        <Server className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <strong className="text-2xl font-black text-emerald-400 font-mono">
                            {dashboard?.summary.activeNodesCount ?? dashboard?.summary.onlineNodes ?? 0}
                        </strong>
                        <span className="text-xs text-zinc-500">/ {dashboard?.summary.totalNodes || 0} nodes</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> Sẵn sàng nhận việc
                    </span>
                </div>

                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4 space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-400">SaveCoin Đã Kiếm Được</span>
                        <Coins className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex items-baseline gap-1">
                        <strong className="text-2xl font-black text-amber-400 font-mono">
                            {dashboard?.summary.totalCoinsEarned?.toLocaleString() || 0}
                        </strong>
                        <span className="text-xs text-amber-400/80">Coins</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">Cộng trực tiếp vào ví</span>
                </div>

                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4 space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-400">Tokens Đã Phục Vụ</span>
                        <Cpu className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex items-baseline gap-1">
                        <strong className="text-2xl font-black text-blue-400 font-mono">
                            {((dashboard?.summary.totalTokensServed || 0) / 1000).toFixed(1)}k
                        </strong>
                        <span className="text-xs text-zinc-500">tokens</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">Sinh trực tiếp từ GPU cục bộ</span>
                </div>

                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4 space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-400">Đánh Giá Uy Tín</span>
                        <ShieldCheck className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="flex items-baseline gap-1">
                        <strong className="text-2xl font-black text-purple-400 font-mono">
                            {dashboard?.summary.avgRating || 5.0}
                        </strong>
                        <span className="text-xs text-zinc-500">/ 5.0</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">{dashboard?.summary.totalInferenceRequests || 0} lượt suy luận</span>
                </div>
            </div>

            {/* My Nodes Section */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                        <Radio className="w-4 h-4 text-amber-400" />
                        <span>Danh Sách Máy Trạm Cho Thuê Của Bạn</span>
                    </h2>
                    <span className="text-xs text-zinc-500">Tự động đồng bộ CSDL MongoDB</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dashboard?.nodes && dashboard.nodes.length > 0 ? (
                        dashboard.nodes.map((node) => (
                            <div
                                key={node.id || node.nodeId}
                                className={`rounded-2xl border transition p-4 space-y-3 flex flex-col justify-between ${
                                    node.status === 'ONLINE'
                                        ? 'bg-zinc-900/60 border-zinc-800 hover:border-amber-500/40 shadow-lg'
                                        : 'bg-zinc-900/20 border-zinc-800/40 opacity-70'
                                }`}
                            >
                                <div>
                                    <div className="flex items-center justify-between">
                                        <span
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 ${
                                                node.status === 'ONLINE'
                                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                    : 'bg-zinc-700/30 text-zinc-400 border border-zinc-700/40'
                                            }`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full ${node.status === 'ONLINE' ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                                            {node.status}
                                        </span>

                                        <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                                            <MapPin className="w-3 h-3 text-zinc-400" />
                                            <span>{node.locationName || 'Việt Nam'}</span>
                                        </span>
                                    </div>

                                    <h3 className="font-bold text-sm text-zinc-100 mt-2 truncate">{node.nodeName}</h3>
                                    <p className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1">
                                        <span className="text-amber-400 font-semibold">Model:</span> {node.modelDisplayName}
                                    </p>

                                    <div className="grid grid-cols-2 gap-2 mt-3 p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/50 text-[11px]">
                                        <div>
                                            <span className="text-zinc-500 block">CPU Cấp phát:</span>
                                            <span className="text-blue-400 font-mono font-semibold truncate block">{node.cpuCores} Cores Chia sẻ</span>
                                        </div>
                                        <div>
                                            <span className="text-zinc-500 block">RAM Chia sẻ:</span>
                                            <span className="text-indigo-400 font-mono font-semibold">{node.ramGB} GB RAM</span>
                                        </div>
                                        <div>
                                            <span className="text-zinc-500 block">Đồ họa GPU:</span>
                                            <span className="text-zinc-200 font-mono truncate block">{node.gpuName || 'CPU Only'}</span>
                                        </div>
                                        <div>
                                            <span className="text-zinc-500 block">VRAM GPU:</span>
                                            <span className="text-purple-400 font-mono">{node.vramGB ? `${node.vramGB}GB VRAM` : '0 GB (CPU)'}</span>
                                        </div>
                                        <div>
                                            <span className="text-zinc-500 block">Giá thuê/h:</span>
                                            <span className="text-amber-400 font-mono font-bold">{node.coinsPerHour ?? node.pricing?.coinsPerHour ?? 30} Coins</span>
                                        </div>
                                        <div>
                                            <span className="text-zinc-500 block">Giá/1k tokens:</span>
                                            <span className="text-amber-400 font-mono font-bold">{node.coinsPer1kTokens ?? node.pricing?.coinsPer1kTokens ?? 0.5} Coins</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                                    <div className="text-[10px] text-zinc-500">
                                        <span>Đã sinh: </span>
                                        <span className="text-zinc-300 font-mono">{((node.totalTokensServed || 0) / 1000).toFixed(1)}k tokens</span>
                                    </div>

                                    <button
                                        onClick={() => handleToggleStatus(node.id || node.nodeId || '', node.status)}
                                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                                            node.status === 'ONLINE'
                                                ? 'bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/30'
                                                : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30'
                                        }`}
                                    >
                                        {node.status === 'ONLINE' ? 'Tạm Dừng' : 'Bật Online'}
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full py-12 text-center bg-zinc-900/30 border border-zinc-800/60 rounded-2xl space-y-3">
                            <Server className="w-8 h-8 text-zinc-600 mx-auto" />
                            <p className="text-sm text-zinc-400 font-medium">Bạn chưa đăng ký Node nào trên hệ thống.</p>
                            <p className="text-xs text-zinc-500">Nhấn nút &quot;Đăng Ký Máy Mới&quot; ở trên để chia sẻ sức mạnh tính toán và nhận SaveCoin.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Đăng Ký Node Cho Thuê Mới */}
            {isRegisterOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <Server className="w-5 h-5 text-amber-400" />
                                <span>Đăng Ký Máy Tính Làm Node AI Cho Thuê</span>
                            </h3>
                            <button onClick={() => setIsRegisterOpen(false)} className="text-zinc-400 hover:text-white p-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleRegisterNode} className="space-y-3 text-xs">
                            <div>
                                <label className="text-zinc-400 block mb-1">Tên máy trạm / Node:</label>
                                <input
                                    type="text"
                                    value={newNode.nodeName}
                                    onChange={(e) => setNewNode({ ...newNode, nodeName: e.target.value })}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-white focus:border-amber-500 focus:outline-none"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-zinc-400 block mb-1">Card Đồ Họa (GPU):</label>
                                    <input
                                        type="text"
                                        value={newNode.gpuName}
                                        onChange={(e) => setNewNode({ ...newNode, gpuName: e.target.value })}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-zinc-400 block mb-1">VRAM (GB):</label>
                                    <input
                                        type="number"
                                        value={newNode.vramGB}
                                        onChange={(e) => setNewNode({ ...newNode, vramGB: parseInt(e.target.value) })}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-zinc-400 block mb-1">CPU Cores:</label>
                                    <input
                                        type="number"
                                        value={newNode.cpuCores}
                                        onChange={(e) => setNewNode({ ...newNode, cpuCores: parseInt(e.target.value) })}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-zinc-400 block mb-1">RAM (GB):</label>
                                    <input
                                        type="number"
                                        value={newNode.ramGB}
                                        onChange={(e) => setNewNode({ ...newNode, ramGB: parseInt(e.target.value) })}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Khu vực địa lý */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-zinc-400">Vị Trí Địa Lý (Hỗ trợ định tuyến khoảng cách):</label>
                                    <button
                                        type="button"
                                        onClick={handleGetGPS}
                                        disabled={gettingLocation}
                                        className="text-[10px] text-amber-400 hover:underline flex items-center gap-1 font-medium"
                                    >
                                        <MapPin className="w-3 h-3" />
                                        <span>{gettingLocation ? 'Đang định vị...' : 'Lấy vị trí GPS của tôi'}</span>
                                    </button>
                                </div>
                                <select
                                    value={newNode.locationName}
                                    onChange={(e) => {
                                        const loc = e.target.value
                                        let lng = 105.7828, lat = 21.0333
                                        if (loc === 'Quận 1, TP. Hồ Chí Minh') { lng = 106.6992; lat = 10.7769 }
                                        if (loc === 'Hải Châu, Đà Nẵng') { lng = 108.2208; lat = 16.0678 }
                                        if (loc === 'Ninh Kiều, Cần Thơ') { lng = 105.7838; lat = 10.0452 }
                                        setNewNode({ ...newNode, locationName: loc, lng, lat })
                                    }}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-white focus:border-amber-500 focus:outline-none"
                                >
                                    <option value="Cầu Giấy, Hà Nội">Hà Nội (Khu vực Cầu Giấy / Bách Khoa)</option>
                                    <option value="Quận 1, TP. Hồ Chí Minh">TP. Hồ Chí Minh (Quận 1 / Quận 7 / Thủ Đức)</option>
                                    <option value="Hải Châu, Đà Nẵng">Đà Nẵng (Hải Châu / Sơn Trà)</option>
                                    <option value="Ninh Kiều, Cần Thơ">Cần Thơ (Ninh Kiều)</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-zinc-400 block mb-1">Mô hình AI Local Bạn Đang Chạy (Ollama):</label>
                                <select
                                    value={newNode.hostedModel}
                                    onChange={(e) => {
                                        const model = e.target.value
                                        let display = 'Qwen 2.5 Coder (1.5B Instruct)'
                                        if (model === 'deepseek-r1-7b') display = 'DeepSeek-R1 Distill Qwen (7B)'
                                        if (model === 'llama-3.3-8b') display = 'Meta Llama 3.3 (8B Instruct)'
                                        if (model === 'phi-3-mini') display = 'Microsoft Phi-3 Mini (3.8B)'
                                        setNewNode({
                                            ...newNode,
                                            hostedModel: model,
                                            modelDisplayName: display,
                                        })
                                    }}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-white focus:border-amber-500 focus:outline-none"
                                >
                                    <option value="qwen-2.5-coder-1.5b">Qwen 2.5 Coder (1.5B Instruct) - Tối ưu cho code</option>
                                    <option value="deepseek-r1-7b">DeepSeek-R1 Distill Qwen (7B) - Reasoning chuyên sâu</option>
                                    <option value="llama-3.3-8b">Meta Llama 3.3 (8B Instruct) - Đa nhiệm</option>
                                    <option value="phi-3-mini">Microsoft Phi-3 Mini (3.8B) - Nhẹ gọn</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-zinc-400 block mb-1">Giá SaveCoin / giờ:</label>
                                    <input
                                        type="number"
                                        value={newNode.coinsPerHour}
                                        onChange={(e) => setNewNode({ ...newNode, coinsPerHour: parseFloat(e.target.value) })}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-amber-400 font-bold font-mono focus:border-amber-500 focus:outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-zinc-400 block mb-1">Giá SaveCoin / 1k tokens:</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={newNode.coinsPer1kTokens}
                                        onChange={(e) => setNewNode({ ...newNode, coinsPer1kTokens: parseFloat(e.target.value) })}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-amber-400 font-bold font-mono focus:border-amber-500 focus:outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="pt-3 flex items-center justify-end gap-2 border-t border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setIsRegisterOpen(false)}
                                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl disabled:opacity-50 transition"
                                >
                                    {submitting ? 'Đang lưu...' : 'Xác Nhận & Đưa Lên Chợ'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
