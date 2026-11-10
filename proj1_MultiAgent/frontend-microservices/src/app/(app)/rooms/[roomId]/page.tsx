'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useMemo } from 'react'
import { AgentAction } from '@/components/agents/Agent'
import { agentsApi, Agent, ChatAttachment, ChatType } from '@/lib/api'
import { roomsApi } from '@/lib/api/rooms'
import { getUser } from '@/lib/auth'
import { RoomTopNav } from '@/components/room-detail/RoomTopNav'
import { AgentTeamStrip } from '@/components/room-detail/AgentTeamStrip'
import { RoomWorkspaceLayout } from '@/components/room-detail/screen-split/RoomWorkspaceLayout'
import { ModalsContainer } from '@/components/room-detail/modals/ModalsContainer'
import { AgentStoreModal } from '@/components/room-detail/modals/AgentStoreModal'
import AgentInspectorModal from '@/components/agents/AgentInspectorModal'
import { MapType, resolveTargetPositionForAction } from '@/lib/maps/mapRegistry'
import { useRoom } from '@/hooks/useRoom'
import { useChat } from '@/hooks/useChat'
import { toast } from 'sonner'
import { useConfirm } from '@/context/ConfirmContext'

/** Chế độ hiển thị không gian làm việc: chia đôi màn hình (3D + Chat), chỉ 3D hoặc chỉ Chat */
type ViewMode = 'split' | '3d' | 'chat'

/** Danh sách các Agent cốt lõi mặc định trong phòng cộng tác */
const DEFAULT_AGENTS = [
    'agent_manager',
    'agent_ml',
    'agent_analyst',
    'agent_search',
    'agent_summarizer',
]

/**
 * Trang Không gian Phòng Cộng Tác Đa Tác Tử (Collaborative 3D & Multi-Agent Room).
 * Tích hợp:
 * - Mô phỏng 3D thời gian thực các Robot Agent (GR00T, MicroDuck, Nova Carter, Cyber Falcon)
 * - Hệ thống hội thoại đa kênh (Toàn phòng, Chat 1-1, Hỏi đáp Agent, Họp bàn tròn, Pipeline)
 * - Theo dõi trạng thái suy nghĩ, tiến trình công cụ (`activeTool`) và vết thực thi (`WorkflowTrace`)
 */
