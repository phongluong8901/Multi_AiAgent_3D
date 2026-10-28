'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { request } from '@/lib/client'
import Globe3DView, { GeoNode, GeoLink } from '@/components/network/Globe3DView'
import WorldMap2DView from '@/components/network/WorldMap2DView'
import ClusterTopology3DView, { ClusterNode3D } from '@/components/network/ClusterTopology3DView'
import {
    IconGlobe,
    IconMap,
    IconWorkflow,
    IconCpu,
    IconActivity,
    IconZap,
    IconCheck,
    IconServer,
    IconShield,
    IconLink,
    IconMapPin,
} from '@/components/ui/icons'
import PartnerOnboardingModal from '@/components/distributed/PartnerOnboardingModal'
import { useUser } from '@/hooks/useUser'
import { distributedApi, PartnerNodeData } from '@/lib/api/distributed'
import { ownerApi, RentalSessionData } from '@/lib/api/owner'
import {
    Server,
    Bot,
    Cpu,
    Zap,
    Activity,
    Radio,
    ArrowRight,
    ShieldCheck,
    CheckCircle2,
    Clock,
    Coins,
} from 'lucide-react'

type UserNode = {
    _id: string
    username: string
    email: string
    avatarUrl?: string
    status: 'online' | 'offline' | 'busy'
    location?: {
        city: string
        country: string
        lat: number
        lng: number
    }
    hardwareNode: {
        cpuCores: number
        deviceMemoryGB: number
        hasWebGPU: boolean
        gpuName?: string
        recommendedModels: string[]
        canRunAI: boolean
        status?: 'IDLE' | 'BUSY' | 'OFFLINE'
        lastSeen?: string
        bandwidthMbps?: number
        latencyMs?: number
    }
}

// Danh sách các trung tâm tính toán AI phân tán mẫu trên thế giới để phân bổ không gian
const GEO_HUBS = [
    { city: 'Hà Nội', country: 'Việt Nam', lat: 21.0285, lng: 105.8542 },
    { city: 'TP. Hồ Chí Minh', country: 'Việt Nam', lat: 10.8231, lng: 106.6297 },
    { city: 'Đà Nẵng', country: 'Việt Nam', lat: 16.0544, lng: 108.2022 },
    { city: 'Singapore', country: 'Singapore', lat: 1.3521, lng: 103.8198 },
    { city: 'Tokyo', country: 'Nhật Bản', lat: 35.6762, lng: 139.6503 },
    { city: 'Seoul', country: 'Hàn Quốc', lat: 37.5665, lng: 126.978 },
    { city: 'San Francisco', country: 'Mỹ', lat: 37.7749, lng: -122.4194 },
    { city: 'Frankfurt', country: 'Đức', lat: 50.1109, lng: 8.6821 },
    { city: 'London', country: 'Anh', lat: 51.5074, lng: -0.1278 },
    { city: 'Sydney', country: 'Úc', lat: -33.8688, lng: 151.2093 },
]

