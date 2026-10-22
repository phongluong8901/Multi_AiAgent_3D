'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useMemo } from 'react'
import { AgentAction } from '@/components/agents/Agent'
import { OFFICE_ACTION_SPOTS, OFFICE_DESK_SLOTS } from '@/components/office/Room'
import { OUTDOOR_ACTION_SPOTS } from '@/components/outdoor/OutdoorPark'
import { agentsApi, Agent, ChatAttachment } from '@/lib/api'
import { roomsApi } from '@/lib/api/rooms'
import { getUser } from '@/lib/auth'
import { RoomTopNav } from '@/components/room-detail/RoomTopNav'
import { AgentTeamStrip } from '@/components/room-detail/AgentTeamStrip'
import { RoomWorkspaceLayout } from '@/components/room-detail/screen-split/RoomWorkspaceLayout'
import { ModalsContainer } from '@/components/room-detail/modals/ModalsContainer'
import { MapType } from '@/components/Scene'
import { useRoom } from '@/hooks/useRoom'
import { useChat } from '@/hooks/useChat'

type ViewMode = 'split' | '3d' | 'chat'

const DEFAULT_AGENTS = [
    'agent_manager',
    'agent_ml',
    'agent_analyst',
    'agent_search',
    'agent_summarizer',
]

export default function CollaborativeRoomPage() {
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
    const [managementTab, setManagementTab] = useState<'members' | 'agents' | 'invite'>('members')

    const isLeavingRef = useRef(false)
    const chatEndRef = useRef<HTMLDivElement | null>(null)
    const chatScrollRef = useRef<HTMLDivElement | null>(null)
    const prevMsgCountRef = useRef(0)
    const isFirstScrollRef = useRef(true)

    // 1. Sử dụng useRoom (quản lý thông tin phòng, password phòng private & socket room)
    const {
        room,
        setRoom,
        loading: roomLoading,
        socketOnlineUsers,
        loadRoomData,
    } = useRoom(roomId, currentUserId, currentUserName)

    // 2. Sử dụng useChat (quản lý tin nhắn, socket chat, upload file, agent status & workflow traces)
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
        uploadAndAttachFile, // <--- Đã lấy thêm hàm upload từ hook useChat
    } = useChat({
        roomId,
        typeChat: 'team', // Mặc định luồng chat là team
        onRoomUpdated: loadRoomData,
    })

    // Load danh sách agents hệ thống và tự động join phòng
    useEffect(() => {
        if (!roomId) return
        let cancelled = false

            ; (async () => {
                try {
                    const agentsList = await agentsApi.list().catch(() => [])
                    if (cancelled) return

                    await loadRoomData()
                    if (currentUserId) {
                        try {
                            const roomData = await roomsApi.join(roomId, { name: currentUserName })
                            if (roomData) setRoom(roomData)
                        } catch {
                            /* Đã là thành viên thì bỏ qua */
                        }
                    }
                    setAllAgents(agentsList ?? [])
                } catch (err) {
                    console.error(err)
                }
            })()

        return () => {
            cancelled = true
        }
    }, [roomId, currentUserId, currentUserName, loadRoomData, setRoom])

    // Kiểm tra quyền: Bị đá ra khỏi phòng
    useEffect(() => {
        if (!room || !currentUserId) return
        if (isLeavingRef.current) return

        const isOwner = room.ownerId === currentUserId
        const members = room.members ?? []
        const inMembers = members.some((m) => m.memberId === currentUserId)
        if (!isOwner && members.length > 0 && !inMembers) {
            alert('Bạn đã bị mời ra khỏi phòng')
            router.replace('/rooms')
        }
    }, [room, currentUserId, router])

    // Đồng bộ trạng thái Agent
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

    // Tự động cuộn chat
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

    // Lọc danh sách online users
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

    const handleSelectAgent = (agentId: string) => {
        setSelected3dAgentId(agentId)
        setTargetAgentId(agentId)
    }

    const handleFloorClick = (point: [number, number, number]) => {
        if (!selected3dAgentId) return
        setAgentTargetActions((prev) => ({
            ...prev,
            [selected3dAgentId]: { action: 'custom', targetPos: point },
        }))
    }

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

    // Cập nhật hàm handleSend nhận thêm file đính kèm từ TeamChatPanel
    const handleSend = async (e: React.FormEvent, attachment?: ChatAttachment) => {
        e.preventDefault()
        if (!input.trim() && !attachment) return
        const text = input.trim()
        setInput('')
        setMentionPopupOpen(false)

        // Gọi hàm sendMessage từ useChat, truyền kèm mảng attachments nếu có
        const attachmentsList = attachment ? [attachment] : undefined
        await sendMessage(text, attachmentsList, targetAgentId || undefined)
    }

    const runTeamPipeline = async () => {
        if (pipelineRunning) return
        setPipelineRunning(true)
        await sendMessage(
            '@agent_manager Hãy kích hoạt workflow phân tích dữ liệu và tóm tắt báo cáo nhóm.',
            undefined,
            'agent_manager'
        )
        setTimeout(() => setPipelineRunning(false), 3000)
    }

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

    const handleLeaveRoom = async () => {
        if (!confirm('Bạn có chắc chắn muốn rời khỏi phòng này không?')) return

        try {
            isLeavingRef.current = true
            await roomsApi.leave(roomId)
            alert('Đã rời khỏi phòng thành công.')
            router.replace('/rooms')
        } catch (err: any) {
            isLeavingRef.current = false
            alert(err.message || 'Không thể rời khỏi phòng')
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
                uploadAndAttachFile={uploadAndAttachFile} // <-- TRUYỀN HÀM UPLOAD VÀO ĐÂY
                setActiveTrace={setActiveTrace}
                setTraceModalOpen={setTraceModalOpen}
                chatEndRef={chatEndRef}
                chatScrollRef={chatScrollRef}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
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
        </div>
    )
}

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