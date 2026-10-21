'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useMemo } from 'react'
import { AgentAction } from '@/components/agents/Agent'
import { OFFICE_ACTION_SPOTS, OFFICE_DESK_SLOTS } from '@/components/office/Room'
import { OUTDOOR_ACTION_SPOTS } from '@/components/outdoor/OutdoorPark'
import { useRoomCollaboration } from '@/hooks/useRoomCollaboration'
import { roomsApi, agentsApi, Room, Agent } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { io } from 'socket.io-client'
import { RoomTopNav } from '@/components/room-detail/RoomTopNav'
import { AgentTeamStrip } from '@/components/room-detail/AgentTeamStrip'
import { RoomWorkspaceLayout } from '@/components/room-detail/screen-split/RoomWorkspaceLayout'
import { ModalsContainer } from '@/components/room-detail/modals/ModalsContainer'
import { MapType } from '@/components/Scene'

// Định nghĩa chế độ hiển thị màn hình làm việc: Chia đôi, Chỉ 3D, hoặc Chỉ Khung Chat
type ViewMode = 'split' | '3d' | 'chat'

// Danh sách AI Agent mặc định khi phòng chưa cấu hình
const DEFAULT_AGENTS = [
    'agent_manager',
    'agent_ml',
    'agent_analyst',
    'agent_search',
    'agent_summarizer',
]