export default function UserModelsPage() {
    const { profile } = useUser()
    const [nodes, setNodes] = useState<UserNode[]>([])
    const [activeConnections, setActiveConnections] = useState<RentalSessionData[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedModelFilter, setSelectedModelFilter] = useState<string | null>(null)
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
    const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false)

    // View mode: 'topology' (3D Cluster Graph) | 'connections' (Seller ⇄ Owner P2P Streams) | 'globe' (3D Earth) | 'map2d' (2D Geospatial)
    const [viewMode, setViewMode] = useState<'topology' | 'connections' | 'globe' | 'map2d'>('topology')

    const handlePartnerRegistered = (newNode: PartnerNodeData) => {
        // Bổ sung node vừa đăng ký vào danh sách hiển thị
        const enriched: UserNode = {
            _id: newNode.id,
            username: newNode.username || profile?.name || 'My_Partner_Node',
            email: newNode.email || profile?.email || '',
            status: 'online',
            location: GEO_HUBS[0],
            hardwareNode: {
                cpuCores: newNode.hardware.cpuCores,
                deviceMemoryGB: newNode.hardware.deviceMemoryGB,
                hasWebGPU: newNode.hardware.hasWebGPU,
                gpuName: newNode.hardware.gpuName,
                recommendedModels: newNode.compatibleModels || ['qwen2.5-coder:1.5b'],
                canRunAI: true,
                status: 'IDLE',
                bandwidthMbps: 1200,
                latencyMs: 15,
            },
        }
        setNodes((prev) => [enriched, ...prev])
        setSelectedNodeId(newNode.id)
    }

    const fetchUserNodes = async () => {
        setLoading(true)
        try {
            // Lấy danh sách Partner Nodes từ Distributed Service, User Service và các phiên kết nối Seller ⇄ Owner
            const [distRes, usersRes, connRes] = await Promise.all([
                distributedApi.listNodes().catch(() => null),
                request<any>('/users/hardware-nodes').catch(() => null),
                ownerApi.getActiveConnections().catch(() => null),
            ])

            if (connRes?.sessions) {
                setActiveConnections(connRes.sessions)
            } else if ((connRes as any)?.data?.activeRentals) {
                setActiveConnections((connRes as any).data.activeRentals)
            }

            const partnerList: PartnerNodeData[] = distRes?.nodes || []
            const userList: UserNode[] = Array.isArray(usersRes) ? usersRes : usersRes?.data || usersRes?.nodes || []

            const combined: UserNode[] = []

            // Thêm các Partner Nodes từ Distributed Service (kết nối qua Electron Worker)
            partnerList.forEach((pn, idx) => {
                const hub = GEO_HUBS[idx % GEO_HUBS.length]
                combined.push({
                    _id: pn.id,
                    username: pn.username || `Partner_${pn.id.slice(-6)}`,
                    email: pn.email || '',
                    status: pn.status === 'IDLE' ? 'online' : pn.status === 'BUSY' ? 'busy' : 'offline',
                    location: hub,
                    hardwareNode: {
                        cpuCores: pn.hardware.cpuCores,
                        deviceMemoryGB: pn.hardware.deviceMemoryGB,
                        hasWebGPU: pn.hardware.hasWebGPU,
                        gpuName: pn.hardware.gpuName,
                        recommendedModels: pn.compatibleModels || ['qwen2.5-coder:1.5b'],
                        canRunAI: true,
                        status: pn.status === 'IDLE' ? 'IDLE' : pn.status === 'BUSY' ? 'BUSY' : 'OFFLINE',
                        bandwidthMbps: 800 + ((idx * 150) % 1500),
                        latencyMs: 12 + ((idx * 18) % 120),
                        lastSeen: pn.updatedAt,
                    },
                })
            })

            // Thêm các Node trình duyệt nếu có
            userList.forEach((un, idx) => {
                if (!combined.some((c) => c._id === un._id)) {
                    const hub = GEO_HUBS[(partnerList.length + idx) % GEO_HUBS.length]
                    combined.push({
                        ...un,
                        location: un.location || hub,
                        hardwareNode: {
                            ...un.hardwareNode,
                            bandwidthMbps: un.hardwareNode.bandwidthMbps || 600,
                            latencyMs: un.hardwareNode.latencyMs || 25,
                        },
                    })
                }
            })

            // Dữ liệu thực tế: Không dùng mock fallback nodes
            setNodes(combined)
        } catch (err) {
            console.error('Lỗi lấy danh sách User Node:', err)
            setNodes([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchUserNodes()
        const interval = setInterval(fetchUserNodes, 8000)
        return () => clearInterval(interval)
    }, [])

    // Lọc theo Model
    const filteredNodes = useMemo(() => {
        if (!selectedModelFilter) return nodes
        return nodes.filter((n) =>
            n.hardwareNode?.recommendedModels?.includes(selectedModelFilter)
        )
    }, [nodes, selectedModelFilter])

    // Danh sách toàn bộ model độc nhất
    const allModels = useMemo(() => {
        const set = new Set<string>()
        nodes.forEach((n) => {
            n.hardwareNode?.recommendedModels?.forEach((m) => set.add(m))
        })
        return Array.from(set)
    }, [nodes])

    // Chuyển đổi UserNode sang GeoNode
    const geoNodes: GeoNode[] = useMemo(() => {
        return filteredNodes.map((n, idx) => {
            const loc = n.location || GEO_HUBS[idx % GEO_HUBS.length]
            return {
                id: n._id,
                name: n.username,
                email: n.email,
                city: loc.city,
                country: loc.country,
                lat: loc.lat,
                lng: loc.lng,
                status: n.hardwareNode?.status || 'IDLE',
                gpuName: n.hardwareNode?.gpuName,
                models: n.hardwareNode?.recommendedModels || [],
                latencyMs: n.hardwareNode?.latencyMs || 15,
                bandwidthMbps: n.hardwareNode?.bandwidthMbps || 800,
            }
        })
    }, [filteredNodes])

    // Tạo các đường liên kết (Links) giữa các Node cùng Model
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
        return geoNodes.map((n) => ({
            id: n.id,
            name: n.name,
            model: n.models?.[0] || 'Qwen 2.5 Coder',
            status: n.status,
            gpuName: n.gpuName,
            cpuCores: filteredNodes.find((f) => f._id === n.id)?.hardwareNode?.cpuCores,
            ramGB: filteredNodes.find((f) => f._id === n.id)?.hardwareNode?.deviceMemoryGB,
            latencyMs: n.latencyMs,
            bandwidthMbps: n.bandwidthMbps,
            city: n.city,
        }))
    }, [geoNodes, filteredNodes])

    // Thống kê tổng quan
    const totalBandwidthGbps = useMemo(() => {
        const mbps = geoNodes.reduce((sum, n) => sum + (n.bandwidthMbps || 0), 0)
        return (mbps / 1000).toFixed(1)
    }, [geoNodes])

    const avgLatency = useMemo(() => {
        if (geoNodes.length === 0) return 0
        const total = geoNodes.reduce((sum, n) => sum + n.latencyMs, 0)
        return Math.round(total / geoNodes.length)
    }, [geoNodes])

    if (loading) {
        return (
            <div className="flex items-center justify-center p-16 text-xs text-zinc-500">
                Đang nạp dữ liệu và đồng bộ mạng lưới đối tác thời gian thực...
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* 1. HEADER TRANG & NÚT GIA NHẬP ĐỐI TÁC */}
            <div className="border-b border-zinc-800 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-base font-bold text-white flex items-center gap-2">
                        <IconGlobe className="w-5 h-5 text-blue-400" />
                        <span>Mạng Lưới Đối Tác & Bản Đồ Vị Trí Tính Toán AI (Global AI Nodes)</span>
                    </h1>
                    <p className="text-xs text-zinc-400 mt-0.5">
                        Theo dõi các máy trạm AI đang kết nối qua Electron Worker và các phiên kết nối Seller ⇄ Owner truyền tải LLM.
                    </p>
                </div>

                {/* Nút Đăng ký làm đối tác & Tải App */}
                <button
                    onClick={() => setIsPartnerModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition flex items-center gap-2 shrink-0 self-start md:self-auto"
                >
                    <IconZap className="w-4 h-4 fill-current" />
                    <span>Đăng Ký Đối Tác & Tải Client App (.exe)</span>
                </button>
            </div>

            {/* 2. CHỈ SỐ TỔNG QUAN HỆ THỐNG */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-1">
                    <span className="text-[11px] text-zinc-400">Node Đang Trực Tuyến</span>
                    <div className="flex items-baseline gap-1">
                        <strong className="text-2xl font-black text-emerald-400 font-mono">
                            {geoNodes.filter((n) => n.status === 'IDLE' || n.status === 'BUSY').length}
                        </strong>
                        <span className="text-xs text-zinc-500">/ {nodes.length} máy</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">Đã kết nối qua Electron Worker</span>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-1">
                    <span className="text-[11px] text-zinc-400">Luồng Streaming LLM Local</span>
                    <div className="flex items-baseline gap-1">
                        <strong className="text-2xl font-black text-cyan-400 font-mono">
                            {activeConnections.length}
                        </strong>
                        <span className="text-xs text-cyan-400/80 font-mono">kênh P2P</span>
                    </div>
                    <span className="text-[10px] text-emerald-400">Seller ⇄ Owner đang kết nối</span>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-1">
                    <span className="text-[11px] text-zinc-400">Tổng Băng Thông Mạng</span>
                    <div className="flex items-baseline gap-1">
                        <strong className="text-2xl font-black text-blue-400 font-mono">
                            {totalBandwidthGbps}
                        </strong>
                        <span className="text-xs text-blue-400/80 font-mono">Gbps</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">Kênh truyền tải P2P</span>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-1">
                    <span className="text-[11px] text-zinc-400">Độ Trễ Trung Bình (Ping)</span>
                    <div className="flex items-baseline gap-1">
                        <strong className="text-2xl font-black text-amber-400 font-mono">
                            {avgLatency}
                        </strong>
                        <span className="text-xs text-amber-400/80 font-mono">ms</span>
                    </div>
                    <span className="text-[10px] text-emerald-400">Cực thấp trong cụm nội vùng</span>
                </div>
            </div>

            {/* 3. KHÔNG GIAN BẢN ĐỒ, TOPO 3D & TAB KẾT NỐI SELLER ⇄ OWNER */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
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
                            Tất cả ({nodes.length})
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
                    <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 flex-wrap shrink-0">
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
                <div className="w-full min-h-[480px] rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 relative">
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
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
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
                                            Khi một Owner vào trang <strong>Thuê AI Cho Agent</strong> và chọn thuê một máy trạm của Seller, kênh truyền tải dữ liệu P2P sẽ được thiết lập và hiển thị trực quan tại đây.
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
                                                className="bg-zinc-900/60 border border-zinc-800 hover:border-cyan-500/40 rounded-2xl p-4 transition shadow-lg space-y-3"
                                            >
                                                {/* Header phiên */}
                                                <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2.5">
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

                                                {/* Visual P2P Stream Bridge */}
                                                <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-center">
                                                    {/* Cột 1, 2, 3: SELLER (HOST MÁY CHỦ) */}
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
                                                        <div className="text-[10px] text-zinc-400 flex items-center justify-between pt-1 border-t border-zinc-800/60 font-sans">
                                                            <span>Chủ máy: <strong className="text-zinc-200">{conn.sellerName || 'Anonymous Host'}</strong></span>
                                                            <span className="text-amber-400 font-mono font-bold">
                                                                {conn.coinsPerHour || 35} coins/h
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Cột 4: KÊNH TRUYỀN DỮ LIỆU Ở GIỮA (WEBSOCKET BRIDGE) */}
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
                                                        <span className="text-[8px] text-zinc-500 font-mono">
                                                            WS Port 5010
                                                        </span>
                                                    </div>

                                                    {/* Cột 5, 6, 7: OWNER (NGƯỜI THUÊ & NẠP AGENT) */}
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
                                                            {conn.renterName || 'Đức Huy (Project Leader)'}
                                                        </h4>
                                                        <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
                                                            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                                                            <span>Agent: {conn.boundAgentName || conn.assignedAgentId || 'Multi-Agent Project Lead'}</span>
                                                        </p>
                                                        <div className="text-[10px] text-zinc-400 flex items-center justify-between pt-1 border-t border-zinc-800/60 font-sans">
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
                <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 font-semibold border-b border-zinc-800/80 pb-1.5">
                        <span className="flex items-center gap-1.5 text-cyan-400">
                            <IconLink className="w-3.5 h-3.5" />
                            Đang Kết Nối & Đồng Bộ Trực Tiếp ({geoLinks.length} Luồng Liên Kết):
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
                                Chưa có liên kết cụm nào. Khi các máy Seller chạy Worker (.exe) cùng model, kênh P2P sẽ tự động thiết lập.
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

            {/* 5. DANH SÁCH USER NODE (CARDS) */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                        Danh Sách Máy Trạm Đối Tác Đang Kết Nối ({filteredNodes.length})
                    </h3>
                </div>

                {filteredNodes.length === 0 ? (
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center space-y-3">
                        <IconServer className="w-10 h-10 text-zinc-600 mx-auto" />
                        <h4 className="text-sm font-bold text-zinc-300">
                            Chưa có máy trạm nào kết nối qua Electron Worker
                        </h4>
                        <p className="text-xs text-zinc-500 max-w-md mx-auto">
                            Chỉ khi người dùng khởi chạy ứng dụng <strong>Go-Python Worker (.exe)</strong> trên máy tính của họ, kết nối WebSocket mới được thiết lập và hiển thị trực tiếp lên Cụm 3D.
                        </p>
                        <button
                            onClick={() => setIsPartnerModalOpen(true)}
                            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/25 transition inline-flex items-center gap-1.5"
                        >
                            <IconZap className="w-4 h-4 fill-current" />
                            <span>Tải App & Đăng Ký Đối Tác Ngay</span>
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredNodes.map((user, idx) => {
                            const node = user.hardwareNode
                            const isSelected = selectedNodeId === user._id
                            const loc = user.location || GEO_HUBS[idx % GEO_HUBS.length]

                            return (
                                <div
                                    key={user._id}
                                    onClick={() => setSelectedNodeId(user._id)}
                                    className={`p-4 rounded-2xl border transition space-y-3.5 flex flex-col justify-between cursor-pointer ${
                                        isSelected
                                            ? 'bg-blue-950/20 border-blue-500/60 shadow-lg shadow-blue-500/5'
                                            : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
                                    }`}
                                >
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-blue-400">
                                                    {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-xs text-white flex items-center gap-1.5">
                                                        <span>{user.username || 'Node'}</span>
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
                                                    node?.status === 'BUSY'
                                                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                                        : node?.status === 'IDLE'
                                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                        : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                                                }`}
                                            >
                                                ● {node?.status || 'IDLE'}
                                            </span>
                                        </div>

                                        {/* Cấu hình phần cứng */}
                                        <div className="grid grid-cols-2 gap-2 bg-zinc-950/60 p-2.5 rounded-xl text-[11px]">
                                            <div>
                                                <span className="text-zinc-500 text-[10px] block">CPU / RAM:</span>
                                                <span className="font-semibold text-zinc-200">
                                                    {node?.cpuCores || 0}C / {node?.deviceMemoryGB || 0}GB
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-zinc-500 text-[10px] block">Băng thông:</span>
                                                <span className="font-semibold text-amber-400 font-mono">
                                                    {node?.bandwidthMbps || 1000} Mbps
                                                </span>
                                            </div>
                                            <div className="col-span-2 pt-1 border-t border-zinc-800/60 flex items-center justify-between">
                                                <span className="text-zinc-400 truncate max-w-[180px]">
                                                    {node?.hasWebGPU ? node.gpuName || 'WebGPU Enabled' : 'CPU Mode'}
                                                </span>
                                                <span className="text-emerald-400 font-mono text-[10px]">
                                                    Ping: {node?.latencyMs || 20}ms
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Models hỗ trợ */}
                                    <div className="pt-2 border-t border-zinc-800/60 space-y-1">
                                        <div className="flex flex-wrap gap-1">
                                            {node?.recommendedModels?.map((m) => (
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