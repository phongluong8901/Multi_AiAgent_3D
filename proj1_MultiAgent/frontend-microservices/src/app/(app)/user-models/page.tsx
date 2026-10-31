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
    HardDrive,
    Layers,
    Activity,
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

    // Bộ lọc hiển thị không gian: 'topology' (Topo 3D) | 'globe' (Địa Cầu 3D) | 'map2d' (Bản Đồ 2D)
    const [viewMode, setViewMode] = useState<'topology' | 'globe' | 'map2d'>('topology')

    // Bộ lọc loại kết nối: 'all' (Tất cả) | 'seller-seller' (P2P Seller ⇄ Seller) | 'seller-owner' (Streaming Seller ⇄ Owner)
    const [connectionFilter, setConnectionFilter] = useState<'all' | 'seller-seller' | 'seller-owner'>('all')

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

    // Chuyển đổi sang GeoNode cho Địa cầu 3D & Bản đồ 2D từ Seller Nodes (lấy cấu hình chia sẻ từ rentConfig)
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
                gpuName: n.rentConfig?.enableGPU !== false ? (n.hardware?.gpuName || 'CPU') : 'CPU Only',
                models: n.compatibleModels || ['qwen2.5-coder:1.5b'],
                latencyMs: n.latencyMs || 8,
                bandwidthMbps: n.bandwidthMbps || 1200,
            }
        })
    }, [filteredOnlineNodes])

    // Đường liên kết P2P giữa các Seller nodes cùng model
    const sellerSellerLinks: GeoLink[] = useMemo(() => {
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
                            type: 'seller-seller',
                        })
                    }
                }
            }
        }
        return links
    }, [geoNodes, selectedModelFilter])

    // Đường liên kết streaming giữa Seller và Owner đang thuê máy (Inference Sessions)
    const sellerOwnerLinks: GeoLink[] = useMemo(() => {
        const links: GeoLink[] = []
        activeConnections.forEach((conn: any, idx: number) => {
            const seller = geoNodes.find((g) => g.id === conn.nodeId) || geoNodes[0]
            if (!seller) return

            const ownerNode: GeoNode = {
                id: `owner_${conn.renterId || idx}`,
                name: `${conn.renterName || 'Agent Owner'} (Renter)`,
                email: conn.renterId || 'owner@network.ai',
                city: `${conn.assignedAgentId || 'Agent'} Gateway`,
                country: 'Client Hub',
                lat: seller.lat + (idx % 2 === 0 ? 0.35 : -0.35),
                lng: seller.lng + (idx % 2 === 0 ? 0.5 : -0.5),
                status: 'BUSY',
                gpuName: 'Agent Client',
                models: [conn.modelDisplayName || conn.modelKey || 'qwen2.5-coder:1.5b'],
                latencyMs: 6,
                bandwidthMbps: 2500,
            }

            links.push({
                from: seller,
                to: ownerNode,
                model: conn.modelDisplayName || conn.modelKey || 'Inference Stream',
                latency: 12,
                type: 'seller-owner',
            })
        })
        return links
    }, [activeConnections, geoNodes])

    // Lọc các đường liên kết theo bộ lọc kết nối
    const effectiveGeoLinks: GeoLink[] = useMemo(() => {
        if (connectionFilter === 'seller-seller') return sellerSellerLinks
        if (connectionFilter === 'seller-owner') return sellerOwnerLinks
        return [...sellerSellerLinks, ...sellerOwnerLinks]
    }, [connectionFilter, sellerSellerLinks, sellerOwnerLinks])

    // Danh sách Node hiển thị trên quả địa cầu và bản đồ 2D
    const displayGeoNodes: GeoNode[] = useMemo(() => {
        if (connectionFilter === 'seller-seller') return geoNodes

        const ownerNodes: GeoNode[] = []
        activeConnections.forEach((conn: any, idx: number) => {
            const ownerId = `owner_${conn.renterId || idx}`
            if (!ownerNodes.find((o) => o.id === ownerId)) {
                const seller = geoNodes.find((g) => g.id === conn.nodeId) || geoNodes[0]
                ownerNodes.push({
                    id: ownerId,
                    name: `${conn.renterName || 'Agent Owner'}`,
                    email: conn.renterId || 'owner@network.ai',
                    city: `${conn.assignedAgentId || 'Agent'} Hub`,
                    country: 'Client',
                    lat: (seller ? seller.lat : 21.0285) + (idx % 2 === 0 ? 0.35 : -0.35),
                    lng: (seller ? seller.lng : 105.8542) + (idx % 2 === 0 ? 0.5 : -0.5),
                    status: 'BUSY',
                    gpuName: 'Agent Client',
                    models: [conn.modelDisplayName || conn.modelKey || 'qwen2.5-coder:1.5b'],
                    latencyMs: 6,
                    bandwidthMbps: 2500,
                })
            }
        })
        return [...geoNodes, ...ownerNodes]
    }, [geoNodes, activeConnections, connectionFilter])

    // Chuyển đổi sang định dạng Node 3D cho Đồ thị Topo 3D (lấy thông số tài nguyên cấp phát của Seller)
    const cluster3DNodes: ClusterNode3D[] = useMemo(() => {
        const nodes: ClusterNode3D[] = geoNodes.map((n) => {
            const matched = filteredOnlineNodes.find((f) => f.id === n.id)
            const sharedCores =
                Number(matched?.rentConfig?.allocatedCores) ||
                
                Number(matched?.hardware?.cpuCores) ||
                4
            const sharedRAM =
                Number(matched?.rentConfig?.allocatedRAMGB) ||
                
                Number(matched?.hardware?.deviceMemoryGB) ||
                16

            return {
                id: n.id,
                name: n.name,
                model: n.models?.[0] || 'qwen2.5-coder:1.5b',
                status: n.status,
                gpuName: matched?.rentConfig?.enableGPU !== false ? (n.gpuName || 'CPU Mode') : 'CPU Only',
                cpuCores: sharedCores,
                ramGB: sharedRAM,
                latencyMs: n.latencyMs,
                bandwidthMbps: n.bandwidthMbps,
                city: n.city,
            }
        })

        if (connectionFilter === 'all' || connectionFilter === 'seller-owner') {
            activeConnections.forEach((conn: any, idx: number) => {
                const ownerId = `owner_${conn.renterId || idx}`
                if (!nodes.find((o) => o.id === ownerId)) {
                    nodes.push({
                        id: ownerId,
                        name: `${conn.renterName || 'Agent Owner'} (${conn.assignedAgentId || 'Agent'})`,
                        model: conn.modelDisplayName || conn.modelKey || 'Inference Client',
                        status: 'BUSY',
                        gpuName: 'Agent Gateway',
                        cpuCores: 8,
                        ramGB: 16,
                        latencyMs: 6,
                        bandwidthMbps: 2500,
                        city: 'Owner Client',
                        isHub: true,
                    })
                }
            })
        }

        return nodes
    }, [geoNodes, filteredOnlineNodes, connectionFilter, activeConnections])

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
                        <IconGlobe className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                        <h1 className="text-base font-bold text-foreground">
                            Mạng Lưới Đối Tác Mô Hình & Cụm Tính Toán 3D
                        </h1>
                        <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                wsConnected
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                    : 'bg-secondary text-muted-foreground border-border'
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

            {/* 2. CHỈ SỐ TỔNG QUAN HỆ THỐNG */}
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
                        <span className="text-xs text-zinc-500">Gbps Cluster</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">Mesh phân tán ngang hàng</span>
                </div>

                <div className="p-4 rounded-2xl bg-card/60 backdrop-blur-md border border-border space-y-1">
                    <span className="text-[11px] text-zinc-400">Độ Trễ Trung Bình</span>
                    <div className="flex items-baseline gap-1">
                        <strong className="text-2xl font-black text-purple-400 font-mono">
                            {avgLatency}
                        </strong>
                        <span className="text-xs text-zinc-500">ms P2P</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">Đo trực tiếp từ Node Telemetry</span>
                </div>
            </div>

            {/* 3. KHÔNG GIAN BẢN ĐỒ, TOPO 3D & BỘ LỌC KẾT NỐI */}
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

                    {/* Bộ Lọc Hiển Thị Không Gian & Loại Kết Nối */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* 1. Bộ Lọc Không Gian: Topo 3D, Địa Cầu 3D, Bản Đồ 2D */}
                        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-border shrink-0">
                            <button
                                onClick={() => setViewMode('topology')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                    viewMode === 'topology'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                                }`}
                                title="Đồ thị cụm tính toán 3D chiều sâu"
                            >
                                <IconWorkflow className="w-3.5 h-3.5" />
                                <span>Topo 3D</span>
                            </button>

                            <button
                                onClick={() => setViewMode('globe')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                    viewMode === 'globe'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                                }`}
                                title="Mô hình quả địa cầu 3D với các đường liên kết vòng cung"
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
                                title="Bản đồ phẳng địa lý 2D"
                            >
                                <IconMap className="w-3.5 h-3.5" />
                                <span>Bản Đồ 2D</span>
                            </button>
                        </div>

                        {/* 2. Bộ Lọc Loại Kết Nối: Tất cả, Seller - Seller, Seller - Owner */}
                        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-border shrink-0">
                            <span className="text-[10px] text-zinc-500 font-mono px-2 hidden lg:inline">Kết nối:</span>
                            <button
                                onClick={() => setConnectionFilter('all')}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                                    connectionFilter === 'all'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                                }`}
                                title="Hiển thị tất cả luồng kết nối P2P và Streaming"
                            >
                                <span>Tất Cả ({sellerSellerLinks.length + activeConnections.length})</span>
                            </button>

                            <button
                                onClick={() => setConnectionFilter('seller-seller')}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                                    connectionFilter === 'seller-seller'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                                }`}
                                title="Chỉ hiển thị liên kết P2P Mesh giữa các máy Seller chia sẻ tài nguyên"
                            >
                                <span>Seller - Seller ({sellerSellerLinks.length})</span>
                            </button>

                            <button
                                onClick={() => setConnectionFilter('seller-owner')}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                                    connectionFilter === 'seller-owner'
                                        ? 'bg-cyan-600 text-white shadow-sm'
                                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                                }`}
                                title="Chỉ hiển thị luồng truyền tải inference giữa Seller và Owner đang thuê"
                            >
                                <span>Seller - Owner ({activeConnections.length})</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* KHUNG HIỂN THỊ CHÍNH (TOPO 3D / ĐỊA CẦU 3D / BẢN ĐỒ 2D) */}
                <div className="w-full min-h-[520px] rounded-xl overflow-hidden bg-card border border-border relative">
                    {/* CHẾ ĐỘ 1: TOPO 3D CHIỀU SÂU */}
                    {viewMode === 'topology' && (
                        <div className="w-full h-[520px]">
                            <ClusterTopology3DView
                                nodes={cluster3DNodes}
                                activeModelFilter={selectedModelFilter}
                                selectedNodeId={selectedNodeId}
                                onSelectNode={setSelectedNodeId}
                                connectionFilter={connectionFilter}
                            />
                        </div>
                    )}

                    {/* CHẾ ĐỘ 2: ĐỊA CẦU 3D */}
                    {viewMode === 'globe' && (
                        <div className="w-full h-[520px]">
                            <Globe3DView
                                nodes={displayGeoNodes}
                                links={effectiveGeoLinks}
                                selectedNodeId={selectedNodeId}
                                onSelectNode={setSelectedNodeId}
                            />
                        </div>
                    )}

                    {/* CHẾ ĐỘ 3: BẢN ĐỒ 2D */}
                    {viewMode === 'map2d' && (
                        <div className="w-full h-[520px]">
                            <WorldMap2DView
                                nodes={displayGeoNodes}
                                links={effectiveGeoLinks}
                                selectedNodeId={selectedNodeId}
                                onSelectNode={setSelectedNodeId}
                            />
                        </div>
                    )}
                </div>

                {/* 4. THANH TRẠNG THÁI LIÊN KẾT ĐANG KẾT NỐI */}
                <div className="p-3.5 rounded-xl bg-card/80 border border-border text-xs space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 font-semibold border-b border-border/80 pb-1.5">
                        <span className="flex items-center gap-1.5 text-cyan-400">
                            <IconLink className="w-3.5 h-3.5" />
                            <span>
                                {connectionFilter === 'all'
                                    ? `Toàn Bộ Luồng Kết Nối (${effectiveGeoLinks.length} Luồng: ${sellerSellerLinks.length} P2P Mesh + ${activeConnections.length} Streaming)`
                                    : connectionFilter === 'seller-seller'
                                    ? `Liên Kết P2P Mesh Giữa Các Seller (${sellerSellerLinks.length} Luồng)`
                                    : `Kênh Truyền Tải LLM Seller ⇄ Owner (${activeConnections.length} Luồng)`}
                            </span>
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

                    <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                        {effectiveGeoLinks.length === 0 ? (
                            <div className="text-zinc-500 text-[11px] py-2 text-center">
                                {connectionFilter === 'seller-owner'
                                    ? 'Chưa có phiên kết nối Seller ⇄ Owner nào đang truyền tải. Hãy vào trang "Thuê AI Cho Agent" (/owner) để khởi tạo phiên.'
                                    : onlineNodes.length === 1
                                    ? 'Đang có 1 máy Seller trực tuyến. Khi có từ 2 máy chạy Worker trở lên, đường nối cụm P2P Seller ⇄ Seller sẽ tự động hình thành.'
                                    : 'Chưa có liên kết cụm nào trong bộ lọc hiện tại.'}
                            </div>
                        ) : (
                            effectiveGeoLinks.slice(0, 8).map((link, idx) => {
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
                                            <span
                                                className={`w-1.5 h-1.5 rounded-full ${
                                                    link.type === 'seller-owner'
                                                        ? 'bg-cyan-400 animate-ping'
                                                        : 'bg-emerald-400 animate-pulse'
                                                }`}
                                            />
                                            <span className="font-semibold text-white">
                                                {link.from.city} ({link.from.name})
                                            </span>
                                            <span className="text-zinc-500">
                                                {link.type === 'seller-owner' ? '══[Stream]══>' : '⇄'}
                                            </span>
                                            <span className="font-semibold text-white">
                                                {link.to.city} ({link.to.name})
                                            </span>
                                            <span
                                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                                    link.type === 'seller-owner'
                                                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                                        : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                                                }`}
                                            >
                                                {link.type === 'seller-owner' ? 'SELLER ⇄ OWNER' : 'P2P MESH'}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 text-[10px] font-mono border border-blue-500/20">
                                                {link.model}
                                            </span>
                                            <span className="text-zinc-500 text-[10px]">
                                                {link.latency}ms
                                            </span>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* 5. CHI TIẾT CÁC PHIÊN THUÊ STREAMING SELLER ⇄ OWNER (KHI CÓ KẾT NỐI VÀ LỌC ALL HOẶC SELLER-OWNER) */}
                {activeConnections.length > 0 && (connectionFilter === 'all' || connectionFilter === 'seller-owner') && (
                    <div className="p-4 rounded-xl bg-zinc-950/90 border border-cyan-500/30 space-y-3">
                        <div className="flex items-center justify-between border-b border-border/80 pb-2">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                                    Chi Tiết Kênh Truyền Tải Seller ⇄ Owner Đang Thuê ({activeConnections.length} Phiên Hoạt Động)
                                </h3>
                            </div>
                            <Link
                                href="/owner"
                                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                            >
                                <span>Quản lý phiên tại /owner</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {activeConnections.map((conn: any, idx: number) => {
                                const sId = conn.sessionId || conn.id || conn._id || `sess_${idx}`
                                const displayId = String(sId).length > 8 ? String(sId).slice(-8) : String(sId)

                                return (
                                    <div
                                        key={sId}
                                        className="bg-zinc-900/70 border border-border hover:border-cyan-500/40 rounded-xl p-3 space-y-2 text-xs"
                                    >
                                        <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                                            <span>Mã phiên: <strong className="text-white">{displayId}</strong></span>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                                STREAMING
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="text-[10px] text-zinc-500 block">Host Máy Seller:</span>
                                                <strong className="text-zinc-200">{conn.nodeName || 'Worker Node'}</strong>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] text-zinc-500 block">Agent Thuê:</span>
                                                <span className="text-blue-400 font-semibold">{conn.assignedAgentId || 'Agent Manager'}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-border/60">
                                            <span className="text-cyan-300 font-mono">{conn.modelDisplayName || conn.modelKey}</span>
                                            <span className="text-amber-400 font-mono font-bold">{conn.coinsPerHour || 35} Coins/h</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* 6. DANH SÁCH MÁY SELLER TRỰC TUYẾN - HIỂN THỊ ĐÚNG CẤU HÌNH CẤP PHÁT (rentConfig) */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-white">
                            Danh Sách Máy Trạm Seller Đang Trực Tuyến ({filteredOnlineNodes.length})
                        </h3>
                        <p className="text-xs text-zinc-400">
                            Cấu hình CPU, RAM và GPU hiển thị theo đúng số lượng Seller thiết lập cấp phát trên trang Kiểm tra Node AI.
                        </p>
                    </div>

                    <span className="text-xs text-emerald-400 font-mono font-bold">
                        {onlineNodes.length} Worker Sẵn Sàng
                    </span>
                </div>

                {filteredOnlineNodes.length === 0 ? (
                    <div className="p-12 text-center bg-card/40 border border-border rounded-2xl space-y-4">
                        <IconServer className="w-12 h-12 text-zinc-600 mx-auto" />
                        <div className="space-y-1">
                            <h4 className="text-sm font-bold text-zinc-300">
                                Chưa có máy Seller nào đang chạy Worker
                            </h4>
                            <p className="text-xs text-zinc-500 max-w-md mx-auto">
                                Sau khi đăng ký đối tác, bạn hãy mở ứng dụng <strong>Go-Python Worker (.exe)</strong> trên máy tính. Ứng dụng sẽ kết nối qua WebSocket và truyền thông số tài nguyên thực tế lên cụm mạng lưới.
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-3">
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

                            const sharedCores =
                                Number(node.rentConfig?.allocatedCores) ||
                                
                                Number(node.hardware?.cpuCores) ||
                                4
                            const sharedRAM =
                                Number(node.rentConfig?.allocatedRAMGB) ||
                                
                                Number(node.hardware?.deviceMemoryGB) ||
                                16
                            const sharedPrice =
                                Number(node.rentConfig?.minPricePerHourCoin) ||
                                
                                35
                            const hasGPU =
                                node.rentConfig?.enableGPU !== undefined
                                    ? Boolean(node.rentConfig.enableGPU)
                                    : Boolean(node.hardware?.hasWebGPU)

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

                                        {/* Cấu hình phần cứng cấp phát theo cấu hình Seller + Telemetry thực tế từ Worker */}
                                        <div className="grid grid-cols-2 gap-2 bg-zinc-950/60 p-2.5 rounded-xl text-[11px]">
                                            <div>
                                                <span className="text-zinc-500 text-[10px] block">CPU Cấp phát:</span>
                                                <span className="font-semibold text-blue-400 font-mono">
                                                    {sharedCores} Cores Chia sẻ
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-zinc-500 text-[10px] block">RAM Chia sẻ:</span>
                                                <span className="font-semibold text-indigo-400 font-mono">
                                                    {sharedRAM} GB RAM
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-zinc-500 text-[10px] block">Đồ họa GPU:</span>
                                                <span className="text-zinc-300 font-mono truncate block">
                                                    {hasGPU ? (node.hardware?.gpuName || 'GPU Active') : 'CPU Only'}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-zinc-500 text-[10px] block">Giá cho thuê:</span>
                                                <span className="font-semibold text-amber-400 font-mono">
                                                    {sharedPrice} Coins/h
                                                </span>
                                            </div>
                                            <div className="col-span-2 pt-1 border-t border-border/60 flex items-center justify-between text-[10px]">
                                                <span className="text-zinc-400 font-mono">
                                                    Tải Worker: CPU {cpuPercent.toFixed(0)}% · RAM {ramPercent.toFixed(0)}%
                                                </span>
                                                <span className="text-emerald-400 font-mono">
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
