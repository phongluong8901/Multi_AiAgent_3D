'use client'

import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { roomsApi, agentsApi, Room, Agent, RoomPresenceSummary } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { RoomsHeader } from '@/components/room/RoomsHeader'
import { RoomInvitesList } from '@/components/room/RoomInvitesList'
import { RoomCard } from '@/components/room/RoomCard'
import { CreateRoomModal } from '@/components/room/CreateRoomModal'
import { toast } from 'sonner'
import { useConfirm } from '@/context/ConfirmContext'
import { Building } from 'lucide-react'

export default function RoomsHubPage() {
    const me = getUser()
    const { confirm } = useConfirm()

    const [rooms, setRooms] = useState<Room[]>([])
    const [presenceSummary, setPresenceSummary] = useState<RoomPresenceSummary | null>(null)
    const [availableAgents, setAvailableAgents] = useState<Agent[]>([])
    const [loading, setLoading] = useState(true)
    const [modalOpen, setModalOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const [roomName, setRoomName] = useState('')
    const [description, setDescription] = useState('')
    const [maxCapacity] = useState(20)
    const [tier, setTier] = useState<'standard' | 'premium' | 'enterprise'>('standard')
    const [ownedAgentsCount, setOwnedAgentsCount] = useState(3)

    const [isPublic, setIsPublic] = useState(true)
    const [password, setPassword] = useState('')

    const [selectedAgents, setSelectedAgents] = useState<string[]>([
        'agent_manager',
        'agent_ml',
        'agent_analyst',
        'agent_search',
        'agent_summarizer',
    ])
    const [invites, setInvites] = useState<Room[]>([])

    const loadInvites = async () => {
        try {
            const list = await roomsApi.myInvites()
            setInvites(list)
        } catch {
            setInvites([])
        }
    }

    const loadData = async () => {
        try {
            setLoading(true)
            const [roomsList, agentsList, summary] = await Promise.all([
                roomsApi.list().catch(() => []),
                agentsApi.list().catch(() => []),
                roomsApi.getPresenceSummary().catch(() => null),
            ])
            setRooms(roomsList)
            setAvailableAgents(agentsList)
            if (summary) setPresenceSummary(summary)
        } catch (err) {
            console.error('Error loading rooms:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
        loadInvites()

        if (!me?.id) return

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_ROOM_URL || 'http://localhost:4000'
        const token = localStorage.getItem('token') || ''

        const socket = io(socketUrl, {
            path: '/api/v1/rooms/socket.io',
            transports: ['websocket'],
            auth: { token },
            extraHeaders: token ? { Authorization: `Bearer ${token}` } : {},
        })

        socket.on('connect', () => {
            socket.emit('identity', me.id)
        })

        socket.on('room_invited', () => {
            loadInvites()
        })

        let presenceDebounce: any = null
        socket.on('room-updated', () => {
            loadData()
        })

        socket.on('room-presence-changed', () => {
            // Debounce để tránh giật lag khi nhiều user online/offline liên tiếp
            clearTimeout(presenceDebounce)
            presenceDebounce = setTimeout(() => {
                loadData()
            }, 1000)
        })

        socket.on('global_presence_updated', () => {
            roomsApi.getPresenceSummary().then(setPresenceSummary).catch(() => {})
        })

        return () => {
            socket.disconnect()
        }
    }, [me?.id])

    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!roomName.trim()) return

        const currentUser = getUser()
        if (!currentUser?.id) {
            toast.error('Bạn cần đăng nhập để tạo phòng')
            return
        }

        try {
            setSubmitting(true)

            const room = await roomsApi.create({
                name: roomName.trim(),
                description: description.trim(),
                maxCapacity,
                ownerName: currentUser.name || currentUser.email || 'Owner',
                ownerId: currentUser.id,
                policy: {
                    tier,
                    isPublic,
                    password: isPublic ? undefined : password,
                    maxActiveAgents: 10,
                    ownedAgentsCount,
                },
                settings: {
                    allowCrossCommands: true,
                    autonomousHandoff: true,
                    maxAutoTurns: 3,
                },
            })

            const roomId = room._id || room.id
            if (roomId && selectedAgents.length > 0) {
                try {
                    await roomsApi.syncAgents(roomId, selectedAgents)
                } catch {
                    for (const agentId of selectedAgents) {
                        try {
                            await roomsApi.addAgent(roomId, agentId)
                        } catch {
                            /* ignore */
                        }
                    }
                }
            }

            setModalOpen(false)
            setRoomName('')
            setDescription('')
            setIsPublic(true)
            setPassword('')
            toast.success('Tạo phòng thành công!')
            await loadData()
        } catch (err: any) {
            toast.error(`Lỗi khi tạo phòng: ${err.message}`)
        } finally {
            setSubmitting(false)
        }
    }

    const handleDeleteRoom = async (room: Room) => {
        const roomId = room._id || room.id
        if (!roomId) return
        const isConfirmed = await confirm({
            title: 'Xóa phòng',
            description: `Bạn có chắc muốn xóa phòng "${room.name}"? Hành động này không thể hoàn tác.`,
            confirmText: 'Xóa phòng',
            variant: 'danger',
        })
        if (!isConfirmed) return

        try {
            setDeletingId(roomId)
            await roomsApi.remove(roomId)
            toast.success(`Đã xóa phòng "${room.name}"`)
            await loadData()
        } catch (err: any) {
            toast.error(err.message || 'Xóa phòng thất bại')
        } finally {
            setDeletingId(null)
        }
    }

    const toggleAgentSelection = (agentId: string) => {
        setSelectedAgents((prev) =>
            prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
        )
    }

    // Tính tổng Online / Offline từ danh sách phòng nếu summary chưa kịp về
    const computedOnline =
        presenceSummary?.totalOnline ??
        rooms.reduce((sum, r) => sum + (r.onlineCount ?? r.onlineUsers?.length ?? 0), 0)
    const computedOffline =
        presenceSummary?.totalOffline ??
        rooms.reduce((sum, r) => {
            const total = r.totalMembers ?? r.members?.length ?? 0
            const on = r.onlineCount ?? r.onlineUsers?.length ?? 0
            return sum + Math.max(0, total - on)
        }, 0)

    return (
        <div className="space-y-8 pb-12">
            <RoomsHeader onCreateClick={() => setModalOpen(true)} />

            {/* Thanh Thống kê Số lượng Người Online & Offline Toàn Hệ Thống Phòng */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Tổng Số Phòng
                        </p>
                        <p className="mt-1 text-2xl font-bold text-foreground">{rooms.length}</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20">
                        <Building className="w-5 h-5" />
                    </div>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/20 px-5 py-4 shadow-sm">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            Thành Viên Đang Online
                        </p>
                        <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">
                                {computedOnline}
                            </span>
                            <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80">người đang hoạt động</span>
                        </div>
                    </div>
                    <span className="h-3.5 w-3.5 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Thành Viên Đang Offline
                        </p>
                        <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-foreground">
                                {computedOffline}
                            </span>
                            <span className="text-xs text-muted-foreground">người ngoại tuyến</span>
                        </div>
                    </div>
                    <span className="h-3.5 w-3.5 rounded-full bg-muted-foreground/40" />
                </div>
            </div>

            <RoomInvitesList invites={invites} setInvites={setInvites} />

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground">
                        Các Phòng Đang Hoạt Động ({rooms.length})
                    </h2>
                    <button
                        type="button"
                        onClick={loadData}
                        className="rounded-lg border border-zinc-800 px-2.5 py-1 text-xs text-zinc-400 transition hover:border-zinc-700 hover:text-white"
                    >
                        Làm mới
                    </button>
                </div>

                {loading ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="h-56 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/60"
                            />
                        ))}
                    </div>
                ) : rooms.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 py-16 text-center">
                        <p className="text-sm text-zinc-400">Chưa có phòng nào được tạo.</p>
                        <button
                            type="button"
                            onClick={() => setModalOpen(true)}
                            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-blue-500"
                        >
                            Tạo phòng đầu tiên
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {rooms.map((room) => {
                            const roomId = room._id || room.id || ''
                            return (
                                <RoomCard
                                    key={roomId}
                                    room={room}
                                    currentUserId={me?.id}
                                    isDeleting={deletingId === roomId}
                                    onDelete={handleDeleteRoom}
                                />
                            )
                        })}
                    </div>
                )}
            </div>

            <CreateRoomModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSubmit={handleCreateRoom}
                submitting={submitting}
                roomName={roomName}
                setRoomName={setRoomName}
                description={description}
                setDescription={setDescription}
                tier={tier}
                setTier={setTier}
                ownedAgentsCount={ownedAgentsCount}
                setOwnedAgentsCount={setOwnedAgentsCount}
                isPublic={isPublic}
                setIsPublic={setIsPublic}
                password={password}
                setPassword={setPassword}
                availableAgents={availableAgents}
                selectedAgents={selectedAgents}
                toggleAgentSelection={toggleAgentSelection}
            />
        </div>
    )
}
