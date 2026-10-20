'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Scene, { MapType } from '@/components/Scene'
import { AgentAction } from '@/components/agents/Agent'
import { OFFICE_ACTION_SPOTS, OFFICE_DESK_SLOTS } from '@/components/office/Room'
import { OUTDOOR_ACTION_SPOTS } from '@/components/outdoor/OutdoorPark'
import { useRoomCollaboration } from '@/hooks/useRoomCollaboration'
import { roomsApi, agentsApi, Room, Agent, ChatMessage, WorkflowTrace } from '@/lib/api'
import WorkflowTraceModal from '@/components/ui/WorkflowTraceModal'
import UserAgentAssignmentModal from '@/components/ui/UserAgentAssignmentModal'
import {
    IconTrace,
    IconZap,
    IconUsers,
    IconUser,
    IconBot,
    IconBuilding,
    IconTrees,
    IconLaptop,
    IconArmchair,
    IconCoffee,
    IconActivity,
    IconCompass,
    IconSparkles,
    IconSearch,
    IconBarChart,
    IconFileText,
    IconSend,
    IconAlertCircle,
    IconCheckCircle,
    IconPlus,
    IconX,
    IconArrowLeft,
    IconMessageSquare,
    IconLayers,
    IconTerminal,
    IconTent,
    IconDroplets,
    IconGameController,
} from '@/components/ui/icons'

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

    // Hook realtime SSE & presence & LangSmith traces
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

    // 1. Tải thông tin phòng và danh sách Agent
    useEffect(() => {
        if (!roomId) return

        const fetchRoomData = async () => {
            try {
                const [r, agentsList] = await Promise.all([
                    roomsApi.get(roomId).catch(() => null),
                    agentsApi.list().catch(() => []),
                ])

                if (r) {
                    setRoom(r)
                } else {
                    // Fallback nếu phòng chưa có trên DB
                    setRoom({
                        id: roomId,
                        name: `Phòng #${roomId}`,
                        description: 'Phòng làm việc nhóm đa agent',
                        maxCapacity: 20,
                        activeAgents: ['agent_manager', 'agent_ml', 'agent_analyst', 'agent_search', 'agent_summarizer'],
                        settings: { allowCrossCommands: true, autonomousHandoff: true, maxAutoTurns: 3 },
                        members: [],
                    })
                }

                setAllAgents(agentsList)
            } catch (err) {
                console.error('Error fetching room details:', err)
            }
        }

        fetchRoomData()
    }, [roomId])

    // 2. Tính toán danh sách Agent hiện diện trong phòng
    useEffect(() => {
        if (!room) return

        const activeIds = room.activeAgents || [
            'agent_manager',
            'agent_ml',
            'agent_analyst',
            'agent_search',
            'agent_summarizer',
        ]

        const matched = activeIds.map((id) => {
            const found = allAgents.find((a) => a.id === id)
            const ownerBinding = room.userAgents?.find((b) => b.agentId === id)
            const ownerName = ownerBinding ? ownerBinding.userName : undefined

            if (found) {
                // Kết hợp trạng thái realtime từ hook
                const liveStatus = agentStatuses[id]?.status || found.status || 'idle'
                const liveSpeech = agentStatuses[id]?.speech || found.speech || null
                return {
                    ...found,
                    status: liveStatus as any,
                    speech: liveSpeech,
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

    // Tự động cuộn xuống tin nhắn mới nhất chỉ khi có tin nhắn mới
    const prevMsgCountRef = useRef(0)
    useEffect(() => {
        if (messages.length > prevMsgCountRef.current) {
            const isFirst = prevMsgCountRef.current === 0
            chatEndRef.current?.scrollIntoView({ behavior: isFirst ? 'auto' : 'smooth' })
        }
        prevMsgCountRef.current = messages.length
    }, [messages.length])

    // 3. Tương tác & điều khiển Agent di chuyển
    const handleSelectAgent = (agentId: string) => {
        setSelected3dAgentId(agentId)
        setTargetAgentId(agentId)
    }

    const handleFloorClick = (point: [number, number, number]) => {
        if (!selected3dAgentId) return
        setAgentTargetActions((prev) => ({
            ...prev,
            [selected3dAgentId]: {
                action: 'custom',
                targetPos: point,
            },
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
            } else if (action === 'roam') {
                targetPos = [0, 0, 0]
            }
        } else {
            // Outdoor map
            if (action === 'bench' || action === 'sofa') targetPos = OUTDOOR_ACTION_SPOTS.bench1
            else if (action === 'picnic' || action === 'desk') targetPos = OUTDOOR_ACTION_SPOTS.picnic1
            else if (action === 'gazebo' || action === 'roundtable') targetPos = OUTDOOR_ACTION_SPOTS.gazebo
            else if (action === 'fountain' || action === 'pingpong') targetPos = OUTDOOR_ACTION_SPOTS.fountain
            else if (action === 'coffee') targetPos = OUTDOOR_ACTION_SPOTS.coffee
            else if (action === 'roam') targetPos = [0, 0, 0]
        }

        setAgentTargetActions((prev) => ({
            ...prev,
            [agentId]: {
                action,
                targetPos,
            },
        }))
    }

    // Xử lý gửi tin nhắn
    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim()) return

        const text = input.trim()
        setInput('')
        setMentionPopupOpen(false)

        await sendMessage(text, targetAgentId || undefined)
    }

    // Xử lý khi user gõ phím để bắt @mention
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setInput(val)

        // Kiểm tra xem ký tự cuối có phải là @ hoặc đang gõ mention không
        const words = val.split(' ')
        const lastWord = words[words.length - 1]
        if (lastWord.startsWith('@')) {
            setMentionPopupOpen(true)
        } else {
            setMentionPopupOpen(false)
        }
    }

    const selectMention = (agentId: string) => {
        const words = input.split(' ')
        words[words.length - 1] = `@${agentId} `
        setInput(words.join(' '))
        setTargetAgentId(agentId)
        setMentionPopupOpen(false)
    }

    // Chạy Team Pipeline mẫu (Multi-agent team workflow)
    const runTeamPipeline = async () => {
        if (pipelineRunning) return
        setPipelineRunning(true)

        const pipelinePrompt =
            '@agent_manager Hãy kích hoạt quy trình làm việc nhóm cho nhiệm vụ: "Nghiên cứu thị trường AI Agents 2026, tính toán phân bổ tài nguyên hệ thống, và tóm tắt báo cáo điều hành". Hãy phân công bước 1 cho @agent_search và bước 2 cho @agent_ml.'

        await sendMessage(pipelinePrompt, 'agent_manager')
        setTimeout(() => setPipelineRunning(false), 3000)
    }

    // Thêm Agent vào phòng
    const handleAddAgentToRoom = async (agentId: string) => {
        if (!room) return
        try {
            const updated = await roomsApi.addAgent(roomId, agentId)
            setRoom(updated)
            setAddAgentModalOpen(false)
        } catch (err: any) {
            try {
                const current = room.activeAgents || []
                if (!current.includes(agentId)) {
                    const updatedList = [...current, agentId]
                    await roomsApi.syncAgents(roomId, updatedList)
                    setRoom({ ...room, activeAgents: updatedList })
                }
                setAddAgentModalOpen(false)
            } catch (fallbackErr: any) {
                alert(`Lỗi thêm agent: ${fallbackErr.message}`)
            }
        }
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4.5rem)] -mx-4 -my-6">
            {/* Top Navigation & Status Bar */}
            <div className="h-14 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur px-4 flex items-center justify-between gap-4 shrink-0 z-20">
                <div className="flex items-center gap-3">
                    <Link
                        href="/rooms"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition text-sm flex items-center gap-1.5"
                        title="Về danh sách phòng"
                    >
                        <IconArrowLeft className="w-4 h-4" />
                        <span className="hidden sm:inline font-medium">Rooms</span>
                    </Link>
                    <div className="h-5 w-px bg-zinc-800" />
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="font-bold text-white text-sm sm:text-base tracking-tight truncate max-w-xs sm:max-w-md">
                                {room?.name || `Phòng #${roomId}`}
                            </h1>
                            <span
                                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                    connected
                                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                }`}
                            >
                                <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                        connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                                    }`}
                                />
                                {connected ? 'Live Sync' : 'Connecting...'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right controls: Online Users, LangSmith Traces, User-Agent Assignment, Add Agent, Map & View Mode */}
                <div className="flex items-center gap-2 sm:gap-2.5">
                    {/* Online Users Pill */}
                    <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300">
                        <IconUsers className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="text-zinc-500 font-medium">Online ({onlineUsers.length}):</span>
                        <div className="flex items-center -space-x-1.5">
                            {onlineUsers.slice(0, 4).map((u, i) => (
                                <div
                                    key={i}
                                    title={u.userName}
                                    className="w-5 h-5 rounded-full bg-blue-600 border border-zinc-900 text-[10px] flex items-center justify-center font-bold text-white shadow"
                                >
                                    {u.userName.charAt(0).toUpperCase()}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* LangSmith Workflow Execution Trace Button */}
                    <button
                        onClick={() => {
                            if (!activeTrace && Object.keys(latestTraces).length > 0) {
                                setActiveTrace(Object.values(latestTraces)[0])
                            }
                            setTraceModalOpen(true)
                        }}
                        className={`text-xs px-2.5 py-1.5 rounded-xl border transition font-medium flex items-center gap-1.5 shadow-sm ${
                            Object.values(latestTraces).some((t) => t.status === 'error')
                                ? 'bg-rose-950/40 border-rose-500/50 text-rose-300 hover:bg-rose-900/50 animate-pulse'
                                : 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300 hover:bg-indigo-900/50'
                        }`}
                        title="Kiểm tra luồng thực thi Workflow (LangSmith Inspector)"
                    >
                        <IconTrace className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Traces</span>
                        {Object.values(latestTraces).some((t) => t.status === 'error') && (
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                        )}
                    </button>

                    {/* Button Phân Bổ Agent cho từng User */}
                    <button
                        onClick={() => setAssignmentModalOpen(true)}
                        className="text-xs px-2.5 py-1.5 rounded-xl border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 transition font-medium flex items-center gap-1.5"
                        title="Phân bổ Agent cho từng thành viên trong phòng"
                    >
                        <IconUsers className="w-3.5 h-3.5 text-blue-400" />
                        <span className="hidden sm:inline">Phân Bổ Agent</span>
                    </button>

                    {/* Button thêm Agent */}
                    <button
                        onClick={() => setAddAgentModalOpen(true)}
                        className="text-xs px-2.5 py-1.5 rounded-xl border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 transition font-medium flex items-center gap-1"
                    >
                        <IconPlus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Agent</span>
                    </button>

                    {/* Map Switcher (Office vs Outdoor) */}
                    <div className="flex items-center p-0.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
                        <button
                            onClick={() => setMapType('office')}
                            className={`px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1.5 ${
                                mapType === 'office' ? 'bg-blue-600 text-white shadow' : 'text-zinc-400 hover:text-white'
                            }`}
                            title="Văn phòng 3D hiện đại"
                        >
                            <IconBuilding className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Office</span>
                        </button>
                        <button
                            onClick={() => setMapType('outdoor')}
                            className={`px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1.5 ${
                                mapType === 'outdoor' ? 'bg-emerald-600 text-white shadow' : 'text-zinc-400 hover:text-white'
                            }`}
                            title="Khuôn viên ngoài trời sinh thái"
                        >
                            <IconTrees className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Outdoor</span>
                        </button>
                    </div>

                    {/* View Mode Switcher */}
                    <div className="flex items-center p-0.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
                        <button
                            onClick={() => setViewMode('split')}
                            className={`px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1 ${
                                viewMode === 'split' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                            <IconLayers className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Split</span>
                        </button>
                        <button
                            onClick={() => setViewMode('3d')}
                            className={`px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1 ${
                                viewMode === '3d' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                            <IconBuilding className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">3D</span>
                        </button>
                        <button
                            onClick={() => setViewMode('chat')}
                            className={`px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1 ${
                                viewMode === 'chat' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                            <IconMessageSquare className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Chat</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Active Agent Team Strip */}
            <div className="h-11 border-b border-zinc-800/80 bg-zinc-950/80 px-4 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none z-10">
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-bold shrink-0 flex items-center gap-1">
                    <IconBot className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Nhóm Agent:</span>
                </span>
                {roomAgents.map((ag) => {
                    const status = ag.status || 'idle'
                    const isSelected = selected3dAgentId === ag.id

                    return (
                        <button
                            key={ag.id}
                            onClick={() => {
                                handleSelectAgent(ag.id)
                                if (!isSelected) {
                                    setInput((prev) => (prev.startsWith(`@${ag.id}`) ? prev : `@${ag.id} `))
                                }
                            }}
                            className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                                isSelected
                                    ? 'bg-blue-600/20 border-blue-500 text-blue-300 ring-1 ring-blue-500/50'
                                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                            }`}
                        >
                            <span
                                className={`w-2 h-2 rounded-full ${
                                    status === 'working' || status === 'thinking'
                                        ? 'bg-amber-400 animate-ping'
                                        : status === 'speaking'
                                        ? 'bg-purple-400 animate-pulse'
                                        : 'bg-emerald-400'
                                }`}
                            />
                            <span>{ag.name}</span>
                            {ag.ownerName && (
                                <span className="text-[10px] text-blue-400 bg-blue-950/60 border border-blue-500/30 px-1 rounded flex items-center gap-0.5">
                                    <IconUser className="w-2.5 h-2.5" />
                                    <span>{ag.ownerName}</span>
                                </span>
                            )}
                            <span className="text-[10px] text-zinc-500 font-normal">
                                ({status})
                            </span>
                        </button>
                    )
                })}
            </div>

            {/* Main Workspace Body */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* 3D Office Workspace Panel */}
                {(viewMode === '3d' || viewMode === 'split') && (
                    <div
                        className={`relative h-full transition-all duration-300 ${
                            viewMode === 'split' ? 'w-full lg:w-1/2 border-r border-zinc-800' : 'w-full'
                        }`}
                    >
                        <Scene
                            agents={roomAgents}
                            mapType={mapType}
                            selectedAgentId={selected3dAgentId}
                            onSelectAgent={handleSelectAgent}
                            onFloorClick={handleFloorClick}
                            agentTargetActions={agentTargetActions}
                        />

                        {/* Floating 3D overlay badge */}
                        <div className="absolute top-3 left-3 z-10 pointer-events-none flex flex-col gap-1.5">
                            <div className="bg-black/80 backdrop-blur text-[11px] text-zinc-300 px-3 py-1.5 rounded-xl border border-zinc-800 shadow-xl flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${mapType === 'outdoor' ? 'bg-emerald-400' : 'bg-blue-400'} animate-pulse`} />
                                {mapType === 'office' ? (
                                    <span className="flex items-center gap-1">
                                        <IconBuilding className="w-3.5 h-3.5 text-blue-400" />
                                        <span>Không gian Văn Phòng Ảo</span>
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1">
                                        <IconTrees className="w-3.5 h-3.5 text-emerald-400" />
                                        <span>Khuôn Viên Ngoài Trời Sinh Thái</span>
                                    </span>
                                )}
                                <span className="text-zinc-500">·</span>
                                <span className="text-blue-400 font-medium">{roomAgents.length} Agents</span>
                            </div>
                        </div>

                        {/* Interactive Agent Movement & Control HUD */}
                        <div className="absolute bottom-3 left-3 right-3 z-20 pointer-events-auto">
                            <div className="bg-zinc-900/95 backdrop-blur-md border border-zinc-700/80 rounded-2xl p-3 shadow-2xl space-y-2.5 max-w-xl mx-auto">
                                <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-3.5 h-3.5 rounded-full ring-2 ring-white/20"
                                            style={{ backgroundColor: roomAgents.find(a => a.id === selected3dAgentId)?.color || '#3b82f6' }}
                                        />
                                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                            <span>{roomAgents.find(a => a.id === selected3dAgentId)?.name || 'Chưa chọn Agent'}</span>
                                            <span className="text-[10px] text-zinc-400 font-mono font-normal">
                                                (@{selected3dAgentId})
                                            </span>
                                            {roomAgents.find(a => a.id === selected3dAgentId)?.ownerName && (
                                                <span className="text-[10px] text-blue-300 bg-blue-900/40 border border-blue-500/30 px-1.5 rounded-full flex items-center gap-0.5">
                                                    <IconUser className="w-2.5 h-2.5" />
                                                    <span>{roomAgents.find(a => a.id === selected3dAgentId)?.ownerName}</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-mono flex items-center gap-1.5">
                                        <IconGameController className="w-3 h-3" />
                                        <span>WASD / Mũi Tên lái Agent</span>
                                    </div>
                                </div>

                                {/* Movement Action Buttons */}
                                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
                                    <span className="text-[10px] uppercase font-bold text-zinc-500 shrink-0">Hành động:</span>

                                    {mapType === 'office' ? (
                                        <>
                                            <button
                                                onClick={() => handleTriggerAction(selected3dAgentId, 'desk')}
                                                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 font-medium transition active:scale-95"
                                            >
                                                <IconLaptop className="w-3.5 h-3.5" />
                                                <span>Bàn làm việc</span>
                                            </button>
                                            <button
                                                onClick={() => handleTriggerAction(selected3dAgentId, 'sofa')}
                                                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 font-medium transition active:scale-95"
                                            >
                                                <IconArmchair className="w-3.5 h-3.5" />
                                                <span>Ngồi Sofa</span>
                                            </button>
                                            <button
                                                onClick={() => handleTriggerAction(selected3dAgentId, 'roundtable')}
                                                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 font-medium transition active:scale-95"
                                            >
                                                <IconUsers className="w-3.5 h-3.5" />
                                                <span>Họp Bàn Tròn</span>
                                            </button>
                                            <button
                                                onClick={() => handleTriggerAction(selected3dAgentId, 'pingpong')}
                                                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 font-medium transition active:scale-95"
                                            >
                                                <IconActivity className="w-3.5 h-3.5" />
                                                <span>Chơi Bóng Bàn</span>
                                            </button>
                                            <button
                                                onClick={() => handleTriggerAction(selected3dAgentId, 'coffee')}
                                                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-medium transition active:scale-95"
                                            >
                                                <IconCoffee className="w-3.5 h-3.5" />
                                                <span>Quầy Cà Phê</span>
                                            </button>
                                            <button
                                                onClick={() => handleTriggerAction(selected3dAgentId, 'roam')}
                                                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-medium transition active:scale-95"
                                            >
                                                <IconCompass className="w-3.5 h-3.5" />
                                                <span>Đi dạo tự do</span>
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleTriggerAction(selected3dAgentId, 'picnic')}
                                                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 font-medium transition active:scale-95"
                                            >
                                                <IconLaptop className="w-3.5 h-3.5" />
                                                <span>Bàn Dã Ngoại</span>
                                            </button>
                                            <button
                                                onClick={() => handleTriggerAction(selected3dAgentId, 'bench')}
                                                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 font-medium transition active:scale-95"
                                            >
                                                <IconArmchair className="w-3.5 h-3.5" />
                                                <span>Ghế Công Viên</span>
                                            </button>
                                            <button
                                                onClick={() => handleTriggerAction(selected3dAgentId, 'gazebo')}
                                                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 font-medium transition active:scale-95"
                                            >
                                                <IconTent className="w-3.5 h-3.5" />
                                                <span>Chòi Họp Gazebo</span>
                                            </button>
                                            <button
                                                onClick={() => handleTriggerAction(selected3dAgentId, 'fountain')}
                                                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/30 text-sky-300 font-medium transition active:scale-95"
                                            >
                                                <IconDroplets className="w-3.5 h-3.5" />
                                                <span>Đài Phun Nước</span>
                                            </button>
                                            <button
                                                onClick={() => handleTriggerAction(selected3dAgentId, 'coffee')}
                                                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-medium transition active:scale-95"
                                            >
                                                <IconCoffee className="w-3.5 h-3.5" />
                                                <span>Quầy Kiosk</span>
                                            </button>
                                            <button
                                                onClick={() => handleTriggerAction(selected3dAgentId, 'roam')}
                                                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-medium transition active:scale-95"
                                            >
                                                <IconCompass className="w-3.5 h-3.5" />
                                                <span>Dạo quanh vườn</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Collaborative Team Chat & Commander Panel */}
                {(viewMode === 'chat' || viewMode === 'split') && (
                    <div
                        className={`flex flex-col h-full bg-zinc-950 transition-all duration-300 ${
                            viewMode === 'split' ? 'w-full lg:w-1/2' : 'w-full'
                        }`}
                    >
                        {/* Quick Presets / Actions Bar */}
                        <div className="p-3 border-b border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between gap-2 shrink-0">
                            <div className="flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-none">
                                <span className="text-[11px] text-zinc-500 font-medium shrink-0 flex items-center gap-1">
                                    <IconZap className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Giao việc nhanh:</span>
                                </span>
                                <button
                                    onClick={runTeamPipeline}
                                    disabled={pipelineRunning}
                                    className="shrink-0 px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 font-medium transition active:scale-95 flex items-center gap-1.5"
                                >
                                    <IconSparkles className="w-3.5 h-3.5" />
                                    <span>Chạy Team Pipeline</span>
                                </button>
                                <button
                                    onClick={() => setInput('@agent_search Hãy tra cứu xu hướng AI Agents mới nhất năm 2026')}
                                    className="shrink-0 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition flex items-center gap-1.5"
                                >
                                    <IconSearch className="w-3.5 h-3.5 text-zinc-400" />
                                    <span>Tra cứu web</span>
                                </button>
                                <button
                                    onClick={() => setInput('@agent_analyst Hãy phân tích số liệu tài nguyên máy chủ và đề xuất cấu hình')}
                                    className="shrink-0 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition flex items-center gap-1.5"
                                >
                                    <IconBarChart className="w-3.5 h-3.5 text-zinc-400" />
                                    <span>Phân tích số liệu</span>
                                </button>
                                <button
                                    onClick={() => setInput('@agent_summarizer Hãy tóm tắt lại toàn bộ thảo luận của phòng từ nãy đến giờ')}
                                    className="shrink-0 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition flex items-center gap-1.5"
                                >
                                    <IconFileText className="w-3.5 h-3.5 text-zinc-400" />
                                    <span>Tóm tắt ngữ cảnh</span>
                                </button>
                            </div>
                        </div>

                        {/* Chat Messages Feed */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {chatLoading ? (
                                <div className="text-center py-12 text-zinc-500 text-xs">
                                    Đang đồng bộ tin nhắn phòng...
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="text-center py-12 space-y-2">
                                    <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 mx-auto flex items-center justify-center text-zinc-400">
                                        <IconMessageSquare className="w-6 h-6" />
                                    </div>
                                    <p className="text-zinc-400 text-xs font-medium">Chưa có tin nhắn trong phòng.</p>
                                    <p className="text-zinc-500 text-[11px] max-w-sm mx-auto">
                                        Hãy gửi tin nhắn hoặc gắn tag <span className="text-blue-400">@agent_id</span> để bắt đầu làm việc nhóm!
                                    </p>
                                </div>
                            ) : (
                                messages.map((m, idx) => {
                                    const isAgent = m.senderType === 'agent'
                                    const isSystem = m.senderType === 'system'
                                    const usedTools = m.metadata?.usedTools || []
                                    const hasTrace = !!m.metadata?.workflowTrace

                                    if (isSystem) {
                                        return (
                                            <div key={m._id || m.id || idx} className="text-center my-2">
                                                <span className="text-[11px] text-zinc-500 bg-zinc-900/60 border border-zinc-800/80 px-3 py-1 rounded-full">
                                                    {m.message}
                                                </span>
                                            </div>
                                        )
                                    }

                                    const isDirectAgentCommand = isAgent ? false : (m.message.includes('@agent_') || m.message.includes('@all') || m.message.includes('@team') || !!(m as any).targetAgentId)
                                    const agentOwner = isAgent ? room?.userAgents?.find((b) => b.agentId === m.senderId) : null

                                    return (
                                        <div
                                            key={m._id || m.id || idx}
                                            className={`flex flex-col space-y-1.5 ${
                                                isAgent ? 'items-start' : 'items-end'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 text-xs text-zinc-400">
                                                <span className={`font-semibold flex items-center gap-1 ${isAgent ? 'text-blue-400' : 'text-zinc-200'}`}>
                                                    {isAgent ? <IconBot className="w-3.5 h-3.5 text-blue-400" /> : <IconUser className="w-3.5 h-3.5 text-zinc-300" />}
                                                    <span>{m.senderName}</span>
                                                </span>

                                                {/* Agent Owner Tag if bound to a user */}
                                                {agentOwner && (
                                                    <span className="text-[10px] text-blue-400 bg-blue-950/60 border border-blue-500/30 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                                                        <IconUser className="w-2.5 h-2.5" />
                                                        <span>của {agentOwner.userName}</span>
                                                    </span>
                                                )}

                                                <span className="text-[10px] text-zinc-500">
                                                    {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                </span>

                                                {/* Badge phân loại kênh giao tiếp */}
                                                {isAgent && m.metadata?.depth && m.metadata.depth > 0 ? (
                                                    <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                                                        <IconSparkles className="w-2.5 h-2.5 text-purple-400" />
                                                        <span>Agent Handoff #{m.metadata.depth}</span>
                                                    </span>
                                                ) : isDirectAgentCommand ? (
                                                    <span className="text-[9px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                                                        <IconBot className="w-2.5 h-2.5 text-amber-400" />
                                                        <span>Ra lệnh Agent</span>
                                                    </span>
                                                ) : !isAgent ? (
                                                    <span className="text-[9px] bg-zinc-800 text-zinc-400 border border-zinc-700 px-1.5 py-0.2 rounded-full">
                                                        User Chat
                                                    </span>
                                                ) : null}
                                            </div>

                                            <div
                                                className={`rounded-2xl p-3.5 max-w-[88%] text-sm leading-relaxed border ${
                                                    isAgent
                                                        ? 'bg-zinc-900/90 text-zinc-200 border-zinc-800 shadow-md'
                                                        : 'bg-blue-600 text-white border-blue-500 shadow-md'
                                                }`}
                                            >
                                                <div className="whitespace-pre-wrap">{m.message}</div>

                                                {/* Tool Calls Execution Badge */}
                                                {usedTools && usedTools.length > 0 && (
                                                    <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex flex-wrap items-center gap-1.5">
                                                        <span className="text-[10px] uppercase font-bold text-zinc-400">
                                                             Tool đã gọi:
                                                        </span>
                                                        {usedTools.map((t: string, ti: number) => (
                                                            <span
                                                                key={ti}
                                                                className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-950 border border-zinc-700/80 text-amber-300 flex items-center gap-1"
                                                            >
                                                                <IconZap className="w-3 h-3 text-amber-400" />
                                                                <span>{t}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* LangSmith Visual Trace Trigger Button */}
                                                {isAgent && hasTrace && (
                                                    <div className="mt-2.5 pt-2 border-t border-zinc-800/80">
                                                        <button
                                                            onClick={() => {
                                                                setActiveTrace(m.metadata!.workflowTrace!)
                                                                setTraceModalOpen(true)
                                                            }}
                                                            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition font-medium"
                                                        >
                                                            <IconTrace className="w-3.5 h-3.5" />
                                                            <span>Xem Workflow Trace (LangSmith)</span>
                                                            {m.metadata?.workflowTrace?.status === 'error' && (
                                                                <span className="text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-1.5 py-0.5 rounded font-bold">
                                                                    LỖI TẠI NODE
                                                                </span>
                                                            )}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Commander Prompt Bar */}
                        <div className="p-3 border-t border-zinc-800 bg-zinc-900/90 backdrop-blur relative space-y-2">
                            {/* Target Audience Quick Selector */}
                            <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 scrollbar-none">
                                <span className="text-[11px] text-zinc-500 font-medium shrink-0 flex items-center gap-1">
                                    <span>Giao tiếp với:</span>
                                </span>

                                {/* Option 1: Toàn phòng (User chat với User) */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTargetAgentId('')
                                        setInput((prev) => prev.replace(/^@[a-zA-Z0-9_-]+\s*/, ''))
                                    }}
                                    className={`shrink-0 px-2 py-0.5 rounded-lg text-xs font-medium border transition flex items-center gap-1 ${
                                        !targetAgentId
                                            ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                                    }`}
                                >
                                    <IconUsers className="w-3 h-3" />
                                    <span>Toàn phòng (User & Agent)</span>
                                </button>

                                {/* Option 2: Chọn Agent cụ thể */}
                                {roomAgents.map((ag) => {
                                    const isTarget = targetAgentId === ag.id
                                    return (
                                        <button
                                            key={ag.id}
                                            type="button"
                                            onClick={() => {
                                                setTargetAgentId(ag.id)
                                                setInput((prev) => {
                                                    const clean = prev.replace(/^@[a-zA-Z0-9_-]+\s*/, '')
                                                    return `@${ag.id} ${clean}`
                                                })
                                            }}
                                            className={`shrink-0 px-2 py-0.5 rounded-lg text-xs font-medium border transition flex items-center gap-1 ${
                                                isTarget
                                                    ? 'bg-amber-600/30 text-amber-300 border-amber-500 shadow-sm'
                                                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-amber-300'
                                            }`}
                                        >
                                            <IconBot className="w-3 h-3 text-amber-400" />
                                            <span>@{ag.id.replace('agent_', '')}</span>
                                        </button>
                                    )
                                })}

                                {/* Option 3: Mention User */}
                                {onlineUsers.map((u, ui) => (
                                    <button
                                        key={ui}
                                        type="button"
                                        onClick={() => {
                                            setInput((prev) => `${prev} @${u.userName} `)
                                        }}
                                        className="shrink-0 px-2 py-0.5 rounded-lg text-xs font-medium border bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white flex items-center gap-1"
                                        title={`Nhắc tới ${u.userName}`}
                                    >
                                        <IconUser className="w-3 h-3 text-blue-400" />
                                        <span>@{u.userName}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Mention Popup Menu */}
                            {mentionPopupOpen && (
                                <div className="absolute bottom-full left-3 mb-2 w-64 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl p-1 z-30 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold px-2.5 py-1">
                                        Chọn Agent để ra lệnh:
                                    </div>
                                    <div className="space-y-0.5">
                                        <button
                                            type="button"
                                            onClick={() => selectMention('all')}
                                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-400 hover:bg-zinc-800 flex items-center justify-between"
                                        >
                                            <span>@all / @team</span>
                                            <span className="text-[10px] text-zinc-500">Cả nhóm</span>
                                        </button>
                                        {roomAgents.map((ag) => (
                                            <button
                                                key={ag.id}
                                                type="button"
                                                onClick={() => selectMention(ag.id)}
                                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-zinc-200 hover:bg-zinc-800 flex items-center justify-between"
                                            >
                                                <span>@{ag.id}</span>
                                                <span className="text-[10px] text-zinc-500">{ag.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleSend} className="space-y-2">
                                <div className="flex gap-2">
                                    <input
                                        value={input}
                                        onChange={handleInputChange}
                                        placeholder={
                                            targetAgentId
                                                ? `Ra lệnh cho @${targetAgentId}... (Ví dụ: "Hãy phân tích..." hoặc "Phối hợp với @agent_ml")`
                                                : "Nhập tin nhắn trao đổi với phòng, hoặc gõ @ để ra lệnh cho Agent..."
                                        }
                                        className="flex-1 rounded-xl bg-zinc-950 border border-zinc-700/80 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!input.trim()}
                                        className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2.5 shadow transition active:scale-95 flex items-center gap-1.5"
                                    >
                                        <IconSend className="w-4 h-4" />
                                        <span>Gửi</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Thêm Agent vào phòng */}
            {addAgentModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                            <h3 className="text-base font-semibold text-white">Thêm Agent vào Phòng</h3>
                            <button
                                onClick={() => setAddAgentModalOpen(false)}
                                className="text-zinc-400 hover:text-white w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center"
                            >
                                <IconX className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {allAgents.map((ag) => {
                                const inRoom = room?.activeAgents?.includes(ag.id)
                                return (
                                    <div
                                        key={ag.id}
                                        className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800"
                                    >
                                        <div>
                                            <div className="font-medium text-xs text-white">{ag.name}</div>
                                            <div className="text-[10px] text-zinc-500 font-mono">@{ag.id}</div>
                                        </div>
                                        {inRoom ? (
                                            <span className="text-[11px] text-zinc-500">Đã trong phòng</span>
                                        ) : (
                                            <button
                                                onClick={() => handleAddAgentToRoom(ag.id)}
                                                className="text-xs px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition flex items-center gap-1"
                                            >
                                                <IconPlus className="w-3 h-3" />
                                                <span>Thêm</span>
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal LangSmith Workflow Execution Trace */}
            {traceModalOpen && (
                <WorkflowTraceModal
                    trace={activeTrace || Object.values(latestTraces)[0] || null}
                    onClose={() => setTraceModalOpen(false)}
                    allTraces={latestTraces}
                    onSelectTrace={setActiveTrace}
                />
            )}

            {/* Modal Phân Bổ & Thêm Bớt Agent cho từng User */}
            <UserAgentAssignmentModal
                roomId={roomId}
                isOpen={assignmentModalOpen}
                onClose={() => setAssignmentModalOpen(false)}
                allAgents={allAgents}
                activeAgentIds={room?.activeAgents || []}
                userAgents={room?.userAgents || []}
                onlineUsers={onlineUsers}
                onUpdate={(updatedRoom) => {
                    setRoom(updatedRoom)
                }}
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
