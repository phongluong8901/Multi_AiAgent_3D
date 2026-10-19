'use client'

import { useState, useEffect, useMemo } from 'react'
import { request } from '@/lib/api/client'

type UserNode = {
    _id: string
    username: string
    email: string
    avatarUrl?: string
    status: 'online' | 'offline' | 'busy'
    hardwareNode: {
        cpuCores: number
        deviceMemoryGB: number
        hasWebGPU: boolean
        gpuName?: string
        recommendedModels: string[]
        canRunAI: boolean
        status?: 'IDLE' | 'BUSY' | 'OFFLINE'
        lastSeen?: string
    }
}

export default function UserModelsPage() {
    const [nodes, setNodes] = useState<UserNode[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedModelFilter, setSelectedModelFilter] = useState<string | null>(null)

    useEffect(() => {
        async function fetchUserNodes() {
            setLoading(true)
            try {
                const res = await request<any>('/users/hardware-nodes')
                const list = Array.isArray(res) ? res : res.data || res.nodes || []
                setNodes(list)
            } catch (err) {
                console.error('Lỗi lấy danh sách User Node:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchUserNodes()
    }, [])

    // Lấy tập hợp tất cả các Model độc nhất mà các Node đang hỗ trợ
    const allModels = useMemo(() => {
        const modelSet = new Set<string>()
        nodes.forEach((n) => {
            n.hardwareNode?.recommendedModels?.forEach((m) => modelSet.add(m))
        })
        return Array.from(modelSet)
    }, [nodes])

    // Lọc danh sách Node nếu người dùng chọn xem theo Model cụ thể
    const filteredNodes = useMemo(() => {
        if (!selectedModelFilter) return nodes
        return nodes.filter((n) =>
            n.hardwareNode?.recommendedModels?.includes(selectedModelFilter)
        )
    }, [nodes, selectedModelFilter])

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12 text-xs text-zinc-500">
                Đang tải danh sách và sơ đồ liên kết các máy đối tác...
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* 1. HEADER TRANG */}
            <div className="border-b border-zinc-800 pb-4 flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-bold text-white flex items-center gap-2">
                        <span>🤝</span> Mạng Lưới Đối Tác Chạy Mô Hình (User Nodes)
                    </h1>
                    <p className="text-xs text-zinc-400 mt-1">
                        Sơ đồ liên kết tài nguyên và danh sách các máy trạm đóng góp tài nguyên tính toán AI phân tán.
                    </p>
                </div>
                <div className="text-right">
                    <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
                        {nodes.length} Nodes khả dụng
                    </span>
                </div>
            </div>

            {/* 2. SƠ ĐỒ KẾT NỐI MẠNG LƯỚI (NETWORK TOPOLOGY GRAPH) */}
            {nodes.length > 0 && (
                <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                Sơ Đồ Liên Kết Cluster Theo Mô Hình AI
                            </h2>
                            <p className="text-[11px] text-zinc-500 mt-0.5">
                                Các Node liên kết với nhau nếu cùng hỗ trợ tính toán chung một dòng mô hình.
                            </p>
                        </div>

                        {/* Bộ lọc theo Model */}
                        <div className="flex items-center gap-1.5 overflow-x-auto max-w-md">
                            <button
                                onClick={() => setSelectedModelFilter(null)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition whitespace-nowrap ${selectedModelFilter === null
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                                    }`}
                            >
                                Tất cả Models
                            </button>
                            {allModels.map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setSelectedModelFilter(m)}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition whitespace-nowrap ${selectedModelFilter === m
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-zinc-800 text-zinc-400 hover:text-white'
                                        }`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Vùng Vẽ Đồ Thị Visual Network */}
                    <div className="relative w-full h-80 bg-zinc-950/80 rounded-xl border border-zinc-800/80 overflow-hidden flex items-center justify-center">
                        <NetworkTopologyGraph
                            nodes={nodes}
                            activeModelFilter={selectedModelFilter}
                            allModels={allModels}
                        />
                    </div>
                </div>
            )}

            {/* 3. DANH SÁCH USER NODE (CARDS) */}
            {filteredNodes.length === 0 ? (
                <div className="p-8 text-center border border-zinc-800 rounded-2xl bg-zinc-900/40 text-xs text-zinc-500">
                    Chưa có user node nào phù hợp với bộ lọc. Bạn có thể kích hoạt tại trang{' '}
                    <span className="text-blue-400 font-medium">Kiểm tra Node AI</span>!
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredNodes.map((user) => {
                        const node = user.hardwareNode

                        return (
                            <div
                                key={user._id}
                                className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 transition space-y-4 flex flex-col justify-between"
                            >
                                {/* User Info & Node Status */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-blue-400">
                                                {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-xs text-white">{user.username || 'User'}</h3>
                                                <p className="text-[10px] text-zinc-500">{user.email}</p>
                                            </div>
                                        </div>

                                        <span
                                            className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${node?.status === 'BUSY'
                                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                                    : node?.status === 'IDLE'
                                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                        : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                                                }`}
                                        >
                                            ● {node?.status || 'IDLE'}
                                        </span>
                                    </div>

                                    {/* Hardware Specs Grid */}
                                    <div className="grid grid-cols-2 gap-2 bg-zinc-950/60 p-3 rounded-xl text-[11px]">
                                        <div>
                                            <span className="text-zinc-500 block">CPU Cores:</span>
                                            <span className="font-semibold text-zinc-200">{node?.cpuCores || 0} Cores</span>
                                        </div>
                                        <div>
                                            <span className="text-zinc-500 block">RAM:</span>
                                            <span className="font-semibold text-zinc-200">≥ {node?.deviceMemoryGB || 0} GB</span>
                                        </div>
                                        <div className="col-span-2 pt-1.5 border-t border-zinc-800/60">
                                            <span className="text-zinc-500 block">GPU / Accelerator:</span>
                                            <span className={`font-medium ${node?.hasWebGPU ? 'text-emerald-400' : 'text-zinc-400'}`}>
                                                {node?.hasWebGPU ? node.gpuName || 'WebGPU Enabled' : 'CPU Mode Only'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* AI Models User Can Run */}
                                <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                                    <span className="text-[10px] font-medium text-zinc-400 block">Mô hình nhận chạy:</span>
                                    <div className="flex flex-wrap gap-1">
                                        {node?.recommendedModels && node.recommendedModels.length > 0 ? (
                                            node.recommendedModels.map((m) => {
                                                const isHighlighted = selectedModelFilter === m
                                                return (
                                                    <span
                                                        key={m}
                                                        className={`text-[9px] px-2 py-0.5 rounded-md border font-medium transition ${isHighlighted
                                                                ? 'bg-blue-600 text-white border-blue-400'
                                                                : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                                                            }`}
                                                    >
                                                        {m}
                                                    </span>
                                                )
                                            })
                                        ) : (
                                            <span className="text-[10px] text-zinc-600">Chưa thiết lập</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ─── COMPONENT VẼ SƠ ĐỒ MẠNG LƯỚI BẰNG SVG ─────────────────────────────────
function NetworkTopologyGraph({
    nodes,
    activeModelFilter,
    allModels,
}: {
    nodes: UserNode[]
    activeModelFilter: string | null
    allModels: string[]
}) {
    const width = 800
    const height = 300
    const centerX = width / 2
    const centerY = height / 2

    // Tọa độ đặt các Node xung quanh hình tròn
    const nodeCoords = useMemo(() => {
        const total = nodes.length
        if (total === 0) return []

        const radius = Math.min(width, height) / 2.8
        return nodes.map((n, i) => {
            const angle = (i / total) * 2 * Math.PI - Math.PI / 2
            return {
                ...n,
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle),
            }
        })
    }, [nodes, width, height, centerX, centerY])

    // Tạo các đường liên kết (Links) giữa các Node chạy chung Model
    const links = useMemo(() => {
        const result: { x1: number; y1: number; x2: number; y2: number; model: string }[] = []

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
            {/* Lưới Nền (Grid Lines Decorative) */}
            <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Các Đường Nối Giữa Các Node (Connections) */}
            {links.map((link, idx) => (
                <line
                    key={idx}
                    x1={link.x1}
                    y1={link.y1}
                    x2={link.x2}
                    y2={link.y2}
                    stroke="#3b82f6"
                    strokeWidth={activeModelFilter ? '1.5' : '0.8'}
                    strokeOpacity={activeModelFilter ? '0.8' : '0.25'}
                    strokeDasharray={link.model.includes('Llama') ? '4 2' : undefined}
                />
            ))}

            {/* Các Điểm Nút Node (User Nodes) */}
            {nodeCoords.map((node) => {
                const isFilteredOut =
                    activeModelFilter &&
                    !node.hardwareNode?.recommendedModels?.includes(activeModelFilter)

                return (
                    <g
                        key={node._id}
                        transform={`translate(${node.x}, ${node.y})`}
                        className="transition-all duration-300 cursor-pointer"
                        style={{ opacity: isFilteredOut ? 0.2 : 1 }}
                    >
                        {/* Vòng Hào Quang Khi Node Online/Idle */}
                        <circle
                            r="18"
                            fill="none"
                            stroke={node.hardwareNode?.status === 'BUSY' ? '#f59e0b' : '#3b82f6'}
                            strokeWidth="1"
                            strokeOpacity="0.4"
                            className="animate-ping"
                            style={{ animationDuration: '3s' }}
                        />

                        {/* Điểm Nút Chính */}
                        <circle
                            r="14"
                            fill="#18181b"
                            stroke={
                                node.hardwareNode?.status === 'BUSY'
                                    ? '#f59e0b'
                                    : node.hardwareNode?.status === 'IDLE'
                                        ? '#10b981'
                                        : '#52525b'
                            }
                            strokeWidth="2"
                        />

                        {/* Ký Tự Đầu Của User */}
                        <text
                            textAnchor="middle"
                            dy="4"
                            fontSize="10"
                            fontWeight="bold"
                            fill="#ffffff"
                        >
                            {(node.username || 'U').charAt(0).toUpperCase()}
                        </text>

                        {/* Nhãn Tên User Nằm Phía Dưới Node */}
                        <text
                            textAnchor="middle"
                            y="28"
                            fontSize="9"
                            fill="#a1a1aa"
                            className="font-mono"
                        >
                            {node.username || 'Node'}
                        </text>
                    </g>
                )
            })}
        </svg>
    )
}