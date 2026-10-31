'use client'

import React, { useState, useEffect } from 'react'
import { sellerApi, SellerNodeData, SellerDashboardData } from '@/lib/api/seller'
import { distributedApi } from '@/lib/api/distributed'
import { useConfirm } from '@/context/ConfirmContext'
import { useUser } from '@/hooks/useUser'
import { useWorkerNetwork } from '@/hooks/useWorkerNetwork'
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
    const {
        myNode: desktopNode,
        wsConnected,
        toggleNodeStatus: toggleWorkerStatus,
    } = useWorkerNetwork({
        id: profile?.id,
        name: profile?.name,
        email: profile?.email,
    })

    const [dashboard, setDashboard] = useState<SellerDashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [isRegisterOpen, setIsRegisterOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [gettingLocation, setGettingLocation] = useState(false)

    const currentSellerId = profile?.id || 'usr_seller_01'
    const currentSellerName = profile?.name || 'Minh Tuấn (AI Developer)'

    // Form đăng ký máy mới
    const [newNode, setNewNode] = useState({
        nodeId: '',
        nodeName: '',
        cpuCores: 8,
        ramGB: 16,
        gpuName: 'CPU Mode',
        vramGB: 0,
        hostedModel: 'qwen2.5:1.5b',
        modelDisplayName: 'qwen2.5:1.5b',
        localEndpoint: 'http://localhost:11434',
        coinsPerHour: 35,
        coinsPer1kTokens: 0.5,
        locationName: 'Cầu Giấy, Hà Nội',
        lng: 105.7828,
        lat: 21.0333,
    })

    // Tự động điền thông số từ Electron Worker đang kết nối khi mở form
    useEffect(() => {
        if (desktopNode) {
            const hw = desktopNode.hardware || ({} as any)
            const rent = desktopNode.rentConfig || ({} as any)
            const modelName = desktopNode.activeModel || rent.defaultModel || 'qwen2.5:1.5b'
            setNewNode((prev) => ({
                ...prev,
                nodeId: desktopNode.id,
                nodeName: prev.nodeName || `${desktopNode.username || currentSellerName} Workstation (${hw.gpuName || 'Local PC'})`,
                cpuCores: Number(rent.allocatedCores) || Number(hw.cpuCores) || 8,
                ramGB: Number(rent.allocatedRAMGB) || Number(hw.deviceMemoryGB) || 16,
                gpuName: hw.gpuName || ((desktopNode as any).hasGPU ? 'NVIDIA GPU' : 'CPU Mode'),
                vramGB: Number(hw.vramGB) || 0,
                hostedModel: modelName,
                modelDisplayName: modelName,
                coinsPerHour: Number(rent.minPricePerHourCoin) || 35,
            }))
        }
    }, [desktopNode, currentSellerName])

    const handleFillFromWorker = () => {
        if (!desktopNode) return
        const hw = desktopNode.hardware || ({} as any)
        const rent = desktopNode.rentConfig || ({} as any)
        const modelName = desktopNode.activeModel || rent.defaultModel || 'qwen-2.5-coder-1.5b'
        setNewNode((prev) => ({
            ...prev,
            nodeId: desktopNode.id,
            nodeName: `${desktopNode.username || currentSellerName} Workstation (${hw.gpuName || 'Local PC'})`,
            cpuCores: Number(rent.allocatedCores) || Number(hw.cpuCores) || 8,
            ramGB: Number(rent.allocatedRAMGB) || Number(hw.deviceMemoryGB) || 16,
            gpuName: hw.gpuName || ((desktopNode as any).hasGPU ? 'NVIDIA GPU' : 'CPU Mode'),
            vramGB: Number(hw.vramGB) || 0,
            hostedModel: modelName,
            modelDisplayName: modelName,
            coinsPerHour: Number(rent.minPricePerHourCoin) || 35,
        }))
        notify.success(`Đã nạp thông số từ Electron Worker (${desktopNode.id})`)
    }

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
            await distributedApi.toggleNodeStatus(nodeId, nextStatus === 'ONLINE' ? 'IDLE' : 'OFFLINE').catch(() => null)
            if (desktopNode && (desktopNode.id === nodeId || nodeId.includes(desktopNode.id))) {
                await toggleWorkerStatus(desktopNode.id, currentStatus)
            }
            await loadDashboard()
            notify.success(`Đã chuyển trạng thái máy ${nodeId} sang ${nextStatus}`)
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
        <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 space-y-6 transition-colors duration-200">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border/80 pb-5">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                            Seller Compute Host
                        </span>
                        <span className="text-xs text-muted-foreground">Đối tác Chia sẻ Tài nguyên &amp; Model AI Local</span>
                    </div>
                    <h1 className="text-xl md:text-2xl font-black text-foreground mt-1">
                        Quản Lý Máy Cho Thuê &amp; Chạy Local AI
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
                        Tải ứng dụng Worker về máy cá nhân, chạy model AI offline (Ollama / GGUF) và cho người dùng lân cận thuê tính toán để nhận SaveCoin.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <a
                        href={distributedApi.getDownloadAppUrl()}
                        download
                        className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold rounded-xl border border-border transition flex items-center gap-2 shadow-sm"
                    >
                        <Download className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
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
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                        <Zap className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-amber-600 dark:text-amber-300">Quy Trình 3 Bước Tham Gia Chia Sẻ Compute</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Bước 1: Tải Worker Setup (.exe) &bull; Bước 2: Bật Ollama chạy model (Qwen, DeepSeek...) &bull; Bước 3: Đăng ký Node và vị trí để nhận việc tự động.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <span className="px-3 py-1 bg-secondary text-foreground rounded-lg border border-border flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                        <span>Định tuyến theo khoảng cách</span>
                    </span>
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-500/20 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                        <span>Độ trễ thấp dưới 15ms</span>
                    </span>
                </div>
            </div>

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card border border-border rounded-2xl p-4 space-y-1 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">Máy Đang Hoạt Động</span>
                        <Server className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <strong className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                            {dashboard?.summary.activeNodesCount ?? dashboard?.summary.onlineNodes ?? 0}
                        </strong>
                        <span className="text-xs text-muted-foreground">/ {dashboard?.summary.totalNodes || 0} nodes</span>
                    </div>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Sẵn sàng nhận việc
                    </span>
                </div>

                <div className="bg-card border border-border rounded-2xl p-4 space-y-1 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">SaveCoin Đã Kiếm Được</span>
                        <Coins className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                    </div>
                    <div className="flex items-baseline gap-1">
                        <strong className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                            {dashboard?.summary.totalCoinsEarned?.toLocaleString() || 0}
                        </strong>
                        <span className="text-xs text-amber-600/80 dark:text-amber-400/80">Coins</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Cộng trực tiếp vào ví</span>
                </div>

                <div className="bg-card border border-border rounded-2xl p-4 space-y-1 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">Tokens Đã Phục Vụ</span>
                        <Cpu className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                    </div>
                    <div className="flex items-baseline gap-1">
                        <strong className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                            {((dashboard?.summary.totalTokensServed || 0) / 1000).toFixed(1)}k
                        </strong>
                        <span className="text-xs text-muted-foreground">tokens</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Sinh trực tiếp từ GPU cục bộ</span>
                </div>

                <div className="bg-card border border-border rounded-2xl p-4 space-y-1 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">Đánh Giá Uy Tín</span>
                        <ShieldCheck className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                    </div>
                    <div className="flex items-baseline gap-1">
                        <strong className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">
                            {dashboard?.summary.avgRating || 5.0}
                        </strong>
                        <span className="text-xs text-muted-foreground">/ 5.0</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{dashboard?.summary.totalInferenceRequests || 0} lượt suy luận</span>
                </div>
            </div>

            {/* Live Electron Worker Connection Card */}
            {desktopNode && (
                <div className="bg-card border border-emerald-500/30 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-start md:items-center gap-3">
                        <span className={`mt-1 md:mt-0 w-3 h-3 rounded-full shrink-0 ${wsConnected ? 'bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse' : 'bg-rose-500'}`} />
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-foreground">Electron Worker Cục Bộ: <span className="font-mono text-emerald-600 dark:text-emerald-400">{desktopNode.id}</span></span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${wsConnected ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/30'}`}>
                                    {wsConnected ? 'WebSocket Đã Kết Nối (Online)' : 'Worker Offline'}
                                </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                                Model Ollama: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{desktopNode.activeModel || 'qwen2.5-coder:1.5b'}</strong> &bull; Hardware: {desktopNode.hardware?.gpuName || 'CPU'} ({desktopNode.rentConfig?.allocatedCores || desktopNode.hardware?.cpuCores || 4} cores, {desktopNode.rentConfig?.allocatedRAMGB || desktopNode.hardware?.deviceMemoryGB || 8}GB RAM)
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                        <button
                            type="button"
                            onClick={() => {
                                handleFillFromWorker()
                                setIsRegisterOpen(true)
                            }}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold rounded-xl shadow transition"
                        >
                            Đưa Node Này Lên Chợ Thuê
                        </button>
                    </div>
                </div>
            )}

            {/* My Nodes Section */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                        <Radio className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                        <span>Danh Sách Máy Trạm Cho Thuê Của Bạn</span>
                    </h2>
                    <span className="text-xs text-muted-foreground">Tự động đồng bộ CSDL MongoDB</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dashboard?.nodes && dashboard.nodes.length > 0 ? (
                        dashboard.nodes.map((node) => (
                            <div
                                key={node.id || node.nodeId}
                                className={`rounded-2xl border transition p-4 space-y-3 flex flex-col justify-between ${
                                    node.status === 'ONLINE'
                                        ? 'bg-card border-border hover:border-amber-500/40 shadow-sm'
                                        : 'bg-card/50 border-border/50 opacity-70'
                                }`}
                            >
                                <div>
                                    <div className="flex items-center justify-between">
                                        <span
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 ${
                                                node.status === 'ONLINE'
                                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                                    : 'bg-secondary text-muted-foreground border border-border'
                                            }`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full ${node.status === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
                                            {node.status}
                                        </span>

                                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                            <MapPin className="w-3 h-3 text-muted-foreground" />
                                            <span>{node.locationName || 'Việt Nam'}</span>
                                        </span>
                                    </div>

                                    <h3 className="font-bold text-sm text-foreground mt-2 truncate">{node.nodeName}</h3>
                                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                        <span className="text-amber-600 dark:text-amber-400 font-semibold">Model:</span> {node.modelDisplayName}
                                    </p>

                                    <div className="grid grid-cols-2 gap-2 mt-3 p-2.5 rounded-xl bg-secondary/40 border border-border/80 text-[11px]">
                                        <div>
                                            <span className="text-muted-foreground block">CPU Cấp phát:</span>
                                            <span className="text-blue-600 dark:text-blue-400 font-mono font-semibold truncate block">{node.cpuCores} Cores Chia sẻ</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block">RAM Chia sẻ:</span>
                                            <span className="text-indigo-600 dark:text-indigo-400 font-mono font-semibold">{node.ramGB} GB RAM</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block">Đồ họa GPU:</span>
                                            <span className="text-foreground font-mono truncate block">{node.gpuName || 'CPU Only'}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block">VRAM GPU:</span>
                                            <span className="text-purple-600 dark:text-purple-400 font-mono">{node.vramGB ? `${node.vramGB}GB VRAM` : '0 GB (CPU)'}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block">Giá thuê/h:</span>
                                            <span className="text-amber-600 dark:text-amber-400 font-mono font-bold">{node.coinsPerHour ?? node.pricing?.coinsPerHour ?? 30} Coins</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block">Giá/1k tokens:</span>
                                            <span className="text-amber-600 dark:text-amber-400 font-mono font-bold">{node.coinsPer1kTokens ?? node.pricing?.coinsPer1kTokens ?? 0.5} Coins</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-border/80 flex items-center justify-between">
                                    <div className="text-[10px] text-muted-foreground">
                                        <span>Đã sinh: </span>
                                        <span className="text-foreground font-mono">{((node.totalTokensServed || 0) / 1000).toFixed(1)}k tokens</span>
                                    </div>

                                    <button
                                        onClick={() => handleToggleStatus(node.id || node.nodeId || '', node.status)}
                                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                                            node.status === 'ONLINE'
                                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/30'
                                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                                        }`}
                                    >
                                        {node.status === 'ONLINE' ? 'Tạm Dừng' : 'Bật Online'}
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full py-12 text-center bg-card border border-border rounded-2xl space-y-3">
                            <Server className="w-8 h-8 text-muted-foreground mx-auto" />
                            <p className="text-sm text-foreground font-medium">Bạn chưa đăng ký Node nào trên hệ thống.</p>
                            <p className="text-xs text-muted-foreground">Nhấn nút &quot;Đăng Ký Máy Mới&quot; ở trên để chia sẻ sức mạnh tính toán và nhận SaveCoin.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Đăng Ký Node Cho Thuê Mới */}
            {isRegisterOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-card border border-border text-foreground rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                <Server className="w-5 h-5 text-amber-500" />
                                <span>Đăng Ký Máy Tính Làm Node AI Cho Thuê</span>
                            </h3>
                            <button onClick={() => setIsRegisterOpen(false)} className="text-muted-foreground hover:text-foreground p-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {desktopNode && (
                            <div className="p-3 rounded-xl bg-secondary/50 border border-emerald-500/30 flex items-center justify-between gap-2">
                                <div>
                                    <span className="text-xs font-bold text-foreground block">Phát hiện Worker trên máy này</span>
                                    <span className="text-[10px] text-muted-foreground font-mono">ID: {desktopNode.id} &bull; Model: {desktopNode.activeModel || 'qwen2.5-coder:1.5b'}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleFillFromWorker}
                                    className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold rounded-lg transition"
                                >
                                    Nạp Cấu Hình
                                </button>
                            </div>
                        )}

                        <form onSubmit={handleRegisterNode} className="space-y-3 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-muted-foreground block mb-1">Tên máy trạm / Node:</label>
                                    <input
                                        type="text"
                                        value={newNode.nodeName}
                                        onChange={(e) => setNewNode({ ...newNode, nodeName: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg p-2.5 text-foreground focus:border-amber-500 focus:outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-muted-foreground block mb-1">Node ID (Liên kết Electron):</label>
                                    <input
                                        type="text"
                                        value={newNode.nodeId}
                                        onChange={(e) => setNewNode({ ...newNode, nodeId: e.target.value })}
                                        placeholder={desktopNode?.id || "Để trống để tự tạo"}
                                        className="w-full bg-background border border-border rounded-lg p-2.5 text-foreground font-mono focus:border-amber-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-muted-foreground block mb-1">Card Đồ Họa (GPU):</label>
                                    <input
                                        type="text"
                                        value={newNode.gpuName}
                                        onChange={(e) => setNewNode({ ...newNode, gpuName: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg p-2 text-foreground font-mono focus:border-amber-500 focus:outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-muted-foreground block mb-1">VRAM (GB):</label>
                                    <input
                                        type="number"
                                        value={newNode.vramGB}
                                        onChange={(e) => setNewNode({ ...newNode, vramGB: parseInt(e.target.value) })}
                                        className="w-full bg-background border border-border rounded-lg p-2 text-foreground font-mono focus:border-amber-500 focus:outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-muted-foreground block mb-1">CPU Cores:</label>
                                    <input
                                        type="number"
                                        value={newNode.cpuCores}
                                        onChange={(e) => setNewNode({ ...newNode, cpuCores: parseInt(e.target.value) })}
                                        className="w-full bg-background border border-border rounded-lg p-2 text-foreground font-mono focus:border-amber-500 focus:outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-muted-foreground block mb-1">RAM (GB):</label>
                                    <input
                                        type="number"
                                        value={newNode.ramGB}
                                        onChange={(e) => setNewNode({ ...newNode, ramGB: parseInt(e.target.value) })}
                                        className="w-full bg-background border border-border rounded-lg p-2 text-foreground font-mono focus:border-amber-500 focus:outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Khu vực địa lý */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-muted-foreground">Vị Trí Địa Lý (Hỗ trợ định tuyến khoảng cách):</label>
                                    <button
                                        type="button"
                                        onClick={handleGetGPS}
                                        disabled={gettingLocation}
                                        className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-medium"
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
                                    className="w-full bg-background border border-border rounded-lg p-2.5 text-foreground focus:border-amber-500 focus:outline-none"
                                >
                                    <option value="Cầu Giấy, Hà Nội">Hà Nội (Khu vực Cầu Giấy / Bách Khoa)</option>
                                    <option value="Quận 1, TP. Hồ Chí Minh">TP. Hồ Chí Minh (Quận 1 / Quận 7 / Thủ Đức)</option>
                                    <option value="Hải Châu, Đà Nẵng">Đà Nẵng (Hải Châu / Sơn Trà)</option>
                                    <option value="Ninh Kiều, Cần Thơ">Cần Thơ (Ninh Kiều)</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-muted-foreground block mb-1">Mô hình AI Local Bạn Đang Chạy (Ollama):</label>
                                <select
                                    value={newNode.hostedModel}
                                    onChange={(e) => {
                                        const model = e.target.value
                                        let display = model
                                        if (model === 'qwen-2.5-coder-1.5b') display = 'Qwen 2.5 Coder (1.5B Instruct)'
                                        else if (model === 'deepseek-r1-7b') display = 'DeepSeek-R1 Distill Qwen (7B)'
                                        else if (model === 'llama-3.3-8b') display = 'Meta Llama 3.3 (8B Instruct)'
                                        else if (model === 'phi-3-mini') display = 'Microsoft Phi-3 Mini (3.8B)'
                                        setNewNode({
                                            ...newNode,
                                            hostedModel: model,
                                            modelDisplayName: display,
                                        })
                                    }}
                                    className="w-full bg-background border border-border rounded-lg p-2.5 text-foreground focus:border-amber-500 focus:outline-none"
                                >
                                    {desktopNode && Array.isArray(desktopNode.compatibleModels) && desktopNode.compatibleModels.length > 0 && (
                                        <optgroup label="Mô hình phát hiện từ Ollama của bạn">
                                            {desktopNode.compatibleModels.map((m) => (
                                                <option key={m} value={m}>
                                                    {m} (Đang có sẵn trong máy)
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                    <optgroup label="Mô hình tiêu chuẩn">
                                        <option value="qwen-2.5-coder-1.5b">Qwen 2.5 Coder (1.5B Instruct) - Tối ưu cho code</option>
                                        <option value="deepseek-r1-7b">DeepSeek-R1 Distill Qwen (7B) - Reasoning chuyên sâu</option>
                                        <option value="llama-3.3-8b">Meta Llama 3.3 (8B Instruct) - Đa nhiệm</option>
                                        <option value="phi-3-mini">Microsoft Phi-3 Mini (3.8B) - Nhẹ gọn</option>
                                    </optgroup>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-muted-foreground block mb-1">Giá SaveCoin / giờ:</label>
                                    <input
                                        type="number"
                                        value={newNode.coinsPerHour}
                                        onChange={(e) => setNewNode({ ...newNode, coinsPerHour: parseFloat(e.target.value) })}
                                        className="w-full bg-background border border-border rounded-lg p-2 text-amber-600 dark:text-amber-400 font-bold font-mono focus:border-amber-500 focus:outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-muted-foreground block mb-1">Giá SaveCoin / 1k tokens:</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={newNode.coinsPer1kTokens}
                                        onChange={(e) => setNewNode({ ...newNode, coinsPer1kTokens: parseFloat(e.target.value) })}
                                        className="w-full bg-background border border-border rounded-lg p-2 text-amber-600 dark:text-amber-400 font-bold font-mono focus:border-amber-500 focus:outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="pt-3 flex items-center justify-end gap-2 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => setIsRegisterOpen(false)}
                                    className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-xl border border-border transition"
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
