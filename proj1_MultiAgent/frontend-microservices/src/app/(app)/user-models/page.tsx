'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import Globe3DView, { GeoNode, GeoLink } from '@/components/network/Globe3DView'
import WorldMap2DView from '@/components/network/WorldMap2DView'
import ClusterTopology3DView, { ClusterNode3D } from '@/components/network/ClusterTopology3DView'
import {
    IconGlobe,
    IconMap,
    IconWorkflow,
    IconZap,
    IconServer,
    IconLink,
    IconMapPin,
} from '@/components/ui/icons'
import PartnerOnboardingModal from '@/components/distributed/PartnerOnboardingModal'
import { useUser } from '@/hooks/useUser'
import { PartnerNodeData } from '@/lib/api/distributed'
import { useWorkerNetwork } from '@/hooks/useWorkerNetwork'
import { notify } from '@/lib/toast'
import {
    Server,
    Bot,
    Cpu,
    Zap,
    Radio,
    ArrowRight,
    CheckCircle2,
} from 'lucide-react'

const DEFAULT_HUB = { city: 'Hà Nội', country: 'Việt Nam', lat: 21.0285, lng: 105.8542 }

export default function UserModelsPage() {
    const { profile } = useUser()
    const {
        allNodes,
        onlineNodes,
        activeConnections,
        loading,
        wsConnected,
        upsertRegisteredNode,
    } = useWorkerNetwork({
        id: profile?.id,
        name: profile?.name,
        email: profile?.email,
    })

    const [selectedModelFilter, setSelectedModelFilter] = useState<string | null>(null)
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
    const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false)

    // View mode: 'topology' (3D Cluster Graph) | 'connections' (Seller ⇄ Owner P2P Streams) | 'globe' (3D Earth) | 'map2d' (2D Geospatial)
    const [viewMode, setViewMode] = useState<'topology' | 'connections' | 'globe' | 'map2d'>('topology')

    const handlePartnerRegistered = (newNode: PartnerNodeData) => {
        upsertRegisteredNode(newNode)
        notify.success(
            'Đã lưu cấu hình Đối tác! Hãy mở ứng dụng Go-Python Worker (.exe) trên máy để Node xuất hiện trong Cụm 3D.'
        )
    }

    // CHỈ các máy Seller đang thực sự chạy ứng dụng Electron Worker (onlineNodes) mới nằm trong mạng lưới
    const filteredOnlineNodes = useMemo(() => {
        if (!selectedModelFilter) return onlineNodes
        return onlineNodes.filter((n) => n.compatibleModels?.includes(selectedModelFilter))
    }, [onlineNodes, selectedModelFilter])

    // Danh sách toàn bộ model từ các máy đang trực tuyến
    const allModels = useMemo(() => {
        const set = new Set<string>()
        onlineNodes.forEach((n) => {
            n.compatibleModels?.forEach((m) => set.add(m))
        })
        return Array.from(set)
    }, [onlineNodes])

    // Chuyển đổi sang GeoNode cho Địa cầu 3D & Bản đồ 2D
    const geoNodes: GeoNode[] = useMemo(() => {
        return filteredOnlineNodes.map((n) => {
            const loc = n.location || DEFAULT_HUB
            return {
                id: n.id,
                name: n.username || n.id,
                email: n.email || '',
                city: loc.city,
                country: loc.country,
                lat: loc.lat,
                lng: loc.lng,
                status: n.status === 'BUSY' ? 'BUSY' : 'IDLE',
                gpuName: n.hardware?.gpuName,
                models: n.compatibleModels || ['qwen2.5-coder:1.5b'],
                latencyMs: n.latencyMs || 8,
                bandwidthMbps: n.bandwidthMbps || 1200,
            }
        })
    }, [filteredOnlineNodes])

    // Tạo các đường liên kết P2P giữa các Node cùng Model đang trực tuyến
    const geoLinks: GeoLink[] = useMemo(() => {
        const links: GeoLink[] = []
        for (let i = 0; i < geoNodes.length; i++) {
            for (let j = i + 1; j < geoNodes.length; j++) {
                const nodeA = geoNodes[i]
                const nodeB = geoNodes[j]

                const shared = nodeA.models.filter((m) => nodeB.models.includes(m))
                if (shared.length > 0) {
                    const activeModel = selectedModelFilter ? selectedModelFilter : shared[0]
                    if (!selectedModelFilter || shared.includes(selectedModelFilter)) {
                        links.push({
                            from: nodeA,
                            to: nodeB,
                            model: activeModel,
                            latency: Math.round((nodeA.latencyMs + nodeB.latencyMs) / 2),
                        })
                    }
                }
            }
        }
        return links
    }, [geoNodes, selectedModelFilter])

    // Chuyển đổi sang định dạng Node 3D cho Đồ thị Topo 3D
    const cluster3DNodes: ClusterNode3D[] = useMemo(() => {
        return geoNodes.map((n) => {
            const matched = filteredOnlineNodes.find((f) => f.id === n.id)
            return {
                id: n.id,
                name: n.name,
                model: n.models?.[0] || 'qwen2.5-coder:1.5b',
                status: n.status,
                gpuName: n.gpuName,
                cpuCores: matched?.hardware?.cpuCores,
                ramGB: matched?.hardware?.deviceMemoryGB,
                latencyMs: n.latencyMs,
                bandwidthMbps: n.bandwidthMbps,
                city: n.city,
            }
        })
    }, [geoNodes, filteredOnlineNodes])

    const totalBandwidthGbps = useMemo(() => {
        const mbps = geoNodes.reduce((sum, n) => sum + (n.bandwidthMbps || 0), 0)
        return (mbps / 1000).toFixed(1)
    }, [geoNodes])

    const avgLatency = useMemo(() => {
        if (geoNodes.length === 0) return 0
        const total = geoNodes.reduce((sum, n) => sum + n.latencyMs, 0)
        return Math.round(total / geoNodes.length)
    }, [geoNodes])

    const offlineRegisteredCount = useMemo(
        () => allNodes.filter((n) => n.status === 'OFFLINE').length,
        [allNodes]
    )

    if (loading) {
        return (
            <div className="flex items-center justify-center p-16 text-xs text-zinc-500">
                Đang khởi tạo kết nối WebSocket mạng lưới đối tác...
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* 1. HEADER TRANG & NÚT GIA NHẬP ĐỐI TÁC */}
            <div className="border-b border-border pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <IconGlobe className="w-5 h-5 text-blue-400" />
                        <h1 className="text-base font-bold text-white">
                            Mạng Lưới Đối Tác Mô Hình & Cụm Tính Toán 3D
                        </h1>
                        <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                wsConnected
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-zinc-800 text-zinc-400 border-border'
                            }`}
                        >
                            {wsConnected ? 'WebSocket Real-time' : 'Đang kết nối WS...'}
                        </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">
                        Đồng bộ trực tiếp với <strong>Kiểm tra Node AI</strong>: Chỉ những máy Seller đang mở ứng dụng <strong>Electron Worker (.exe)</strong> mới kết nối và xuất hiện trong mạng lưới.
                    </p>
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto">
                    <Link
                        href="/node-checker"
                        className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-border font-semibold text-xs transition flex items-center gap-1.5"
                    >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Kiểm Tra Node AI</span>
                    </Link>

                    <button
                        onClick={() => setIsPartnerModalOpen(true)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition flex items-center gap-2 shrink-0"
                    >
                        <IconZap className="w-4 h-4 fill-current" />
                        <span>Đăng Ký Đối Tác & Tải Worker (.exe)</span>
                    </button>
                </div>
            </div>

            {/* 2. CHỈ SỐ TỔNG QUAN HỆ THỐNG (CHỈ TÍNH NODE ĐANG CHẠY ELECTRON WORKER) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-card/60 backdrop-blur-md border border-border space-y-1">
                    <span className="text-[11px] text-zinc-400">Worker Đang Trực Tuyến</span>
                    <div className="flex items-baseline gap-1">
                        <strong className="text-2xl font-black text-emerald-400 font-mono">
                            {onlineNodes.length}
                        </strong>
                        <span className="text-xs text-zinc-500">máy đang chạy .exe</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">
                        {offlineRegisteredCount > 0
                            ? `${offlineRegisteredCount} cấu hình đang chờ mở Worker`
                            : 'Truyền tải qua WebSocket P2P'}
                    </span>
                </div>

                <div className="p-4 rounded-2xl bg-card/60 backdrop-blur-md border border-border space-y-1">
                    <span className="text-[11px] text-zinc-400">Luồng Streaming LLM Local</span>
                    <div className="flex items-baseline gap-1">
                        <strong className="text-2xl font-black text-cyan-400 font-mono">
                            {activeConnections.length}
                        </strong>
                        <span className="text-xs text-cyan-400/80 font-mono">kênh P2P</span>
                    </div>
                    <span className="text-[10px] text-emerald-400">Seller ⇄ Owner đang kết nối</span>
                </div>

                <div className="p-4 rounded-2xl bg-card/60 backdrop-blur-md border border-border space-y-1">
                    <span className="text-[11px] text-zinc-400">Tổng Băng Thông Mạng</span>
                    <div className="flex items-baseline gap-1">
                        <strong className="text-2xl font-black text-blue-400 font-mono">
                            {totalBandwidthGbps}
                        </strong>
                        <span className="text-xs text-blue-400/80 font-mono">Gbps</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">Từ các Worker đang Online</span>
                </div>

                <div className="p-4 rounded-2xl bg-card/60 backdrop-blur-md border border-border space-y-1">
                    <span className="text-[11px] text-zinc-400">Độ Trễ Trung Bình (Ping)</span>
                    <div className="flex items-baseline gap-1">
                        <strong className="text-2xl font-black text-amber-400 font-mono">
                            {avgLatency}
                        </strong>
                        <span className="text-xs text-amber-400/80 font-mono">ms</span>
                    </div>
                    <span className="text-[10px] text-emerald-400">
                        {onlineNodes.length > 0 ? 'Đo trực tiếp từ Electron Worker' : 'Chưa có Worker kết nối'}
                    </span>
                </div>
            </div>

            {/* 3. KHÔNG GIAN BẢN ĐỒ, TOPO 3D & TAB KẾT NỐI SELLER ⇄ OWNER */}
            <div className="rounded-2xl border border-border bg-card/75 backdrop-blur-md p-4 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-border/80">
                    {/* Bộ lọc Mô hình */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                        <span className="text-xs font-semibold text-zinc-400 mr-1 shrink-0">Cụm Model:</span>
                        <button
                            onClick={() => setSelectedModelFilter(null)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition shrink-0 ${
                                selectedModelFilter === null
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                        >
                            Tất cả ({onlineNodes.length})
                        </button>
                        {allModels.map((m) => (
                            <button
                                key={m}
                                onClick={() => setSelectedModelFilter(m)}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition shrink-0 ${
                                    selectedModelFilter === m
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                                }`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>

                    {/* Bộ 4 Chế Độ Hiển Thị: Topo 3D, Kết Nối P2P, Địa Cầu 3D, Bản Đồ 2D */}
                    <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-border flex-wrap shrink-0">
                        <button
                            onClick={() => setViewMode('topology')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                viewMode === 'topology'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                            }`}
                        >
                            <IconWorkflow className="w-3.5 h-3.5" />
                            <span>Đồ Thị Topo 3D</span>
                        </button>

                        <button
                            onClick={() => setViewMode('connections')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                viewMode === 'connections'
                                    ? 'bg-cyan-600 text-white shadow-sm'
                                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                            }`}
                        >
                            <Zap className="w-3.5 h-3.5 text-cyan-300" />
                            <span>Kết Nối Seller ⇄ Owner ({activeConnections.length})</span>
                        </button>

                        <button
                            onClick={() => setViewMode('globe')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                viewMode === 'globe'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                            }`}
                        >
                            <IconGlobe className="w-3.5 h-3.5" />
                            <span>Địa Cầu 3D</span>
                        </button>

                        <button
                            onClick={() => setViewMode('map2d')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                viewMode === 'map2d'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                            }`}
                        >
                            <IconMap className="w-3.5 h-3.5" />
                            <span>Bản Đồ 2D</span>
                        </button>
                    </div>
                </div>

                {/* KHUNG HIỂN THỊ CHÍNH */}
                <div className="w-full min-h-[480px] rounded-xl overflow-hidden bg-zinc-950 border border-border relative">
                    {/* TAB 1: TOPO 3D CHIỀU SÂU */}
                    {viewMode === 'topology' && (
                        <div className="w-full h-[480px]">
                            <ClusterTopology3DView
                                nodes={cluster3DNodes}
                                activeModelFilter={selectedModelFilter}
                                selectedNodeId={selectedNodeId}
                                onSelectNode={setSelectedNodeId}
                            />
                        </div>
                    )}

                    {/* TAB 2: CÁC SELLER VÀ OWNER KẾT NỐI VỚI NHAU ĐỂ TRUYỀN TẢI LLM LOCAL */}
                    {viewMode === 'connections' && (
                        <div className="w-full p-5 space-y-4 bg-zinc-950/90 text-white">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                                        Luồng Truyền Tải Mô Hình LLM Local Đang Hoạt Động (P2P WebSocket Bridge)
                                    </h3>
                                </div>
                                <span className="text-[11px] text-zinc-400">
                                    {activeConnections.length} phiên kết nối trực tiếp
                                </span>
                            </div>

                            {activeConnections.length === 0 ? (
                                <div className="py-16 text-center space-y-3">
                                    <Radio className="w-10 h-10 text-zinc-600 mx-auto animate-pulse" />
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-bold text-zinc-300">
                                            Chưa có phiên kết nối Seller ⇄ Owner nào đang truyền tải LLM
                                        </h4>
                                        <p className="text-xs text-zinc-500 max-w-md mx-auto">
                                            Khi một Owner vào trang <strong>Thuê AI Cho Agent</strong> và chọn thuê một máy trạm của Seller đang chạy Worker, kênh truyền tải P2P sẽ được thiết lập tại đây.
                                        </p>
                                    </div>
                                    <Link
                                        href="/owner"
                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition"
                                    >
                                        <span>Đến Sàn Thuê Máy & Kết Nối Ngay</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                                    {activeConnections.map((conn: any, idx: number) => {
                                        const sId = conn.sessionId || conn.id || conn._id || `sess_${idx}`
                                        const displayId = String(sId).length > 8 ? String(sId).slice(-8) : String(sId)

                                        return (
                                            <div
                                                key={sId}
                                                className="bg-zinc-900/60 border border-border hover:border-cyan-500/40 rounded-2xl p-4 transition shadow-lg space-y-3"
                                            >
                                                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                                        <span className="text-[11px] font-mono text-zinc-400">
                                                            Mã phiên: <strong className="text-zinc-200">{displayId}</strong>
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                                            STREAMING REAL-TIME
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-zinc-500 font-mono">
                                                        Bắt đầu: {conn.startTime ? new Date(conn.startTime).toLocaleTimeString() : 'Vừa xong'}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-center">
                                                    <div className="md:col-span-3 bg-zinc-950/80 p-3.5 rounded-xl border border-blue-500/30 space-y-1.5">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                                                                <Server className="w-3.5 h-3.5 text-blue-400" />
                                                                <span>SELLER (HOST CUNG CẤP GPU)</span>
                                                            </span>
                                                            <span className="text-[9px] text-zinc-500 font-mono">
                                                                {conn.sellerId ? String(conn.sellerId).slice(-6) : 'seller_01'}
                                                            </span>
                                                        </div>
                                                        <h4 className="text-xs font-bold text-white truncate">
                                                            {conn.nodeName || 'PC Gaming RTX Node'}
                                                        </h4>
                                                        <p className="text-[11px] text-blue-300 font-semibold flex items-center gap-1.5">
                                                            <Bot className="w-3.5 h-3.5 text-blue-400" />
                                                            <span>{conn.modelDisplayName || conn.modelKey || 'Qwen 2.5 Coder'}</span>
                                                        </p>
                                                        <div className="text-[10px] text-zinc-400 flex items-center justify-between pt-1 border-t border-border/60 font-sans">
                                                            <span>Chủ máy: <strong className="text-zinc-200">{conn.sellerName || 'Seller Host'}</strong></span>
                                                            <span className="text-amber-400 font-mono font-bold">
                                                                {conn.coinsPerHour || 35} coins/h
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="md:col-span-1 flex flex-col items-center justify-center py-2 space-y-1 text-center">
                                                        <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider font-mono">
                                                            P2P STREAM
                                                        </span>
                                                        <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                                                            <Zap className="w-4 h-4 animate-bounce text-cyan-400" />
                                                        </div>
                                                        <span className="text-[9px] text-emerald-400 font-mono font-bold">
                                                            Ping ~8ms
                                                        </span>
                                                    </div>

                                                    <div className="md:col-span-3 bg-zinc-950/80 p-3.5 rounded-xl border border-emerald-500/30 space-y-1.5">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                                                                <Bot className="w-3.5 h-3.5 text-emerald-400" />
                                                                <span>OWNER (NGƯỜI THUÊ & NẠP AGENT)</span>
                                                            </span>
                                                            <span className="text-[9px] text-zinc-500 font-mono">
                                                                {conn.renterId ? String(conn.renterId).slice(-6) : 'owner_01'}
                                                            </span>
                                                        </div>
                                                        <h4 className="text-xs font-bold text-white truncate">
                                                            {conn.renterName || 'Project Leader'}
                                                        </h4>
                                                        <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
                                                            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                                                            <span>Agent: {conn.boundAgentName || conn.assignedAgentId || 'Multi-Agent Lead'}</span>
                                                        </p>
                                                        <div className="text-[10px] text-zinc-400 flex items-center justify-between pt-1 border-t border-border/60 font-sans">
                                                            <span>Tokens nạp: <strong className="text-indigo-400 font-mono font-bold">{conn.totalTokensUsed?.toLocaleString() || 0}</strong></span>
                                                            <span className="text-amber-400 font-mono font-bold">
                                                                -{conn.totalCoinsSpent || 0} coins
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 3: ĐỊA CẦU 3D */}
                    {viewMode === 'globe' && (
                        <div className="w-full h-[480px]">
                            <Globe3DView
                                nodes={geoNodes}
                                links={geoLinks}
                                selectedNodeId={selectedNodeId}
                                onSelectNode={setSelectedNodeId}
                            />
                        </div>
                    )}

                    {/* TAB 4: BẢN ĐỒ 2D */}
                    {viewMode === 'map2d' && (
                        <div className="w-full h-[480px]">
                            <WorldMap2DView
                                nodes={geoNodes}
                                links={geoLinks}
                                selectedNodeId={selectedNodeId}
                                onSelectNode={setSelectedNodeId}
                            />
                        </div>
                    )}
                </div>

                {/* 4. THANH TRẠNG THÁI LIÊN KẾT ĐANG KẾT NỐI */}
                <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-border text-xs space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 font-semibold border-b border-border/80 pb-1.5">
                        <span className="flex items-center gap-1.5 text-cyan-400">
                            <IconLink className="w-3.5 h-3.5" />
                            Liên Kết P2P Giữa Các Máy Đang Chạy Worker ({geoLinks.length} Luồng):
                        </span>
                        {selectedNodeId && (
                            <button
                                onClick={() => setSelectedNodeId(null)}
                                className="text-zinc-500 hover:text-zinc-200 text-[10px]"
                            >
                                Bỏ chọn Node
                            </button>
                        )}
                    </div>

                    <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                        {geoLinks.length === 0 ? (
                            <div className="text-zinc-500 text-[11px] py-2 text-center">
                                {onlineNodes.length === 1
                                    ? 'Đang có 1 máy Seller chạy Electron Worker trực tuyến. Khi có từ 2 máy chạy cùng model trở lên, đường nối cụm P2P sẽ tự động hình thành.'
                                    : 'Chưa có liên kết cụm nào. Khi máy Seller khởi chạy Go-Python Worker (.exe), Node sẽ lập tức vào mạng lưới.'}
                            </div>
                        ) : (
                            geoLinks.slice(0, 6).map((link, idx) => {
                                const isHighlighted =
                                    selectedNodeId === link.from.id || selectedNodeId === link.to.id

                                return (
                                    <div
                                        key={idx}
                                        className={`flex items-center justify-between p-2 rounded-lg text-[11px] transition ${
                                            isHighlighted
                                                ? 'bg-blue-600/20 border border-blue-500/30 text-white'
                                                : 'bg-zinc-900/60 hover:bg-zinc-900 text-zinc-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                            <span className="font-semibold text-white">
                                                {link.from.city} ({link.from.name})
                                            </span>
                                            <span className="text-zinc-500">⇄</span>
                                            <span className="font-semibold text-white">
                                                {link.to.city} ({link.to.name})
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 text-[10px] font-mono border border-blue-500/20">
                                                {link.model}
                                            </span>
                                            <span className="text-zinc-500 text-[10px]">
                                                Ping: <strong className="text-emerald-400 font-mono">{link.latency}ms</strong>
                                            </span>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* 5. DANH SÁCH MÁY TRẠM ĐANG CHẠY ELECTRON WORKER TRỰC TUYẾN */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                        Danh Sách Máy Trạm Đang Kết Nối Qua Electron Worker ({filteredOnlineNodes.length})
                    </h3>
                </div>

                {filteredOnlineNodes.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-12 text-center space-y-3">
                        <IconServer className="w-10 h-10 text-zinc-600 mx-auto" />
                        <h4 className="text-sm font-bold text-zinc-300">
                            Chưa có máy trạm Seller nào đang chạy Electron Worker (.exe)
                        </h4>
                        <p className="text-xs text-zinc-500 max-w-md mx-auto">
                            Chỉ khi máy Seller khởi chạy ứng dụng <strong>Go-Python Worker Monitor (.exe)</strong> và kết nối WebSocket thành công, máy trạm mới xuất hiện trực tiếp trên Cụm 3D và danh sách này.
                        </p>
                        <div className="flex items-center justify-center gap-3 pt-1">
                            <Link
                                href="/node-checker"
                                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-border font-semibold text-xs transition inline-flex items-center gap-1.5"
                            >
                                <span>Mở Trang Kiểm Tra Node AI</span>
                            </Link>
                            <button
                                onClick={() => setIsPartnerModalOpen(true)}
                                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/25 transition inline-flex items-center gap-1.5"
                            >
                                <IconZap className="w-4 h-4 fill-current" />
                                <span>Tải App & Cấu Hình Đối Tác</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredOnlineNodes.map((node) => {
                            const isSelected = selectedNodeId === node.id
                            const loc = node.location || DEFAULT_HUB
                            const cpuPercent = node.lastTelemetry?.cpu_percent ?? 0
                            const ramPercent = node.lastTelemetry?.ram_percent ?? 0

                            return (
                                <div
                                    key={node.id}
                                    onClick={() => setSelectedNodeId(node.id)}
                                    className={`p-4 rounded-2xl border transition space-y-3.5 flex flex-col justify-between cursor-pointer ${
                                        isSelected
                                            ? 'bg-blue-950/20 border-blue-500/60 shadow-lg shadow-blue-500/5'
                                            : 'bg-card/60 backdrop-blur-md border-border hover:border-border'
                                    }`}
                                >
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-full bg-zinc-800 border border-border flex items-center justify-center text-xs font-bold text-blue-400">
                                                    {node.username ? node.username.charAt(0).toUpperCase() : 'W'}
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-xs text-white flex items-center gap-1.5">
                                                        <span>{node.username || node.id}</span>
                                                    </h4>
                                                    <p className="text-[10px] text-zinc-400 flex items-center gap-1">
                                                        <IconMapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                                                        <span>
                                                            {loc.city}, {loc.country}
                                                        </span>
                                                    </p>
                                                </div>
                                            </div>

                                            <span
                                                className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                                                    node.status === 'BUSY'
                                                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                }`}
                                            >
                                                ● {node.status}
                                            </span>
                                        </div>

                                        {/* Cấu hình phần cứng + Telemetry thực tế từ Worker */}
                                        <div className="grid grid-cols-2 gap-2 bg-zinc-950/60 p-2.5 rounded-xl text-[11px]">
                                            <div>
                                                <span className="text-zinc-500 text-[10px] block">CPU / RAM:</span>
                                                <span className="font-semibold text-zinc-200">
                                                    {node.hardware?.cpuCores || 8}C / {node.hardware?.deviceMemoryGB || 16}GB
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-zinc-500 text-[10px] block">Tải Tức Thời:</span>
                                                <span className="font-semibold text-cyan-400 font-mono">
                                                    CPU {cpuPercent.toFixed(0)}% · RAM {ramPercent.toFixed(0)}%
                                                </span>
                                            </div>
                                            <div className="col-span-2 pt-1 border-t border-border/60 flex items-center justify-between">
                                                <span className="text-zinc-400 truncate max-w-[180px]">
                                                    {node.hardware?.gpuName || 'CPU Mode'}
                                                </span>
                                                <span className="text-emerald-400 font-mono text-[10px]">
                                                    Ping: {node.latencyMs || 8}ms
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Models hỗ trợ */}
                                    <div className="pt-2 border-t border-border/60 space-y-1">
                                        <div className="flex flex-wrap gap-1">
                                            {node.compatibleModels?.map((m) => (
                                                <span
                                                    key={m}
                                                    className={`text-[9px] px-2 py-0.5 rounded-md border font-medium transition ${
                                                        selectedModelFilter === m
                                                            ? 'bg-blue-600 text-white border-blue-400'
                                                            : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                                                    }`}
                                                >
                                                    {m}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Modal Onboarding Đối Tác Mô Hình & Tải Desktop Client */}
            <PartnerOnboardingModal
                isOpen={isPartnerModalOpen}
                onClose={() => setIsPartnerModalOpen(false)}
                currentUser={{
                    id: profile?.id,
                    username: profile?.name,
                    email: profile?.email,
                }}
                onPartnerRegistered={handlePartnerRegistered}
            />
        </div>
    )
}
