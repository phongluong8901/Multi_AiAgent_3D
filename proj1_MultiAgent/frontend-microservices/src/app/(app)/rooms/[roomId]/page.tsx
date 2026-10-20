'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { AgentAction } from '@/components/agents/Agent'
import { OFFICE_ACTION_SPOTS, OFFICE_DESK_SLOTS } from '@/components/office/Room'
import { OUTDOOR_ACTION_SPOTS } from '@/components/outdoor/OutdoorPark'
import { useRoomCollaboration } from '@/hooks/useRoomCollaboration'
import { roomsApi, agentsApi, Room, Agent, WorkflowTrace } from '@/lib/api'
import { RoomTopNav } from '@/components/room/RoomTopNav'
import { AgentTeamStrip } from '@/components/room/AgentTeamStrip'
import { Workspace3DPanel } from '@/components/room/Workspace3DPanel'
import { TeamChatPanel } from '@/components/room/TeamChatPanel'
import { ModalsContainer } from '@/components/room/ModalsContainer'
import { MapType } from '@/components/Scene'

type ViewMode = 'split' | '3d' | 'chat'

export default function CollaborativeRoomPage() {
    const params = useParams()
    const roomId = String(params.roomId)

    const [room, setRoom] = useState<Room | null>(null)
    const [allAgents, setAllAgents] = useState<Agent[]>([])
    const [roomAgents, setRoomAgents] = useState<Agent[]>([])
    const [viewMode, setViewMode] = useState<ViewMode>('split')
    const [mapType, setMapType] = useState<MapType>('office')
    const [selected3dAgentId, setSelected3dAgentId] = useState<string>('agent_manager')
    const [agentTargetActions, setAgentTargetActions] = useState<
        Record<string, { action: AgentAction; targetPos: [number, number, number] }>
    >({})
    const [input, setInput] = useState('')
    const [targetAgentId, setTargetAgentId] = useState<string>('')
    const [mentionPopupOpen, setMentionPopupOpen] = useState(false)
    const [addAgentModalOpen, setAddAgentModalOpen] = useState(false)
    const [pipelineRunning, setPipelineRunning] = useState(false)
    const [traceModalOpen, setTraceModalOpen] = useState(false)
    const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)

    const chatEndRef = useRef<HTMLDivElement | null>(null)
    const chatContainerRef = useRef<HTMLDivElement | null>(null)

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

    useEffect(() => {
        if (!roomId) return
        const fetchRoomData = async () => {
            try {
                const [r, agentsList] = await Promise.all([
                    roomsApi.get(roomId).catch(() => null),
                    agentsApi.list().catch(() => []),
                ])
                if (r) setRoom(r)
                setAllAgents(agentsList)
            } catch (err) {
                console.error('Error fetching room details:', err)
            }
        }
        fetchRoomData()
    }, [roomId])

    useEffect(() => {
        if (!room) return
        const activeIds = room.activeAgents || ['agent_manager', 'agent_ml', 'agent_analyst', 'agent_search', 'agent_summarizer']
        const matched = activeIds.map((id) => {
            const found = allAgents.find((a) => a.id === id)
            const ownerBinding = room.userAgents?.find((b: any) => b.agentId === id)
            const ownerName = ownerBinding ? ownerBinding.userName : undefined

            if (found) {
                return {
                    ...found,
                    status: (agentStatuses[id]?.status || found.status || 'idle') as any,
                    speech: agentStatuses[id]?.speech || found.speech || null,
                    ownerName,
                }
            }
            return {
                id,
                name: formatAgentName(id),
                color: getAgentDefaultColor(id),
                status: (agentStatuses[id]?.status || 'idle') as any,
                speech: agentStatuses[id]?.speech || null,
                position: [0, 0, 0] as [number, number, number],
                ownerName,
            }
        })
        setRoomAgents(matched)
    }, [room, allAgents, agentStatuses])

    // SỬA LỖI TỰ CUỘN MÀN HÌNH: Chỉ cuộn mượt khi có tin nhắn mới tăng lên và người dùng đang ở gần đáy khung chat
    const prevMsgCountRef = useRef(0)
    useEffect(() => {
        if (messages.length > prevMsgCountRef.current) {
            const container = chatContainerRef.current
            if (container) {
                const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120
                if (isFirstLoad || isNearBottom || prevMsgCountRef.current === 0) {
                    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
                }
            }
        }
        prevMsgCountRef.current = messages.length
        isFirstLoad = false
    }, [messages.length])

    let isFirstLoad = true

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
                targetPos = OFFICE_DESK_SLOTS[idx !== -1 ? idx % OFFICE_DESK_SLOTS.length : 0]
            }
        } else {
            if (action === 'bench') targetPos = OUTDOOR_ACTION_SPOTS.bench1
            else if (action === 'picnic') targetPos = OUTDOOR_ACTION_SPOTS.picnic1
            else if (action === 'gazebo') targetPos = OUTDOOR_ACTION_SPOTS.gazebo
            else if (action === 'fountain') targetPos = OUTDOOR_ACTION_SPOTS.fountain
        }
        setAgentTargetActions((prev) => ({ ...prev, [agentId]: { action, targetPos } }))
    }

    const handleSend = async (e: React.FormEvent, attachment?: any) => {
        e.preventDefault()
        if (!input.trim() && !attachment) return

        const text = input.trim()
        setInput('')
        setMentionPopupOpen(false)

        await sendMessage(text, targetAgentId || undefined)
    }

    const runTeamPipeline = async () => {
        if (pipelineRunning) return
        setPipelineRunning(true)
        const pipelinePrompt = '@agent_manager Hãy kích hoạt workflow phân tích dữ liệu và tóm tắt báo cáo nhóm.'
        await sendMessage(pipelinePrompt, 'agent_manager')
        setTimeout(() => setPipelineRunning(false), 3000)
    }

    // Cập nhật hàm gọi API mới tương thích track agent-agent
    const handleAddAgentToRoom = async (agentId: string) => {
        if (!room) return
        try {
            const updated = await roomsApi.addAgent(roomId, agentId)
            setRoom(updated)
            setAddAgentModalOpen(false)
        } catch (err: any) {
            // Fallback đồng bộ danh sách agent nếu cần
            try {
                const current = room.activeAgents || []
                if (!current.includes(agentId)) {
                    const updatedList = [...current, agentId]
                    const updated = await roomsApi.syncAgents(roomId, updatedList)
                    setRoom(updated)
                }
                setAddAgentModalOpen(false)
            } catch (fallbackErr: any) {
                alert(`Lỗi thêm agent: ${fallbackErr.message}`)
            }
        }
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4.5rem)] -mx-4 -my-6">
            <RoomTopNav
                roomId={roomId}
                room={room}
                connected={connected}
                onlineUsers={onlineUsers}
                latestTraces={latestTraces}
                activeTrace={activeTrace}
                setActiveTrace={setActiveTrace}
                setTraceModalOpen={setTraceModalOpen}
                setAssignmentModalOpen={setAssignmentModalOpen}
                setAddAgentModalOpen={setAddAgentModalOpen}
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

            {/* Main Workspace Body */}
            <div className="flex-1 flex overflow-hidden relative">
                {(viewMode === '3d' || viewMode === 'split') && (
                    <Workspace3DPanel
                        viewMode={viewMode}
                        mapType={mapType}
                        roomAgents={roomAgents}
                        selected3dAgentId={selected3dAgentId}
                        handleSelectAgent={handleSelectAgent}
                        handleFloorClick={handleFloorClick}
                        agentTargetActions={agentTargetActions}
                        handleTriggerAction={handleTriggerAction}
                    />
                )}

                {(viewMode === 'chat' || viewMode === 'split') && (
                    <div className={`flex flex-col h-full bg-zinc-950 transition-all duration-300 ${viewMode === 'split' ? 'w-full lg:w-1/2' : 'w-full'}`} ref={chatContainerRef}>
                        <TeamChatPanel
                            messages={messages}
                            chatLoading={chatLoading}
                            onlineUsers={onlineUsers}
                            roomAgents={roomAgents}
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
                        />
                    </div>
                )}
            </div>

            <ModalsContainer
                roomId={roomId}
                room={room}
                allAgents={allAgents}
                onlineUsers={onlineUsers}
                addAgentModalOpen={addAgentModalOpen}
                setAddAgentModalOpen={setAddAgentModalOpen}
                handleAddAgentToRoom={handleAddAgentToRoom}
                traceModalOpen={traceModalOpen}
                setTraceModalOpen={setTraceModalOpen}
                activeTrace={activeTrace}
                latestTraces={latestTraces}
                setActiveTrace={setActiveTrace}
                assignmentModalOpen={assignmentModalOpen}
                setAssignmentModalOpen={setAssignmentModalOpen}
                setRoom={setRoom}
            />
        </div>
    )
}

function formatAgentName(id: string): string {
    const map: Record<string, string> = {
        agent_manager: 'Manager Agent',
        agent_ml: 'ML Expert',
        agent_analyst: 'Data Analyst',
        agent_search: 'Search Expert',
        agent_summarizer: 'Summarizer Agent',
    }
    return map[id] || id
}

function getAgentDefaultColor(id: string): string {
    const map: Record<string, string> = {
        agent_manager: '#3182ce',
        agent_ml: '#38a169',
        agent_analyst: '#d69e2e',
        agent_search: '#805ad5',
        agent_summarizer: '#e53e3e',
    }
    return map[id] || '#4a5568'
}