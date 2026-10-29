'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useAgents } from '@/hooks/useAgents'
import { agentsApi, ownerApi, RentalSessionData } from '@/lib/api'
import { toast } from 'sonner'
import { useConfirm } from '@/context/ConfirmContext'
import {
    IconBot,
    IconCpu,
    IconFileText,
    IconWrench,
    IconPlus,
    IconMessageSquare,
    IconBuilding,
    IconTrash,
    IconSparkles,
    IconSearch,
    IconZap,
    IconMap,
    IconDuck,
    IconAmr,
    IconDrone,
    IconHumanoid,
    IconEdit,
    IconHardDrive,
} from '@/components/ui/icons'

import { AgentFormType } from '@/components/agents/NvidiaRobots'

export default function AgentsPage() {
    const { confirm } = useConfirm()
    const { agents, connected, refresh } = useAgents()
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedFormFilter, setSelectedFormFilter] = useState<string>('all')
    const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all')
    const [formMap, setFormMap] = useState<Record<string, AgentFormType>>({})
    const [activeRentals, setActiveRentals] = useState<RentalSessionData[]>([])

    // Tải danh sách máy Seller đang thuê để đồng bộ cấu hình mô hình AI
    useEffect(() => {
        ownerApi.getMyRentals()
            .then((res) => {
                if (res.success && Array.isArray(res.rentals)) {
                    setActiveRentals(res.rentals.filter((r) => r.status === 'ACTIVE'))
                }
            })
            .catch(() => {})
    }, [])

    // Map tra cứu rental theo agentId hoặc sessionId
    const rentalByAgentId = useMemo(() => {
        const map: Record<string, RentalSessionData> = {}
        activeRentals.forEach((r) => {
            const aId = r.boundAgentId || r.assignedAgentId
            if (aId) map[aId] = r
        })
        return map
    }, [activeRentals])

    const rentalBySessionId = useMemo(() => {
        const map: Record<string, RentalSessionData> = {}
        activeRentals.forEach((r) => {
            const sId = r.sessionId || r.id || r._id
            if (sId) map[sId] = r
        })
        return map
    }, [activeRentals])

    const getAgentRental = (agent: any): RentalSessionData | null => {
        if (rentalByAgentId[agent.id]) return rentalByAgentId[agent.id]
        if (agent.model && typeof agent.model === 'string' && agent.model.startsWith('rented:')) {
            const sId = agent.model.replace('rented:', '')
            if (rentalBySessionId[sId]) return rentalBySessionId[sId]
        }
        return null
    }

    // Đọc form preference từ LocalStorage
    useEffect(() => {
        if (typeof window === 'undefined') return
        const map: Record<string, AgentFormType> = {}
        for (const ag of agents) {
            const savedForm = localStorage.getItem(`agent_form:${ag.id}`) as AgentFormType | null
            if (savedForm) {
                map[ag.id] = savedForm
            } else {
                // Nhận diện tự động qua tên hoặc id
                const lower = (ag.name + ' ' + ag.id).toLowerCase()
                if (lower.includes('duck') || lower.includes('vit')) {
                    map[ag.id] = 'duck'
                } else if (lower.includes('amr') || lower.includes('agv') || lower.includes('xe') || lower.includes('logistics')) {
                    map[ag.id] = 'amr'
                } else if (lower.includes('drone') || lower.includes('fly') || lower.includes('bay')) {
                    map[ag.id] = 'drone'
                } else {
                    map[ag.id] = 'humanoid'
                }
            }
        }
        setFormMap(map)
    }, [agents])

    async function handleDelete(id: string, name: string) {
        const isConfirmed = await confirm({
            title: 'Xóa Agent',
            description: `Bạn có chắc chắn muốn xóa Agent "${name}" (${id}) không?`,
            confirmText: 'Xóa Agent',
            variant: 'danger',
        })
        if (!isConfirmed) return
        try {
            await agentsApi.remove(id)
            if (typeof window !== 'undefined') {
                localStorage.removeItem(`agent_form:${id}`)
            }
            toast.success(`Đã xóa Agent "${name}"`)
            refresh()
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Xóa Agent thất bại')
        }
    }

    const statusColor: Record<string, { dot: string; label: string; text: string }> = {
        idle: { dot: 'bg-zinc-400', label: 'Rảnh rỗi', text: 'text-zinc-400' },
        working: { dot: 'bg-emerald-400', label: 'Đang làm việc', text: 'text-emerald-400' },
        meeting: { dot: 'bg-blue-400', label: 'Đang họp', text: 'text-blue-400' },
        blocked: { dot: 'bg-red-400', label: 'Tạm khóa', text: 'text-red-400' },
    }

    // Helper render badge hình thái Agent (NVIDIA Robotics)
    const getFormMeta = (form: AgentFormType) => {
        switch (form) {
            case 'duck':
                return {
                    label: 'MicroDuck Bipedal',
                    sub: 'Vịt 2 chân Servo AI',
                    icon: <IconDuck className="w-5 h-5 text-sky-300" />,
                    badgeBg: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
                }
            case 'amr':
                return {
                    label: 'Nova Carter AMR',
                    sub: 'Jetson AGX Orin · 360° LiDAR',
                    icon: <IconAmr className="w-5 h-5 text-orange-300" />,
                    badgeBg: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
                }
            case 'drone':
                return {
                    label: 'Cyber Falcon',
                    sub: 'Jetson Orin NX · RTK Aerial',
                    icon: <IconDrone className="w-5 h-5 text-cyan-300" />,
                    badgeBg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
                }
            case 'custom':
                return {
                    label: 'Custom Body',
                    sub: 'URDF Studio · Articulated',
                    icon: <IconBot className="w-5 h-5 text-purple-300" />,
                    badgeBg: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
                }
            default:
                return {
                    label: 'Project GR00T',
                    sub: 'Dual Thor Superchip · Biped',
                    icon: <IconHumanoid className="w-5 h-5 text-lime-300" />,
                    badgeBg: 'bg-lime-500/15 text-lime-400 border-lime-500/30',
                }
        }
    }

    // Thống kê theo form
    const stats = useMemo(() => {
        const counts = { total: agents.length, humanoid: 0, duck: 0, amr: 0, drone: 0, custom: 0 }
        for (const ag of agents) {
            const f = formMap[ag.id] || 'humanoid'
            if (f in counts) {
                counts[f as keyof typeof counts]++
            }
        }
        return counts
    }, [agents, formMap])

    // Lọc danh sách agents
    const filteredAgents = useMemo(() => {
        return agents.filter((ag) => {
            const form = formMap[ag.id] || 'humanoid'
            if (selectedFormFilter === 'rented_ai') {
                const hasRental = Boolean(getAgentRental(ag) || (ag.model && String(ag.model).startsWith('rented:')))
                if (!hasRental) return false
            } else if (selectedFormFilter !== 'all' && form !== selectedFormFilter) {
                return false
            }
            if (selectedStatusFilter !== 'all' && ag.status !== selectedStatusFilter) return false
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase()
                const matchName = ag.name?.toLowerCase().includes(q)
                const matchId = ag.id?.toLowerCase().includes(q)
                const matchModel = ag.model?.toLowerCase().includes(q)
                const matchPrompt = ag.prompt_id?.toLowerCase().includes(q)
                if (!matchName && !matchId && !matchModel && !matchPrompt) return false
            }
            return true
        })
    }, [agents, formMap, selectedFormFilter, selectedStatusFilter, searchQuery, activeRentals])

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header + Stats */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-zinc-900/90 via-zinc-900/50 to-zinc-950 p-6 rounded-3xl border border-zinc-800 shadow-xl backdrop-blur-xl">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                            <IconBot className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                                Quản Lý AI Agents & Robotics
                            </h1>
                            <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
                                {connected ? 'Agents Microservice Online' : 'Dịch vụ Offline'}
                                <span className="text-zinc-600">·</span>
                                <span className="text-zinc-300 font-medium">{agents.length} Nhân sự AI đang hoạt động</span>
                            </p>
                        </div>
                    </div>

                    {/* Stats pills */}
                    <div className="flex flex-wrap gap-2 mt-4 text-[11px]">
                        <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 flex items-center gap-1.5 font-bold">
                            <IconHardDrive className="w-3.5 h-3.5 text-cyan-400" />
                            <span>P2P Seller AI:</span> <strong className="text-cyan-200 font-mono">{activeRentals.length} máy thuê</strong>
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-lime-500/10 border border-lime-500/20 text-lime-400 flex items-center gap-1.5 font-bold">
                            <IconHumanoid className="w-3.5 h-3.5 text-lime-400" />
                            <span>GR00T Biped:</span> <strong className="text-white font-mono">{stats.humanoid}</strong>
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center gap-1.5 font-bold">
                            <IconDuck className="w-3.5 h-3.5 text-amber-400" />
                            <span>MicroDuck:</span> <strong className="text-amber-200 font-mono">{stats.duck}</strong>
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-300 flex items-center gap-1.5 font-bold">
                            <IconAmr className="w-3.5 h-3.5 text-orange-400" />
                            <span>Nova Carter AMR:</span> <strong className="text-orange-200 font-mono">{stats.amr}</strong>
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 flex items-center gap-1.5 font-bold">
                            <IconDrone className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Cyber Falcon:</span> <strong className="text-cyan-200 font-mono">{stats.drone}</strong>
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 flex items-center gap-1.5 font-bold">
                            <IconBot className="w-3.5 h-3.5 text-purple-400" />
                            <span>Custom Body:</span> <strong className="text-purple-200 font-mono">{stats.custom || 0}</strong>
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        href="/agent-body-studio"
                        className="rounded-xl bg-violet-950/70 hover:bg-violet-900/80 border border-violet-500/30 text-violet-300 hover:text-white text-xs px-3.5 py-2.5 transition font-medium flex items-center gap-2"
                        title="Thiết kế khung xương, khớp chuyển động & xuất URDF train RL"
                    >
                        <IconBot className="w-4 h-4 text-violet-400" />
                        <span>Body Studio 3D</span>
                    </Link>

                    <Link
                        href="/maps/setup"
                        className="rounded-xl bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-xs px-3.5 py-2.5 transition font-medium flex items-center gap-2"
                    >
                        <IconMap className="w-4 h-4 text-cyan-400" />
                        <span>Bố trí trên Map</span>
                    </Link>

                    <Link
                        href="/agents/setup"
                        className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs px-4 py-2.5 transition font-semibold shadow-lg shadow-blue-600/25 flex items-center gap-2"
                    >
                        <IconPlus className="w-4 h-4" />
                        <span>Tạo Agent Mới (3D Setup)</span>
                    </Link>
                </div>
            </div>

            {/* Filter bar & Search */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-zinc-900/60 border border-zinc-800/80 p-3 rounded-2xl">
                {/* Search box */}
                <div className="relative w-full md:w-80">
                    <IconSearch className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm kiếm theo tên, id, model, prompt..."
                        className="w-full pl-9 pr-3 py-1.5 bg-zinc-950/80 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-blue-500 transition"
                    />
                </div>

                {/* Form type filters */}
                <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                    <span className="text-[11px] text-zinc-500 px-2 shrink-0">Bộ lọc:</span>
                    {[
                        { id: 'all', label: 'Tất cả Robot', icon: null },
                        {
                            id: 'rented_ai',
                            label: `Dùng AI Đã Thuê (${agents.filter((ag) => Boolean(getAgentRental(ag) || (ag.model && String(ag.model).startsWith('rented:')))).length})`,
                            icon: <IconHardDrive className="w-3.5 h-3.5 text-cyan-400" />,
                        },
                        { id: 'humanoid', label: 'GR00T Biped', icon: <IconHumanoid className="w-3.5 h-3.5 text-lime-400" /> },
                        { id: 'duck', label: 'MicroDuck', icon: <IconDuck className="w-3.5 h-3.5 text-amber-400" /> },
                        { id: 'amr', label: 'Nova Carter', icon: <IconAmr className="w-3.5 h-3.5 text-orange-400" /> },
                        { id: 'drone', label: 'Cyber Falcon', icon: <IconDrone className="w-3.5 h-3.5 text-cyan-400" /> },
                        { id: 'custom', label: 'Custom Studio', icon: <IconBot className="w-3.5 h-3.5 text-purple-400" /> },
                    ].map((btn) => {
                        const active = selectedFormFilter === btn.id
                        return (
                            <button
                                key={btn.id}
                                onClick={() => setSelectedFormFilter(btn.id)}
                                className={`px-2.5 py-1 text-xs rounded-lg transition font-medium shrink-0 flex items-center gap-1.5 ${
                                    active
                                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                                }`}
                            >
                                {btn.icon}
                                <span>{btn.label}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Empty state */}
            {filteredAgents.length === 0 && (
                <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/30 py-20 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center text-zinc-500 mx-auto mb-3">
                        <IconBot className="w-7 h-7 text-zinc-500" />
                    </div>
                    <p className="text-zinc-300 font-medium text-sm">Không tìm thấy Agent nào phù hợp</p>
                    <p className="text-zinc-500 text-xs mt-1">
                        Hãy thử điều chỉnh lại bộ lọc hoặc tạo thêm Agent dạng Rubber Duck, AMR mới
                    </p>
                    <Link
                        href="/agents/setup"
                        className="mt-4 inline-flex items-center gap-1.5 text-xs text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 px-3 py-1.5 rounded-xl font-medium transition"
                    >
                        <IconPlus className="w-3.5 h-3.5" />
                        <span>Mở 3D Studio Tạo Agent</span>
                    </Link>
                </div>
            )}

            {/* Agents Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredAgents.map((agent) => {
                    const form = formMap[agent.id] || 'humanoid'
                    const meta = getFormMeta(form)
                    const statusInfo = statusColor[agent.status] || { dot: 'bg-zinc-500', label: agent.status, text: 'text-zinc-400' }

                    return (
                        <div
                            key={agent.id}
                            className="group relative rounded-3xl border border-zinc-800/90 bg-gradient-to-b from-zinc-900/90 to-zinc-950 hover:border-zinc-700 hover:shadow-2xl hover:shadow-blue-950/20 transition-all duration-300 overflow-hidden flex flex-col justify-between"
                        >
                            {/* Dải màu nhận diện trên nóc card */}
                            <div
                                className="h-1.5 w-full transition-all duration-300"
                                style={{ backgroundColor: agent.color || '#3b82f6' }}
                            />

                            <div className="p-5 flex-1 flex flex-col justify-between">
                                <div>
                                    {/* Header card: Icon/Avatar + Tên + Badge Hình Thái */}
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <Link
                                            href={`/agents/${agent.id}`}
                                            className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-95 group/title cursor-pointer"
                                            title={`Bấm để chỉnh sửa Agent: ${agent.name}`}
                                        >
                                            {/* Avatar Box với biểu tượng hình thái */}
                                            <div
                                                className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-lg relative border border-white/10 group-hover/title:scale-105 transition-transform"
                                                style={{ backgroundColor: agent.color || '#3b82f6' }}
                                            >
                                                <span>{meta.icon}</span>
                                                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center">
                                                    <span className={`w-2 h-2 rounded-full ${statusInfo.dot}`} />
                                                </div>
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <h2 className="font-bold text-base text-zinc-100 truncate group-hover/title:text-blue-400 transition">
                                                        {agent.name}
                                                    </h2>
                                                    <IconEdit className="w-3.5 h-3.5 text-zinc-500 group-hover/title:text-blue-400 opacity-60 group-hover/title:opacity-100 transition shrink-0" />
                                                </div>
                                                <p className="text-[11px] text-zinc-500 font-mono truncate">
                                                    @{agent.id}
                                                </p>
                                            </div>
                                        </Link>

                                        {/* Badge dạng Agent */}
                                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border shrink-0 ${meta.badgeBg}`}>
                                            {meta.label}
                                        </span>
                                    </div>

                                    {/* Clickable Speech & Specs to Edit */}
                                    <Link
                                        href={`/agents/${agent.id}`}
                                        className="block cursor-pointer group/desc"
                                        title={`Bấm để chỉnh sửa Agent: ${agent.name}`}
                                    >
                                        {/* Speech / Description */}
                                        <div className="bg-zinc-950/50 group-hover/desc:bg-zinc-900/60 group-hover/desc:border-zinc-700/80 rounded-xl p-2.5 border border-zinc-800/50 mb-3 min-h-[50px] flex items-center transition">
                                            <p className="text-xs text-zinc-300 line-clamp-2 italic group-hover/desc:text-zinc-200">
                                                {agent.speech ? `"${agent.speech}"` : (
                                                    <span className="text-zinc-600 not-italic">Sẵn sàng nhận chỉ đạo tác vụ từ hệ thống...</span>
                                                )}
                                            </p>
                                        </div>

                                        {/* Silicon Hardware Spec & Tags */}
                                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-zinc-300">
                                                <IconCpu className="w-3 h-3 text-lime-400 shrink-0" />
                                                <span>{meta.sub}</span>
                                            </span>

                                            {(() => {
                                                const r = getAgentRental(agent)
                                                if (r) {
                                                    return (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono text-[10px] font-semibold">
                                                            <IconHardDrive className="w-3 h-3 text-cyan-400 shrink-0" />
                                                            <span className="truncate max-w-[130px]">P2P: {r.nodeName}</span>
                                                        </span>
                                                    )
                                                }
                                                return (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                                                        <span>{agent.model || 'gemini-2.5-flash-lite'}</span>
                                                    </span>
                                                )
                                            })()}

                                            {agent.prompt_id && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                                                    <IconFileText className="w-3 h-3 text-blue-400 shrink-0" />
                                                    <span className="truncate max-w-[100px]">{agent.prompt_id}</span>
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                </div>

                                {/* Footer Action Buttons */}
                                <div className="mt-4 pt-3.5 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                        <Link
                                            href={`/agents/${agent.id}`}
                                            className="text-xs text-blue-400 hover:text-white transition px-2.5 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-600 border border-blue-500/20 font-semibold flex items-center gap-1.5"
                                            title={`Chỉnh sửa cấu hình Agent: ${agent.name}`}
                                        >
                                            <IconEdit className="w-3.5 h-3.5" />
                                            <span>Chỉnh sửa</span>
                                        </Link>

                                        <Link
                                            href={`/chat/${agent.id}`}
                                            className="text-xs text-zinc-400 hover:text-white transition px-2.5 py-1.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/50 flex items-center gap-1 font-medium"
                                        >
                                            <IconMessageSquare className="w-3 h-3" />
                                            <span>Chat</span>
                                        </Link>

                                        <Link
                                            href="/office"
                                            className="text-xs text-zinc-400 hover:text-emerald-400 transition px-2 py-1.5 rounded-xl hover:bg-zinc-800 flex items-center gap-1 font-medium"
                                        >
                                            <IconBuilding className="w-3 h-3" />
                                            <span className="hidden sm:inline">Office</span>
                                        </Link>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleDelete(agent.id, agent.name)}
                                        className="text-xs text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition p-1.5 rounded-xl border border-transparent hover:border-red-500/20"
                                        title="Xóa Agent này"
                                    >
                                        <IconTrash className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}