export default function CollaborativeRoomPage() {
    const { confirm } = useConfirm()
    const params = useParams()
    const router = useRouter()
    const roomId = String(params.roomId || '')

    const me = getUser()
    const currentUserId = me?.id || ''
    const currentUserName = me?.name || me?.email || 'User'

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
    const [storeModalOpen, setStoreModalOpen] = useState(false)
    const [managementTab, setManagementTab] = useState<'members' | 'agents' | 'workflow' | 'invite'>('members')
    const [isWaitingReply, setIsWaitingReply] = useState(false)
    const [inspectorAgent, setInspectorAgent] = useState<Agent | null>(null)
    const [inspectorOpen, setInspectorOpen] = useState(false)

    const isLeavingRef = useRef(false)
    const chatEndRef = useRef<HTMLDivElement | null>(null)
    const chatScrollRef = useRef<HTMLDivElement | null>(null)
    const prevMsgCountRef = useRef(0)
    const isFirstScrollRef = useRef(true)
    const pipelineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // 1. Quản lý thông tin phòng, xác thực mật khẩu phòng riêng tư & danh sách thành viên qua Socket
    const {
        room,
        setRoom,
        loading: roomLoading,
        socketOnlineUsers,
        loadRoomData,
    } = useRoom(roomId, currentUserId, currentUserName)

    // 2. Quản lý tin nhắn, streaming token, đính kèm file, trạng thái Agent & Workflow Trace
    const {
        messages,
        onlineUsers,
        agentStatuses,
        latestTraces,
        activeTrace,
        setActiveTrace,
        connected,
        chatLoading,
        sendMessage,
        uploadAndAttachFile,
    } = useChat({
        roomId,
        onRoomUpdated: loadRoomData,
    })

    const hasJoinedRoomRef = useRef<string | null>(null)

    // Dọn dẹp bộ đếm thời gian chạy Pipeline khi rời trang (unmount)
    useEffect(() => {
        return () => {
            if (pipelineTimerRef.current) {
                clearTimeout(pipelineTimerRef.current)
            }
        }
    }, [])

    // Tự động tắt cờ chờ `isWaitingReply` sau tối đa 25 giây nếu mạng bị gián đoạn để tránh treo UI
    useEffect(() => {
        if (!isWaitingReply) return
        const timeoutId = setTimeout(() => {
            setIsWaitingReply(false)
        }, 25000)
        return () => clearTimeout(timeoutId)
    }, [isWaitingReply])

    // Tải danh sách Agents hệ thống và tự động tham gia phòng lần đầu khi mở trang
    useEffect(() => {
        if (!roomId) return
        if (hasJoinedRoomRef.current === roomId) return
        hasJoinedRoomRef.current = roomId
        let cancelled = false

        ;(async () => {
            try {
                const [agentsList] = await Promise.all([
                    agentsApi.list().catch(() => []),
                    loadRoomData(true),
                ])
                if (cancelled) return

                if (currentUserId) {
                    try {
                        const roomData = await roomsApi.join(roomId, { name: currentUserName })
                        if (roomData && !cancelled) setRoom(roomData)
                    } catch {
                        // Người dùng đã là thành viên trong phòng
                    }
                }
                if (!cancelled) {
                    setAllAgents(agentsList ?? [])
                }
            } catch (err) {
                console.error('[ERROR] [CollaborativeRoomPage] Lỗi khởi tạo dữ liệu phòng:', err)
            }
        })()

        return () => {
            cancelled = true
        }
    }, [roomId, currentUserId, currentUserName, loadRoomData, setRoom])

    // Lắng nghe sự kiện cập nhật cấu hình từ trang Agent Setup & RL Training 3D để đồng bộ tức thời
    useEffect(() => {
        const refreshAgentsList = async () => {
            try {
                const fresh = await agentsApi.list()
                if (fresh && fresh.length > 0) {
                    setAllAgents(fresh)
                }
            } catch (_) {}
        }

        const handleUpdate = () => {
            refreshAgentsList()
        }

        window.addEventListener('agent-updated', handleUpdate)
        window.addEventListener('agent-rl-updated', handleUpdate)
        window.addEventListener('storage', handleUpdate)
        window.addEventListener('focus', handleUpdate)

        return () => {
            window.removeEventListener('agent-updated', handleUpdate)
            window.removeEventListener('agent-rl-updated', handleUpdate)
            window.removeEventListener('storage', handleUpdate)
            window.removeEventListener('focus', handleUpdate)
        }
    }, [])

    // Kiểm tra quyền thành viên: Chuyển hướng về trang danh sách nếu bị mời ra khỏi phòng
    useEffect(() => {
        if (!room || !currentUserId) return
        if (isLeavingRef.current) return

        const isOwner = room.ownerId === currentUserId
        const members = room.members ?? []
        const inMembers = members.some((m) => m.memberId === currentUserId)
        if (!isOwner && members.length > 0 && !inMembers) {
            toast.warning('Bạn đã bị mời ra khỏi phòng')
            router.replace('/rooms')
        }
    }, [room, currentUserId, router])

    // Đồng bộ danh sách Agent hoạt động trong phòng kèm trạng thái trực tiếp từ WebSocket
    useEffect(() => {
        if (!room) return
        const activeIds = room.activeAgents?.length ? room.activeAgents : DEFAULT_AGENTS

        // Nếu có bất kỳ Agent nào chuyển sang thinking, working, speaking hoặc error -> tắt cờ chờ chung
        const hasAgentRespondedOrStatusChanged = Object.values(agentStatuses).some(
            (s) =>
                s?.status === 'thinking' ||
                s?.status === 'working' ||
                s?.status === 'speaking' ||
                s?.status === 'error'
        )
        if (hasAgentRespondedOrStatusChanged) {
            setIsWaitingReply(false)
        }

        setRoomAgents(
            activeIds.map((id) => {
                const found = allAgents.find((a) => a.id === id)
                const owner = room.userAgents?.find((b) => b.agentId === id)
                const live = agentStatuses[id]
                let localModel: string | undefined
                let localForm: string | undefined
                let localBodyId: string | undefined
                if (typeof window !== 'undefined') {
                    localModel = localStorage.getItem(`agent_model:${id}`) || undefined
                    localForm = localStorage.getItem(`agent_form:${id}`) || undefined
                    localBodyId = localStorage.getItem(`agent_body_id:${id}`) || undefined
                }
                if (found) {
                    return {
                        ...found,
                        model: localModel || found.model || 'gemini-3.5-flash-lite',
                        form: (localForm || found.form || 'humanoid') as any,
                        body_id: localBodyId || found.body_id,
                        status: (live?.status || found.status || 'idle') as Agent['status'],
                        speech: live?.speech ?? found.speech ?? null,
                        ownerName: owner?.userName,
                        activeTool: live?.activeTool || null,
                    } as Agent & { activeTool?: string | null }
                }
                return {
                    id,
                    name: formatAgentName(id),
                    color: getAgentDefaultColor(id),
                    model: localModel || 'gemini-3.5-flash-lite',
                    form: (localForm || 'humanoid') as any,
                    body_id: localBodyId || null,
                    status: (live?.status || 'idle') as Agent['status'],
                    speech: live?.speech ?? null,
                    position: [0, 0, 0] as [number, number, number],
                    ownerName: owner?.userName,
                    activeTool: live?.activeTool || null,
                } as Agent & { activeTool?: string | null }
            })
        )
    }, [room, allAgents, agentStatuses])

    // Tự động cuộn khung chat xuống cuối khi có tin nhắn mới hoặc luồng token streaming từ Agent
    const lastMsgLen = messages[messages.length - 1]?.message?.length || 0
    useEffect(() => {
        const lastMsg = messages[messages.length - 1]
        if (lastMsg && (lastMsg.senderType === 'agent' || lastMsg.senderId?.startsWith('agent_'))) {
            setIsWaitingReply(false)
        }

        const isStreamingNow = Boolean((lastMsg as any)?.metadata?.isStreaming)
        if (messages.length <= prevMsgCountRef.current && !isStreamingNow) {
            prevMsgCountRef.current = messages.length
            return
        }
        const el = chatScrollRef.current
        const nearBottom =
            !el || el.scrollHeight - el.scrollTop - el.clientHeight < 180
        if (isFirstScrollRef.current || nearBottom) {
            chatEndRef.current?.scrollIntoView({
                behavior: isFirstScrollRef.current || isStreamingNow ? 'auto' : 'smooth',
            })
            isFirstScrollRef.current = false
        }
        prevMsgCountRef.current = messages.length
    }, [messages.length, lastMsgLen, messages])

    // Tổng hợp danh sách thành viên đang trực tuyến trong phòng
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

    /**
     * Xử lý khi người dùng chọn một Agent trên thanh đội hình hoặc trong cảnh 3D để thanh tra cấu hình.
     */
    const handleSelectAgent = (agentId: string) => {
        setSelected3dAgentId(agentId)
        setTargetAgentId(agentId)
        const found = roomAgents.find((a) => a.id === agentId) || allAgents.find((a) => a.id === agentId)
        let localModel: string | null = null
        let localForm: string | null = null
        let localBodyId: string | null = null
        if (typeof window !== 'undefined') {
            localModel = localStorage.getItem(`agent_model:${agentId}`)
            localForm = localStorage.getItem(`agent_form:${agentId}`)
            localBodyId = localStorage.getItem(`agent_body_id:${agentId}`)
        }
        if (found) {
            setInspectorAgent({
                ...found,
                model: localModel || found.model || 'gemini-3.5-flash-lite',
                form: (localForm as any) || found.form || 'humanoid',
                body_id: localBodyId || found.body_id,
            })
            setInspectorOpen(true)
        } else {
            setInspectorAgent({
                id: agentId,
                name: formatAgentName(agentId),
                color: getAgentDefaultColor(agentId),
                model: localModel || 'gemini-3.5-flash-lite',
                form: (localForm as any) || 'humanoid',
                body_id: localBodyId || null,
                status: 'idle',
                speech: null,
                position: [0, 0, 0],
            })
            setInspectorOpen(true)
        }
    }

    /** Di chuyển Agent đang chọn tới tọa độ điểm chạm trên mặt sàn 3D */
    const handleFloorClick = (point: [number, number, number]) => {
        if (!selected3dAgentId) return
        setAgentTargetActions((prev) => ({
            ...prev,
            [selected3dAgentId]: { action: 'custom', targetPos: point },
        }))
    }

    /** Kích hoạt hành động vị trí (ngồi bàn làm việc, họp, uống cà phê...) cho Agent trên bản đồ 3D */
    const handleTriggerAction = (agentId: string, action: AgentAction) => {
        const idx = roomAgents.findIndex((a) => a.id === agentId)
        const targetPos = resolveTargetPositionForAction(mapType, action, idx !== -1 ? idx : 0)
        setAgentTargetActions((prev) => ({
            ...prev,
            [agentId]: { action, targetPos },
        }))
    }

    /**
     * Gửi tin nhắn hoặc tệp đính kèm tới phòng / Agent mục tiêu.
     * Tự động khôi phục trạng thái chờ nếu quá trình gửi gặp lỗi.
     */
    const handleSend = async (
        e: React.FormEvent,
        attachment?: ChatAttachment,
        options?: { typeChat?: ChatType; targetAgentId?: string; targetUserId?: string }
    ) => {
        e.preventDefault()
        if (!input.trim() && !attachment) return
        const text = input.trim()
        setInput('')
        setMentionPopupOpen(false)

        // Nếu gửi vào các kênh agent/meeting/workflow hoặc có mention agent -> bật cờ chờ phản hồi
        const isAgentDest =
            options?.typeChat === 'agent' ||
            options?.typeChat === 'meeting' ||
            options?.typeChat === 'workflow' ||
            Boolean(options?.targetAgentId) ||
            Boolean(targetAgentId) ||
            text.includes('@agent_') ||
            text.includes('@all')
        if (isAgentDest) {
            setIsWaitingReply(true)
        }

        try {
            const attachmentsList = attachment ? [attachment] : undefined
            await sendMessage(
                text,
                attachmentsList,
                options?.targetAgentId || targetAgentId || undefined,
                options?.targetUserId || undefined,
                options?.typeChat || undefined
            )
        } catch (err: any) {
            setIsWaitingReply(false)
            toast.error(err?.message || 'Không thể gửi tin nhắn, vui lòng thử lại.')
        }
    }

    /** Kích hoạt nhanh quy trình phối hợp nhóm (Team Pipeline) thông qua Agent Manager */
    const runTeamPipeline = async () => {
        if (pipelineRunning) return
        setPipelineRunning(true)
        try {
            await sendMessage(
                '@agent_manager Hãy kích hoạt workflow phân tích dữ liệu và tóm tắt báo cáo nhóm.',
                undefined,
                'agent_manager',
                undefined,
                'workflow'
            )
        } catch {
            // Đã xử lý log tại useChat
        } finally {
            if (pipelineTimerRef.current) clearTimeout(pipelineTimerRef.current)
            pipelineTimerRef.current = setTimeout(() => {
                setPipelineRunning(false)
            }, 3000)
        }
    }

    /** Thêm một AI Agent mới vào danh sách hoạt động của phòng */
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
                toast.success('Đã thêm agent vào phòng')
            } catch (err: any) {
                toast.error(`Lỗi thêm agent: ${err.message}`)
            }
        }
    }

    /** Rời khỏi phòng cộng tác hiện tại */
    const handleLeaveRoom = async () => {
        const isConfirmed = await confirm({
            title: 'Rời phòng',
            description: 'Bạn có chắc chắn muốn rời khỏi phòng này không?',
            confirmText: 'Rời phòng',
            cancelText: 'Ở lại',
            variant: 'warning',
        })
        if (!isConfirmed) return

        try {
            isLeavingRef.current = true
            await roomsApi.leave(roomId)
            toast.success('Đã rời khỏi phòng thành công.')
            router.replace('/rooms')
        } catch (err: any) {
            isLeavingRef.current = false
            toast.error(err.message || 'Không thể rời khỏi phòng')
        }
    }

    return (
        <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-zinc-950">
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
                onOpenWorkflow={() => {
                    setManagementTab('workflow')
                    setAssignmentModalOpen(true)
                }}
                onOpenStore={() => setStoreModalOpen(true)}
                onLeaveRoom={handleLeaveRoom}
                mapType={mapType}
                setMapType={setMapType}
                viewMode={viewMode}
                setViewMode={setViewMode}
            />

            <AgentTeamStrip
                roomAgents={roomAgents}
                selected3dAgentId={selected3dAgentId}
                handleSelectAgent={handleSelectAgent}
                setInput={setInput}
            />

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
                uploadAndAttachFile={uploadAndAttachFile}
                setActiveTrace={setActiveTrace}
                setTraceModalOpen={setTraceModalOpen}
                chatEndRef={chatEndRef}
                chatScrollRef={chatScrollRef}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                isWaitingReply={isWaitingReply}
            />

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

            <AgentStoreModal
                isOpen={storeModalOpen}
                onClose={() => setStoreModalOpen(false)}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                roomId={roomId}
                onAgentSummoned={handleAddAgentToRoom}
            />

            <AgentInspectorModal
                isOpen={inspectorOpen}
                onClose={() => setInspectorOpen(false)}
                agent={inspectorAgent}
                mapName={mapType}
                onOpenChat={(agId) => {
                    setTargetAgentId(agId)
                    setViewMode('split')
                }}
                onAgentUpdated={(updated) => {
                    setAllAgents((prev) =>
                        prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
                    )
                }}
            />
        </div>
    )
}

/** Chuyển đổi mã ID mặc định của Agent sang tên hiển thị thân thiện */
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

/** Lấy mã màu nhận diện mặc định cho từng Agent cốt lõi */
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
