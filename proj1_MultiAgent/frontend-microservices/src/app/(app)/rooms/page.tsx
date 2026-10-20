'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { roomsApi, agentsApi, Room, Agent } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { IconPlus, IconUsers, IconBot, IconX, IconArrowLeft } from '@/components/ui/icons'

export default function RoomsHubPage() {
    const [rooms, setRooms] = useState<Room[]>([])
    const [availableAgents, setAvailableAgents] = useState<Agent[]>([])
    const [loading, setLoading] = useState(true)
    const [modalOpen, setModalOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // Form state
    const [roomName, setRoomName] = useState('')
    const [description, setDescription] = useState('')
    const [maxCapacity, setMaxCapacity] = useState(20)
    const [tier, setTier] = useState<'standard' | 'premium' | 'enterprise'>('standard')
    const [ownedAgentsCount, setOwnedAgentsCount] = useState(3)
    const [selectedAgents, setSelectedAgents] = useState<string[]>([
        'agent_manager',
        'agent_ml',
        'agent_analyst',
        'agent_search',
        'agent_summarizer',
    ])

    const loadData = async () => {
        try {
            setLoading(true)
            const [roomsList, agentsList] = await Promise.all([
                roomsApi.list().catch(() => []),
                agentsApi.list().catch(() => []),
            ])
            setRooms(roomsList)
            setAvailableAgents(agentsList)
        } catch (err) {
            console.error('Error loading rooms:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [])

    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!roomName.trim()) return

        const currentUser = getUser()
        const ownerId = currentUser?.id || 'user_guest_hq'
        const ownerName = currentUser?.name || currentUser?.email || 'Phong Luong'

        try {
            setSubmitting(true)
            // Gọi api create (đã được định nghĩa trỏ tới /rooms/user-user)
            await roomsApi.create({
                name: roomName.trim(),
                description: description.trim(),
                ownerId,
                maxCapacity,
                activeAgents: selectedAgents,
                policy: {
                    tier,
                    isPublic: true,
                    maxActiveAgents: 10,
                    ownedAgentsCount,
                },
                settings: {
                    allowCrossCommands: true,
                    autonomousHandoff: true,
                    maxAutoTurns: 3,
                },
                initialMember: {
                    memberId: ownerId,
                    memberType: 'user',
                    role: 'owner',
                    name: ownerName,
                    color: '#3b82f6',
                },
            })
            setModalOpen(false)
            setRoomName('')
            setDescription('')
            await loadData()
        } catch (err: any) {
            alert(`Lỗi khi tạo phòng: ${err.message}`)
        } finally {
            setSubmitting(false)
        }
    }

    const toggleAgentSelection = (agentId: string) => {
        setSelectedAgents((prev) =>
            prev.includes(agentId)
                ? prev.filter((id) => id !== agentId)
                : [...prev, agentId]
        )
    }

    const getAgentBadgeColor = (agentId: string) => {
        const colors: Record<string, string> = {
            agent_manager: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
            agent_ml: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
            agent_analyst: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
            agent_search: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
            agent_summarizer: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
        }
        return colors[agentId] || 'bg-zinc-800 text-zinc-300 border-zinc-700'
    }

    const getAgentShortName = (agentId: string) => {
        const names: Record<string, string> = {
            agent_manager: 'Manager',
            agent_ml: 'ML Expert',
            agent_analyst: 'Data Analyst',
            agent_search: 'Search Expert',
            agent_summarizer: 'Summarizer',
        }
        return names[agentId] || agentId.replace('agent_', '')
    }

    return (
        <div className="space-y-8 pb-12">
            {/* Header banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-zinc-900 border border-zinc-800/80 p-8 backdrop-blur">
                <div className="relative z-10 max-w-2xl space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                        Multi-User & Multi-Agent Collaboration Hub
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">
                        Phòng Làm Việc Nhóm Đa Agent
                    </h1>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                        Nhiều người dùng có thể tham gia chung một phòng, kết hợp các AI Agent thành một nhóm làm việc tự chủ, hỗ trợ phân quyền chủ phòng và chia sẻ file tài liệu (.csv, .xlsx, ảnh) mượt mà.
                    </p>
                    <div className="pt-2">
                        <button
                            onClick={() => setModalOpen(true)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-sm shadow-lg shadow-blue-500/25 transition active:scale-95"
                        >
                            <IconPlus className="w-4 h-4" />
                            <span>Tạo Room Nhóm Mới</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Room List Grid */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-zinc-200">
                        Các Phòng Đang Hoạt Động ({rooms.length})
                    </h2>
                    <button
                        onClick={loadData}
                        className="text-xs text-zinc-400 hover:text-white transition px-2.5 py-1 rounded-lg border border-zinc-800 hover:border-zinc-700"
                    >
                        Làm mới
                    </button>
                </div>

                {loading ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-56 rounded-2xl bg-zinc-900/60 border border-zinc-800 animate-pulse" />
                        ))}
                    </div>
                ) : rooms.length === 0 ? (
                    <div className="text-center py-16 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30">
                        <p className="text-zinc-400 text-sm">Chưa có phòng nào được tạo.</p>
                        <button
                            onClick={() => setModalOpen(true)}
                            className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition"
                        >
                            Tạo phòng đầu tiên
                        </button>
                    </div>
                ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {rooms.map((room) => {
                            const roomId = room._id || room.id || ''
                            const agentsCount = room.activeAgents?.length || 0
                            const membersCount = room.members?.length || 0
                            const tierBadge = room.policy?.tier || 'standard'
                            const ownedCount = room.policy?.ownedAgentsCount ?? 3

                            return (
                                <div
                                    key={roomId}
                                    className="group relative flex flex-col justify-between rounded-2xl border border-zinc-800/80 bg-zinc-900/80 p-6 backdrop-blur transition hover:border-blue-500/40 hover:shadow-xl hover:shadow-blue-500/5"
                                >
                                    <div className="space-y-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-white group-hover:text-blue-400 transition text-base">
                                                        {room.name}
                                                    </h3>
                                                    <span className="text-[10px] px-2 py-0.5 rounded uppercase tracking-wider font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                                        {tierBadge}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                                                    {room.description || 'Không có mô tả cho phòng này.'}
                                                </p>
                                            </div>
                                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                Live
                                            </span>
                                        </div>

                                        {/* Team Agents in Room */}
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                                                <span>Nhóm Agent ({agentsCount})</span>
                                                <span>Sở hữu tối đa: {ownedCount}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {room.activeAgents?.slice(0, 4).map((agId) => (
                                                    <span
                                                        key={agId}
                                                        className={`text-xs px-2 py-0.5 rounded-md border font-medium ${getAgentBadgeColor(agId)}`}
                                                    >
                                                        @{getAgentShortName(agId)}
                                                    </span>
                                                ))}
                                                {agentsCount > 4 && (
                                                    <span className="text-xs px-2 py-0.5 rounded-md border border-zinc-700 bg-zinc-800 text-zinc-400">
                                                        +{agentsCount - 4}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer Info & Action */}
                                    <div className="pt-5 mt-4 border-t border-zinc-800/80 flex items-center justify-between">
                                        <div className="text-xs text-zinc-400">
                                            Thành viên: <span className="text-zinc-200 font-medium">{membersCount}/{room.maxCapacity}</span>
                                        </div>
                                        <Link
                                            href={`/rooms/${roomId}`}
                                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600/90 hover:bg-blue-600 text-white text-xs font-semibold shadow transition active:scale-95"
                                        >
                                            Vào Room →
                                        </Link>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Modal Tạo Room Mới */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="relative w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-5">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-white">Tạo Phòng Nhóm Mới</h3>
                                <p className="text-xs text-zinc-400 mt-0.5">
                                    Thiết lập không gian làm việc đa Agent và phân quyền quản trị
                                </p>
                            </div>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="text-zinc-400 hover:text-white text-sm p-1.5 rounded-lg hover:bg-zinc-800 transition"
                            >
                                <IconX className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateRoom} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-zinc-300">Tên phòng *</label>
                                <input
                                    required
                                    value={roomName}
                                    onChange={(e) => setRoomName(e.target.value)}
                                    placeholder="ví dụ: AI Research & Data Analysis Lab"
                                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700/80 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-zinc-300">Mô tả mục tiêu của nhóm</label>
                                <textarea
                                    rows={2}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Mô tả công việc chung, hỗ trợ gửi tài liệu .csv, .xlsx, ảnh..."
                                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700/80 px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-zinc-300">Gói dịch vụ (Tier)</label>
                                    <select
                                        value={tier}
                                        onChange={(e) => setTier(e.target.value as any)}
                                        className="w-full rounded-xl bg-zinc-950 border border-zinc-700/80 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                                    >
                                        <option value="standard">Standard</option>
                                        <option value="premium">Premium</option>
                                        <option value="enterprise">Enterprise</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-zinc-300">Giới hạn Agent sở hữu</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={ownedAgentsCount}
                                        onChange={(e) => setOwnedAgentsCount(parseInt(e.target.value) || 3)}
                                        className="w-full rounded-xl bg-zinc-950 border border-zinc-700/80 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-zinc-300">
                                    Chọn các AI Agent làm việc trong phòng này
                                </label>
                                <div className="grid grid-cols-2 gap-2 pt-1 max-h-40 overflow-y-auto pr-1">
                                    {(availableAgents.length > 0
                                        ? availableAgents
                                        : [
                                            { id: 'agent_manager', name: 'Manager Agent' },
                                            { id: 'agent_ml', name: 'ML Expert' },
                                            { id: 'agent_analyst', name: 'Data Analyst' },
                                            { id: 'agent_search', name: 'Search Expert' },
                                            { id: 'agent_summarizer', name: 'Summarizer Agent' },
                                        ]
                                    ).map((ag) => {
                                        const checked = selectedAgents.includes(ag.id)
                                        return (
                                            <div
                                                key={ag.id}
                                                onClick={() => toggleAgentSelection(ag.id)}
                                                className={`cursor-pointer flex items-center gap-2 p-2.5 rounded-xl border text-xs transition select-none ${checked
                                                        ? 'bg-blue-600/15 border-blue-500/50 text-white font-medium'
                                                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => { }}
                                                    className="rounded border-zinc-700 text-blue-600 pointer-events-none"
                                                />
                                                <span className="truncate">{ag.name}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition disabled:opacity-50"
                                >
                                    {submitting ? 'Đang tạo...' : 'Tạo phòng ngay'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}