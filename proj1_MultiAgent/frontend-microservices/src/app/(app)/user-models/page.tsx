'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { request } from '@/lib/client'
import Globe3DView, { GeoNode, GeoLink } from '@/components/network/Globe3DView'
import WorldMap2DView from '@/components/network/WorldMap2DView'
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

// Danh sách các trung tâm tính toán AI phân tán mẫu trên thế giới
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
    const [nodes, setNodes] = useState<UserNode[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedModelFilter, setSelectedModelFilter] = useState<string | null>(null)
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

    // View mode: 'globe' (3D Earth) | 'map2d' (2D Geospatial) | 'topology' (Cluster Graph)
    const [viewMode, setViewMode] = useState<'globe' | 'map2d' | 'topology'>('globe')

    useEffect(() => {
        async function fetchUserNodes() {
            setLoading(true)
            try {
                const res = await request<any>('/users/hardware-nodes')
                const list: UserNode[] = Array.isArray(res) ? res : res?.data || res?.nodes || []
                
                // Nếu chưa có nodes nào trong DB, tạo danh sách mẫu phong phú để trực quan hóa
                if (!list || list.length === 0) {
                    const fallbackNodes: UserNode[] = [
                        {
                            _id: 'node-hanoi-1',
                            username: 'Hanoi_DeepSeek_Cluster',
                            email: 'hanoi.cluster@ai.vn',
                            status: 'online',
                            location: GEO_HUBS[0],
                            hardwareNode: {
                                cpuCores: 32,
                                deviceMemoryGB: 64,
                                hasWebGPU: true,
                                gpuName: 'NVIDIA RTX 4090 24GB',
                                recommendedModels: ['deepseek-r1:7b', 'llama3:8b', 'qwen2.5:7b'],
                                canRunAI: true,
                                status: 'IDLE',
                                bandwidthMbps: 1200,
                                latencyMs: 12,
                            },
                        },
                        {
                            _id: 'node-hcm-2',
                            username: 'Saigon_Neural_Worker',
                            email: 'worker.sg@ai.vn',
                            status: 'busy',
                            location: GEO_HUBS[1],
                            hardwareNode: {
                                cpuCores: 16,
                                deviceMemoryGB: 32,
                                hasWebGPU: true,
                                gpuName: 'NVIDIA RTX 3080 Ti',
                                recommendedModels: ['deepseek-r1:7b', 'mistral:7b'],
                                canRunAI: true,
                                status: 'BUSY',
                                bandwidthMbps: 850,
                                latencyMs: 18,
                            },
                        },
                        {
                            _id: 'node-danang-3',
                            username: 'Danang_Edge_Gateway',
                            email: 'gateway.dn@ai.vn',
                            status: 'online',
                            location: GEO_HUBS[2],
                            hardwareNode: {
                                cpuCores: 12,
                                deviceMemoryGB: 24,
                                hasWebGPU: true,
                                gpuName: 'Apple M3 Pro GPU',
                                recommendedModels: ['phi3:mini', 'qwen2.5:7b'],
                                canRunAI: true,
                                status: 'IDLE',
                                bandwidthMbps: 600,
                                latencyMs: 15,
                            },
                        },
                        {
                            _id: 'node-singapore-4',
                            username: 'SG_Asia_Hub_Orchestrator',
                            email: 'sg.hub@cloud.io',
                            status: 'online',
                            location: GEO_HUBS[3],
                            hardwareNode: {
                                cpuCores: 64,
                                deviceMemoryGB: 128,
                                hasWebGPU: true,
                                gpuName: 'Dual NVIDIA A100 SXM4 80GB',
                                recommendedModels: ['deepseek-r1:7b', 'llama3:8b', 'mistral:7b', 'qwen2.5:7b'],
                                canRunAI: true,
                                status: 'IDLE',
                                bandwidthMbps: 2500,
                                latencyMs: 32,
                            },
                        },
                        {
                            _id: 'node-tokyo-5',
                            username: 'Tokyo_Robotics_Host',
                            email: 'tokyo.node@ai.jp',
                            status: 'online',
                            location: GEO_HUBS[4],
                            hardwareNode: {
                                cpuCores: 24,
                                deviceMemoryGB: 48,
                                hasWebGPU: true,
                                gpuName: 'NVIDIA RTX 4080 Super',
                                recommendedModels: ['deepseek-r1:7b', 'llama3:8b'],
                                canRunAI: true,
                                status: 'IDLE',
                                bandwidthMbps: 1500,
                                latencyMs: 65,
                            },
                        },
                        {
                            _id: 'node-seoul-6',
                            username: 'Seoul_Inference_Rig',
                            email: 'seoul.rig@kr.ai',
                            status: 'busy',
                            location: GEO_HUBS[5],
                            hardwareNode: {
                                cpuCores: 16,
                                deviceMemoryGB: 32,
                                hasWebGPU: true,
                                gpuName: 'NVIDIA RTX 3090 24GB',
                                recommendedModels: ['qwen2.5:7b', 'mistral:7b'],
                                canRunAI: true,
                                status: 'BUSY',
                                bandwidthMbps: 900,
                                latencyMs: 72,
                            },
                        },
                        {
                            _id: 'node-sf-7',
                            username: 'SiliconValley_Compute_Peer',
                            email: 'sv.peer@ai.us',
                            status: 'online',
                            location: GEO_HUBS[6],
                            hardwareNode: {
                                cpuCores: 32,
                                deviceMemoryGB: 64,
                                hasWebGPU: true,
                                gpuName: 'NVIDIA H100 PCIe 80GB',
                                recommendedModels: ['deepseek-r1:7b', 'llama3:8b', 'phi3:mini'],
                                canRunAI: true,
                                status: 'IDLE',
                                bandwidthMbps: 3000,
                                latencyMs: 140,
                            },
                        },
                        {
                            _id: 'node-frankfurt-8',
                            username: 'EU_Frankfurt_Node',
                            email: 'fra.node@eu.de',
                            status: 'online',
                            location: GEO_HUBS[7],
                            hardwareNode: {
                                cpuCores: 20,
                                deviceMemoryGB: 40,
                                hasWebGPU: true,
                                gpuName: 'NVIDIA RTX 4070 Ti Super',
                                recommendedModels: ['mistral:7b', 'llama3:8b'],
                                canRunAI: true,
                                status: 'IDLE',
                                bandwidthMbps: 1100,
                                latencyMs: 180,
                            },
                        },
                    ]
                    setNodes(fallbackNodes)
                } else {
                    // Gán tọa độ địa lý ngẫu nhiên nhưng ổn định cho các Node thực từ backend
                    const enriched = list.map((n, idx) => {
                        const hub = GEO_HUBS[idx % GEO_HUBS.length]
                        return {
                            ...n,
                            location: n.location || hub,
                            hardwareNode: {
                                ...n.hardwareNode,
                                bandwidthMbps: n.hardwareNode.bandwidthMbps || 800 + (idx * 150) % 1500,
                                latencyMs: n.hardwareNode.latencyMs || 15 + (idx * 25) % 180,
                            },
                        }
                    })
                    setNodes(enriched)
                }
            } catch (err) {
                console.error('Lỗi lấy danh sách User Node:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchUserNodes()
    }, [])

    // Danh sách tất cả các models đang có
    const allModels = useMemo(() => {
        const modelSet = new Set<string>()
        nodes.forEach((n) => {
            n.hardwareNode?.recommendedModels?.forEach((m) => modelSet.add(m))
        })
        return Array.from(modelSet)
    }, [nodes])

    // Lọc các Node theo Model
    const filteredNodes = useMemo(() => {
        if (!selectedModelFilter) return nodes
        return nodes.filter((n) =>
            n.hardwareNode?.recommendedModels?.includes(selectedModelFilter)
        )
    }, [nodes, selectedModelFilter])

    // Chuyển đổi định dạng sang GeoNode để hiển thị trên bản đồ 3D và 2D
    const geoNodes: GeoNode[] = useMemo(() => {
        return filteredNodes.map((n, idx) => {
            const loc = n.location || GEO_HUBS[idx % GEO_HUBS.length]
            return {
                id: n._id,
                name: n.username || `Node-${idx + 1}`,
                email: n.email || '',
                city: loc.city,
                country: loc.country,
                lat: loc.lat,
                lng: loc.lng,
                status: n.hardwareNode?.status || 'IDLE',
                gpuName: n.hardwareNode?.gpuName,
                models: n.hardwareNode?.recommendedModels || [],
                latencyMs: n.hardwareNode?.latencyMs || 25,
                bandwidthMbps: n.hardwareNode?.bandwidthMbps || 1000,
            }
        })
    }, [filteredNodes])

    // Tạo các liên kết mạng lưới (GeoLinks) giữa các Node đang chia sẻ chung Model AI
    const geoLinks: GeoLink[] = useMemo(() => {
        const links: GeoLink[] = []
        for (let i = 0; i < geoNodes.length; i++) {
            for (let j = i + 1; j < geoNodes.length; j++) {
                const nodeA = geoNodes[i]
                const nodeB = geoNodes[j]

                // Tìm các model chung
                const shared = nodeA.models.filter((m) => nodeB.models.includes(m))
                if (shared.length > 0) {
                    const activeModel = selectedModelFilter
                        ? selectedModelFilter
                        : shared[0]

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

    // Tìm node đang được chọn
    const activeSelectedNode = useMemo(() => {
        return geoNodes.find((n) => n.id === selectedNodeId) || null
    }, [geoNodes, selectedNodeId])

    if (loading) {
        return (
            <div className="flex items-center justify-center p-16 text-xs text-zinc-500">
                Đang nạp dữ liệu và đồng bộ bản đồ mạng lưới đối tác...
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* 1. HEADER TRANG & CHUYỂN GÓC NHÌN BẢN ĐỒ */}
            <div className="border-b border-zinc-800 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-base font-bold text-white flex items-center gap-2">
                        <IconGlobe className="w-5 h-5 text-blue-400" />
                        <span>Mạng Lưới Đối Tác & Bản Đồ Vị Trí Tính Toán AI (Global AI Nodes)</span>
                    </h1>
                    <p className="text-xs text-zinc-400 mt-1">
                        Theo dõi trực quan vị trí địa lý, lưu lượng truyền tải và liên kết tính toán phân tán giữa các máy trạm đối tác trên toàn cầu.
                    </p>
                </div>

                {/* Các nút chuyển đổi Chế Độ Hiển Thị Bản Đồ (3D Globe / 2D Map / Topology) */}
                <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
                    <button
                        onClick={() => setViewMode('globe')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            viewMode === 'globe'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                        }`}
                    >
                        <IconGlobe className="w-3.5 h-3.5" />
                        <span>Quả địa cầu 3D</span>
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
                        <span>Bản đồ 2D</span>
                    </button>

                    <button
                        onClick={() => setViewMode('topology')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            viewMode === 'topology'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                        }`}
                    >
                        <IconWorkflow className="w-3.5 h-3.5" />
                        <span>Đồ thị Topo Cụm</span>
                    </button>
                </div>
            </div>

            {/* 2. CHỈ SỐ NHANH TOÀN CẦU (GLOBAL TELEMETRY METRICS) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-between">
                    <div>
                        <span className="text-zinc-500 text-[11px] block">Nodes Hoạt Động</span>
                        <strong className="text-base text-white font-bold">{geoNodes.length} Máy trạm</strong>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                        <IconServer className="w-4 h-4" />
                    </div>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-between">
                    <div>
                        <span className="text-zinc-500 text-[11px] block">Đường Liên Kết Mạng</span>
                        <strong className="text-base text-cyan-400 font-bold">{geoLinks.length} Kênh truyền</strong>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                        <IconLink className="w-4 h-4" />
                    </div>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-between">
                    <div>
                        <span className="text-zinc-500 text-[11px] block">Băng Thông Toàn Cầu</span>
                        <strong className="text-base text-amber-400 font-bold">{totalBandwidthGbps} Gbps</strong>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                        <IconZap className="w-4 h-4" />
                    </div>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-between">
                    <div>
                        <span className="text-zinc-500 text-[11px] block">Độ Trễ Trung Bình</span>
                        <strong className="text-base text-blue-400 font-bold font-mono">{avgLatency} ms</strong>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                        <IconActivity className="w-4 h-4" />
                    </div>
                </div>
            </div>

            {/* 3. KHU VỰC BẢN ĐỒ KHÔNG GIAN (SPATIAL & TOPOLOGY VISUALIZER) */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 space-y-4">
                {/* Header thanh lọc Model và thông báo liên kết */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            <span>
                                {viewMode === 'globe'
                                    ? 'Quả Địa Cầu Không Gian 3D (Interactive Earth Mesh)'
                                    : viewMode === 'map2d'
                                    ? 'Bản Đồ Phẳng Tọa Độ Địa Lý 2D'
                                    : 'Sơ Đồ Đồ Thị Cụm Phân Tán (Cluster Graph)'}
                            </span>
                        </h2>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                            Các đường cong ánh sáng biểu thị luồng dữ liệu suy luận và đồng bộ hóa trọng số giữa các node.
                        </p>
                    </div>

                    {/* Bộ lọc theo Model */}
                    <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
                        <button
                            onClick={() => setSelectedModelFilter(null)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition whitespace-nowrap ${
                                selectedModelFilter === null
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                        >
                            Tất cả Models ({allModels.length})
                        </button>
                        {allModels.map((m) => (
                            <button
                                key={m}
                                onClick={() => setSelectedModelFilter(m)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition whitespace-nowrap ${
                                    selectedModelFilter === m
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                                }`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Khung Render Bản Đồ Chi Tiết */}
                <div className="relative w-full h-[460px] bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
                    {viewMode === 'globe' && (
                        <Globe3DView
                            nodes={geoNodes}
                            links={geoLinks}
                            selectedNodeId={selectedNodeId}
                            onSelectNode={setSelectedNodeId}
                        />
                    )}

                    {viewMode === 'map2d' && (
                        <WorldMap2DView
                            nodes={geoNodes}
                            links={geoLinks}
                            selectedNodeId={selectedNodeId}
                            onSelectNode={setSelectedNodeId}
                        />
                    )}

                    {viewMode === 'topology' && (
                        <div className="w-full h-full flex items-center justify-center p-4">
                            <NetworkTopologyGraph
                                nodes={nodes}
                                activeModelFilter={selectedModelFilter}
                                selectedNodeId={selectedNodeId}
                                onSelectNode={setSelectedNodeId}
                            />
                        </div>
                    )}
                </div>

                {/* 4. THANH TRẠNG THÁI LIÊN KẾT ĐANG KẾT NỐI (ACTIVE LINK INSPECTOR) */}
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
                                Không có kênh liên kết nào thỏa mãn bộ lọc hiện tại.
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
                        Danh Sách Máy Trạm Đối Tác ({filteredNodes.length})
                    </h3>
                </div>

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
                                                    <span>{loc.city}, {loc.country}</span>
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
            </div>
        </div>
    )
}

// ─── COMPONENT VẼ ĐỒ THỊ MẠNG LƯỚI TOPO VÒNG TRÒN ────────────────────────────
function NetworkTopologyGraph({
    nodes,
    activeModelFilter,
    selectedNodeId,
    onSelectNode,
}: {
    nodes: UserNode[]
    activeModelFilter: string | null
    selectedNodeId: string | null
    onSelectNode: (id: string | null) => void
}) {
    const width = 800
    const height = 360
    const centerX = width / 2
    const centerY = height / 2

    const nodeCoords = useMemo(() => {
        const total = nodes.length
        if (total === 0) return []

        const radius = Math.min(width, height) / 2.7
        return nodes.map((n, i) => {
            const angle = (i / total) * 2 * Math.PI - Math.PI / 2
            return {
                ...n,
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle),
            }
        })
    }, [nodes, width, height, centerX, centerY])

    const links = useMemo(() => {
        const result: { x1: number; y1: number; x2: number; y2: number; fromId: string; toId: string; model: string }[] = []

        for (let i = 0; i < nodeCoords.length; i++) {
            for (let j = i + 1; j < nodeCoords.length; j++) {
                const nodeA = nodeCoords[i]
                const nodeB = nodeCoords[j]

                const sharedModels = nodeA.hardwareNode?.recommendedModels?.filter((m) =>
                    nodeB.hardwareNode?.recommendedModels?.includes(m)
                )

                if (sharedModels && sharedModels.length > 0) {
                    sharedModels.forEach((m) => {
                        if (!activeModelFilter || activeModelFilter === m) {
                            result.push({
                                x1: nodeA.x,
                                y1: nodeA.y,
                                x2: nodeB.x,
                                y2: nodeB.y,
                                fromId: nodeA._id,
                                toId: nodeB._id,
                                model: m,
                            })
                        }
                    })
                }
            }
        }
        return result
    }, [nodeCoords, activeModelFilter])

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full select-none">
            <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Các đường liên kết */}
            {links.map((link, idx) => {
                const isSelected = selectedNodeId === link.fromId || selectedNodeId === link.toId
                return (
                    <line
                        key={idx}
                        x1={link.x1}
                        y1={link.y1}
                        x2={link.x2}
                        y2={link.y2}
                        stroke={isSelected ? '#38bdf8' : '#3b82f6'}
                        strokeWidth={isSelected ? '2' : '0.9'}
                        strokeOpacity={isSelected ? '0.9' : '0.25'}
                        strokeDasharray={isSelected ? '6 3' : undefined}
                    />
                )
            })}

            {/* Các điểm nút */}
            {nodeCoords.map((node) => {
                const isFilteredOut =
                    activeModelFilter &&
                    !node.hardwareNode?.recommendedModels?.includes(activeModelFilter)
                const isSelected = selectedNodeId === node._id

                return (
                    <g
                        key={node._id}
                        transform={`translate(${node.x}, ${node.y})`}
                        onClick={() => onSelectNode(node._id)}
                        className="transition-all duration-300 cursor-pointer"
                        style={{ opacity: isFilteredOut ? 0.2 : 1 }}
                    >
                        <circle
                            r={isSelected ? '20' : '15'}
                            fill="none"
                            stroke={node.hardwareNode?.status === 'BUSY' ? '#f59e0b' : '#3b82f6'}
                            strokeWidth="1.5"
                            strokeOpacity={isSelected ? '0.8' : '0.35'}
                            className="animate-ping"
                            style={{ animationDuration: '3s' }}
                        />

                        <circle
                            r="13"
                            fill="#18181b"
                            stroke={
                                isSelected
                                    ? '#38bdf8'
                                    : node.hardwareNode?.status === 'BUSY'
                                    ? '#f59e0b'
                                    : '#10b981'
                            }
                            strokeWidth={isSelected ? '2.5' : '1.5'}
                        />

                        <text textAnchor="middle" dy="4" fontSize="10" fontWeight="bold" fill="#ffffff">
                            {(node.username || 'U').charAt(0).toUpperCase()}
                        </text>

                        <text textAnchor="middle" y="26" fontSize="9" fill={isSelected ? '#38bdf8' : '#a1a1aa'} className="font-mono">
                            {node.username || 'Node'}
                        </text>
                    </g>
                )
            })}
        </svg>
    )
}