export default function CollaborativeRoomPage() {
    // 1. Lấy thông tin định danh phòng từ URL params và Router
    const params = useParams()
    const router = useRouter()
    const roomId = String(params.roomId || '')

    // Lấy thông tin user hiện tại đang đăng nhập
    const me = getUser()
    const currentUserId = me?.id || ''
    const currentUserName = me?.name || me?.email || 'User'

    // 2. Định nghĩa các State quản lý dữ liệu và trạng thái giao diện của phòng
    const [room, setRoom] = useState<Room | null>(null)
    const [allAgents, setAllAgents] = useState<Agent[]>([])
    const [roomAgents, setRoomAgents] = useState<Agent[]>([])
    const [viewMode, setViewMode] = useState<ViewMode>('split')
    const [mapType, setMapType] = useState<MapType>('office')
    const [selected3dAgentId, setSelected3dAgentId] = useState('agent_manager')
    const [agentTargetActions, setAgentTargetActions] = useState<
        Record<string, { action: AgentAction; targetPos: [number, number, number] }>
    >({})
    const [input, setInput] = useState('')
    const [targetAgentId, setTargetAgentId] = useState('')
    const [mentionPopupOpen, setMentionPopupOpen] = useState(false)
    const [addAgentModalOpen, setAddAgentModalOpen] = useState(false)
    const [pipelineRunning, setPipelineRunning] = useState(false)
    const [traceModalOpen, setTraceModalOpen] = useState(false)
    const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
    const [managementTab, setManagementTab] = useState<'members' | 'agents' | 'invite'>('members')
    const [socketOnlineUsers, setSocketOnlineUsers] = useState<any[]>([])

    // Cờ đánh dấu khi người dùng chủ động rời phòng
    const isLeavingRef = useRef(false)

    // Các tham chiếu (Ref) hỗ trợ cuộn khung chat tự động
    const chatEndRef = useRef<HTMLDivElement | null>(null)
    const chatScrollRef = useRef<HTMLDivElement | null>(null)
    const prevMsgCountRef = useRef(0)
    const isFirstScrollRef = useRef(true)

    // 3. Gọi Custom Hook xử lý WebSockets, tin nhắn realtime và trạng thái của các Agent trong phòng
    const {
        messages,
        onlineUsers,
        agentStatuses,
        latestTraces,
        activeTrace,
        setActiveTrace,
        connected,
        loading: chatLoading,
        sendMessage,
    } = useRoomCollaboration(roomId)

    // --- CÁC HOOKS XỬ LÝ SIDE EFFECT (API CALLS & POLLING) ---

    // Load thông tin chi tiết phòng và danh sách toàn bộ hệ thống Agent khi vào trang
    useEffect(() => {
        if (!roomId) return
        let cancelled = false

            ; (async () => {
                try {
                    const [r, agentsList] = await Promise.all([
                        roomsApi.get(roomId).catch(() => null),
                        agentsApi.list().catch(() => []),
                    ])
                    if (cancelled) return

                    let roomData = r
                    if (roomData && currentUserId) {
                        try {
                            // Tự động tham gia phòng nếu user hợp lệ nhưng chưa gọi lệnh join
                            roomData = await roomsApi.join(roomId, { name: currentUserName })
                        } catch {
                            /* Đã là thành viên thì bỏ qua lỗi */
                        }
                    }
                    if (roomData) setRoom(roomData)
                    setAllAgents(agentsList ?? [])
                } catch (err) {
                    console.error(err)
                }
            })()

        return () => {
            cancelled = true
        }
    }, [roomId, currentUserId, currentUserName])

    // Kiểm tra quyền: Nếu user bị xóa khỏi phòng (không còn trong danh sách members), đá về trang Hub (`/rooms`)
    useEffect(() => {
        if (!room || !currentUserId) return
        if (isLeavingRef.current) return // Bỏ qua nếu là do chủ động bấm rời phòng

        const isOwner = room.ownerId === currentUserId
        const members = room.members ?? []
        const inMembers = members.some((m) => m.memberId === currentUserId)
        if (!isOwner && members.length > 0 && !inMembers) {
            alert('Bạn đã bị mời ra khỏi phòng')
            router.replace('/rooms')
        }
    }, [room, currentUserId, router])

    // Đồng bộ dữ liệu phòng Real-Time qua Socket.IO (loại bỏ hoàn toàn polling 5s)
    useEffect(() => {
        if (!roomId || !currentUserId) return

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_ROOM_URL || 'http://localhost:4000'
        const token = localStorage.getItem('token') || ''

        const socket = io(socketUrl, {
            path: '/api/v1/rooms/socket.io',
            transports: ['polling', 'websocket'],
            auth: { token },
            extraHeaders: token ? { Authorization: `Bearer ${token}` } : {},
        })

        socket.on('connect', () => {
            console.log(`[Room Socket] Connected to room ${roomId}, socket id: ${socket.id}`)
            // Định danh cá nhân và tham gia kênh phòng kèm thông tin hiển thị
            socket.emit('identity', currentUserId)
            socket.emit('join', {
                roomId,
                user: {
                    id: currentUserId,
                    name: currentUserName,
                    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUserName || currentUserId}`,
                    color: '#3b82f6',
                },
            })
            // Yêu cầu lấy presence ngay khi vừa kết nối
            socket.emit('get_presence', roomId)
        })

        // Lắng nghe sự kiện danh sách Online thay đổi thời gian thực qua Socket.IO
        socket.on('room_presence', (data: { roomId: string; onlineUsers: any[] }) => {
            console.log('👥 [Room Socket] Realtime online presence updated:', data?.onlineUsers)
            if (data?.onlineUsers) {
                setSocketOnlineUsers(data.onlineUsers)
            }
        })

        // Lắng nghe sự kiện phòng được cập nhật (thành viên thay đổi, gán agent, v.v.)
        socket.on('room-updated', async (data) => {
            console.log('🔄 [Room Socket] Received room-updated event:', data)
            try {
                const r = await roomsApi.get(roomId)
                if (r) setRoom(r)
            } catch (err) {
                console.error('[Room Socket] Error fetching updated room:', err)
            }
        })

        socket.on('connect_error', (err) => {
            console.warn('[Room Socket] Connection warning:', err.message)
        })

        return () => {
            socket.emit('leave', roomId)
            socket.disconnect()
        }
    }, [roomId, currentUserId, currentUserName])

    // Đồng bộ trạng thái và vị trí của các Agent đang hoạt động trong phòng
    useEffect(() => {
        if (!room) return
        const activeIds = room.activeAgents?.length ? room.activeAgents : DEFAULT_AGENTS
        setRoomAgents(
            activeIds.map((id) => {
                const found = allAgents.find((a) => a.id === id)
                const owner = room.userAgents?.find((b) => b.agentId === id)
                const live = agentStatuses[id]
                if (found) {
                    return {
                        ...found,
                        status: (live?.status || found.status || 'idle') as Agent['status'],
                        speech: live?.speech ?? found.speech ?? null,
                        ownerName: owner?.userName,
                    }
                }
                return {
                    id,
                    name: formatAgentName(id),
                    color: getAgentDefaultColor(id),
                    status: (live?.status || 'idle') as Agent['status'],
                    speech: live?.speech ?? null,
                    position: [0, 0, 0] as [number, number, number],
                    ownerName: owner?.userName,
                }
            })
        )
    }, [room, allAgents, agentStatuses])

    // Tự động cuộn xuống tin nhắn mới nhất khi có tin nhắn chat đến
    useEffect(() => {
        if (messages.length <= prevMsgCountRef.current) {
            prevMsgCountRef.current = messages.length
            return
        }
        const el = chatScrollRef.current
        const nearBottom =
            !el || el.scrollHeight - el.scrollTop - el.clientHeight < 140
        if (isFirstScrollRef.current || nearBottom) {
            chatEndRef.current?.scrollIntoView({
                behavior: isFirstScrollRef.current ? 'auto' : 'smooth',
            })
            isFirstScrollRef.current = false
        }
        prevMsgCountRef.current = messages.length
    }, [messages.length])

    // Lọc danh sách người dùng đang online thuộc đúng thành viên của phòng (ưu tiên realtime Socket.IO)
    const visibleOnlineUsers = useMemo(() => {
        const sourceList = socketOnlineUsers.length > 0 ? socketOnlineUsers : (onlineUsers ?? [])
        if (!room) return sourceList
        const memberIds = new Set((room.members ?? []).map((m) => m.memberId))
        const filtered = sourceList.filter((u) => {
            const uid = (u as any).userId || (u as any).id
            if (!uid) return false
            if (room.ownerId === uid) return true
            return memberIds.has(uid)
        })

        // Đảm bảo user hiện tại luôn hiển thị Online nếu đang ở trong phòng
        if (currentUserId && !filtered.some((u: any) => ((u as any).userId || (u as any).id) === currentUserId)) {
            filtered.unshift({
                userId: currentUserId,
                userName: currentUserName,
                avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUserName || currentUserId}`,
                color: '#3b82f6',
            } as any)
        }

        return filtered
    }, [socketOnlineUsers, onlineUsers, room, currentUserId, currentUserName])

    // --- CÁC HÀM XỬ LÝ SỰ KIỆN (HANDLERS) ---

    // Chọn Agent trên không gian 3D workspace
    const handleSelectAgent = (agentId: string) => {
        setSelected3dAgentId(agentId)
        setTargetAgentId(agentId)
    }

    // Xử lý sự kiện click trên sàn 3D để di chuyển Agent đến điểm chỉ định
    const handleFloorClick = (point: [number, number, number]) => {
        if (!selected3dAgentId) return
        setAgentTargetActions((prev) => ({
            ...prev,
            [selected3dAgentId]: { action: 'custom', targetPos: point },
        }))
    }

    // Xử lý điều hướng hành động tương tác của Agent (ngồi ghế sofa, bàn tròn, khu pha cà phê,...)
    const handleTriggerAction = (agentId: string, action: AgentAction) => {
        let targetPos: [number, number, number] = [0, 0, 0]
        if (mapType === 'office') {
            if (action === 'sofa') targetPos = OFFICE_ACTION_SPOTS.sofa
            else if (action === 'roundtable') targetPos = OFFICE_ACTION_SPOTS.roundtable
            else if (action === 'pingpong') targetPos = OFFICE_ACTION_SPOTS.pingpong
            else if (action === 'coffee') targetPos = OFFICE_ACTION_SPOTS.coffee
            else if (action === 'desk') {
                const idx = roomAgents.findIndex((a) => a.id === agentId)
                targetPos =
                    OFFICE_DESK_SLOTS[idx !== -1 ? idx % OFFICE_DESK_SLOTS.length : 0]
            }
        } else {
            if (action === 'bench') targetPos = OUTDOOR_ACTION_SPOTS.bench1
            else if (action === 'picnic') targetPos = OUTDOOR_ACTION_SPOTS.picnic1
            else if (action === 'gazebo') targetPos = OUTDOOR_ACTION_SPOTS.gazebo
            else if (action === 'fountain') targetPos = OUTDOOR_ACTION_SPOTS.fountain
            else if (action === 'coffee') targetPos = OUTDOOR_ACTION_SPOTS.coffee
        }
        setAgentTargetActions((prev) => ({
            ...prev,
            [agentId]: { action, targetPos },
        }))
    }

    // Gửi tin nhắn chat vào phòng
    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim()) return
        const text = input.trim()
        setInput('')
        setMentionPopupOpen(false)
        await sendMessage(text, targetAgentId || undefined)
    }

    // Kịch bản chạy tự động quy trình workflow của nhóm Agent
    const runTeamPipeline = async () => {
        if (pipelineRunning) return
        setPipelineRunning(true)
        await sendMessage(
            '@agent_manager Hãy kích hoạt workflow phân tích dữ liệu và tóm tắt báo cáo nhóm.',
            'agent_manager'
        )
        setTimeout(() => setPipelineRunning(false), 3000)
    }

    // Thêm AI Agent vào phòng làm việc
    const handleAddAgentToRoom = async (agentId: string) => {
        if (!room) return
        try {
            const updated = await roomsApi.addAgent(roomId, agentId)
            setRoom(updated)
            setAddAgentModalOpen(false)
        } catch {
            try {
                const current = room.activeAgents || []
                if (!current.includes(agentId)) {
                    const updated = await roomsApi.syncAgents(roomId, [...current, agentId])
                    setRoom(updated)
                }
                setAddAgentModalOpen(false)
            } catch (err: any) {
                alert(`Lỗi thêm agent: ${err.message}`)
            }
        }
    }

    // Viết hàm xử lý rời khỏi phòng
    const handleLeaveRoom = async () => {
        if (!confirm('Bạn có chắc chắn muốn rời khỏi phòng này không?')) return

        try {
            isLeavingRef.current = true // Đánh dấu đang tự rời phòng
            await roomsApi.leave(roomId)
            alert('Đã rời khỏi phòng thành công.')
            router.replace('/rooms')
        } catch (err: any) {
            isLeavingRef.current = false // Reset lại nếu lỗi
            alert(err.message || 'Không thể rời khỏi phòng')
        }
    }

    return (
        <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-zinc-950">
            {/* 1. Thanh điều hướng & tác vụ phòng hợp nhất (Top Navigation) */}
            <RoomTopNav
                roomId={roomId}
                room={room}
                connected={connected}
                onlineUsers={visibleOnlineUsers}
                latestTraces={latestTraces}
                activeTrace={activeTrace}
                setActiveTrace={setActiveTrace}
                setTraceModalOpen={setTraceModalOpen}
                onOpenManagement={() => {
                    setManagementTab('members')
                    setAssignmentModalOpen(true)
                }}
                onLeaveRoom={handleLeaveRoom}
                mapType={mapType}
                setMapType={setMapType}
                viewMode={viewMode}
                setViewMode={setViewMode}
            />

            {/* 2. Thanh hiển thị danh sách các Agent đang hoạt động trong phòng */}
            <AgentTeamStrip
                roomAgents={roomAgents}
                selected3dAgentId={selected3dAgentId}
                handleSelectAgent={handleSelectAgent}
                setInput={setInput}
            />

            {/* 4. Khung giao diện chính chia đôi màn hình (Workspace 3D & Team Chat Panel) */}
            <RoomWorkspaceLayout
                viewMode={viewMode}
                mapType={mapType}
                roomAgents={roomAgents}
                selected3dAgentId={selected3dAgentId}
                handleSelectAgent={handleSelectAgent}
                handleFloorClick={handleFloorClick}
                agentTargetActions={agentTargetActions}
                handleTriggerAction={handleTriggerAction}
                messages={messages}
                chatLoading={chatLoading}
                visibleOnlineUsers={visibleOnlineUsers}
                room={room}
                input={input}
                setInput={setInput}
                targetAgentId={targetAgentId}
                setTargetAgentId={setTargetAgentId}
                mentionPopupOpen={mentionPopupOpen}
                setMentionPopupOpen={setMentionPopupOpen}
                pipelineRunning={pipelineRunning}
                runTeamPipeline={runTeamPipeline}
                handleSend={handleSend}
                setActiveTrace={setActiveTrace}
                setTraceModalOpen={setTraceModalOpen}
                chatEndRef={chatEndRef}
                chatScrollRef={chatScrollRef}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
            />

            {/* 5. Container Modal Hợp nhất (Thành viên, Phân bổ Agent, Mời thành viên, Workflow Trace) */}
            <ModalsContainer
                roomId={roomId}
                room={room}
                allAgents={allAgents}
                onlineUsers={visibleOnlineUsers}
                addAgentModalOpen={false}
                setAddAgentModalOpen={(open) => {
                    if (open) {
                        setManagementTab('agents')
                        setAssignmentModalOpen(true)
                    } else {
                        setAssignmentModalOpen(false)
                    }
                }}
                handleAddAgentToRoom={handleAddAgentToRoom}
                traceModalOpen={traceModalOpen}
                setTraceModalOpen={setTraceModalOpen}
                activeTrace={activeTrace}
                latestTraces={latestTraces}
                setActiveTrace={setActiveTrace}
                assignmentModalOpen={assignmentModalOpen}
                setAssignmentModalOpen={setAssignmentModalOpen}
                setRoom={setRoom}
                currentTab={managementTab}
                setCurrentTab={setManagementTab}
            />
        </div>
    )
}

// --- CÁC HÀM TIỆN ÍCH (HELPERS) ---

// Chuyển đổi ID kỹ thuật của Agent thành tên hiển thị thân thiện
function formatAgentName(id: string) {
    const map: Record<string, string> = {
        agent_manager: 'Manager Agent',
        agent_ml: 'ML Expert',
        agent_analyst: 'Data Analyst',
        agent_search: 'Search Expert',
        agent_summarizer: 'Summarizer Agent',
    }
    return map[id] || id
}

// Gán màu mặc định cho từng loại Agent khi render huy hiệu hoặc giao diện
function getAgentDefaultColor(id: string) {
    const map: Record<string, string> = {
        agent_manager: '#3182ce',
        agent_ml: '#38a169',
        agent_analyst: '#d69e2e',
        agent_search: '#805ad5',
        agent_summarizer: '#e53e3e',
    }
    return map[id] || '#4a5568'
}