'use client'

import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { roomsApi, agentsApi, Room, Agent } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { RoomsHeader } from '@/components/room/RoomsHeader'
import { RoomInvitesList } from '@/components/room/RoomInvitesList'
import { RoomCard } from '@/components/room/RoomCard'
import { CreateRoomModal } from '@/components/room/CreateRoomModal'
import { toast } from 'sonner'
import { useConfirm } from '@/context/ConfirmContext'

export default function RoomsHubPage() {
    const me = getUser()
    const { confirm } = useConfirm()

    const [rooms, setRooms] = useState<Room[]>([])
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

    // --- BỔ SUNG 2 STATE QUẢN LÝ TRẠNG THÁI RIÊNG TƯ / MẬT KHẨU ---
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

    // --- KẾT NỐI SOCKET.IO REALTIME (Đã thêm extraHeaders để qua cổng 4000) ---
    useEffect(() => {
        loadData()
        loadInvites()

        if (!me?.id) return

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_ROOM_URL || 'http://localhost:4000'
        const token = localStorage.getItem('token') || ''

        const socket = io(socketUrl, {
            path: '/api/v1/rooms/socket.io',
            transports: ['polling', 'websocket'],
            auth: {
                token: token, // Dành cho room-service xác thực bên trong
            },
            extraHeaders: token ? {
                Authorization: `Bearer ${token}`, // Hỗ trợ qua API Gateway
            } : {},
        })

        socket.on('connect', () => {
            console.log('✅ Socket connected ID:', socket.id)
            socket.emit('identity', me.id)
            socket.emit('join', me.id)
        })

        socket.on('connect_error', (err) => {
            console.error('❌ Socket connection error:', err.message)
        })

        socket.on('room_invited', (data) => {
            console.log('🔔 Nhận được event room_invited:', data)
            loadInvites()
        })

        socket.on('room-updated', (data) => {
            console.log('🔄 Nhận được event room-updated:', data)
            loadData()
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
            prev.includes(agentId)
                ? prev.filter((id) => id !== agentId)
                : [...prev, agentId]
        )
    }

    return (
        <div className="space-y-8 pb-12">
            <RoomsHeader onCreateClick={() => setModalOpen(true)} />

            <RoomInvitesList invites={invites} setInvites={setInvites} />

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-zinc-200">
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
                roomName={roomName}
                setRoomName={setRoomName}
                description={description}
                setDescription={setDescription}
                tier={tier}
                setTier={setTier}
                ownedAgentsCount={ownedAgentsCount}
                setOwnedAgentsCount={setOwnedAgentsCount}
                availableAgents={availableAgents}
                selectedAgents={selectedAgents}
                toggleAgentSelection={toggleAgentSelection}
                submitting={submitting}
                isPublic={isPublic}
                setIsPublic={setIsPublic}
                password={password}
                setPassword={setPassword}
            />
        </div>
    )
}