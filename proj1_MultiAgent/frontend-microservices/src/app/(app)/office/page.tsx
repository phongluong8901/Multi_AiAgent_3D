'use client'

import { useState, useMemo, useEffect } from 'react'
import Scene from '@/components/Scene'
import { MapType, resolveTargetPositionForAction } from '@/lib/maps/mapRegistry'
import AssignTaskDialog, { PipelineStep } from '@/components/ui/AssignTaskDialog'
import TaskPipelinePanel from '@/components/ui/TaskPipelinePanel'
import { useAgents } from '@/hooks/useAgents'
import { Agent, agentsApi } from '@/lib/api'
import { AgentAction } from '@/components/agents/Agent'
import { AgentTeamStrip } from '@/components/room-detail/AgentTeamStrip'
import NvidiaIsaacHud, { ROBOT_HARDWARE_SPECS } from '@/components/agents/NvidiaIsaacHud'
import AgentConfigModal from '@/components/office/AgentConfigModal'
import OfficeChatPanel, { OfficeMessage } from '@/components/office/OfficeChatPanel'
import OfficeWorkflowModal from '@/components/office/OfficeWorkflowModal'
import { detectAgentDepartment } from '@/components/office/Room'
import {
    IconBuilding,
    IconTrees,
    IconGlobe,
    IconPalette,
    IconPlus,
    IconUsers,
    IconWorkflow,
    IconMessageSquare,
    IconLaptop,
    IconArmchair,
    IconCoffee,
    IconCompass,
    IconUser,
    IconActivity,
    IconDuck,
    IconLayers,
    IconSettings,
} from '@/components/ui/icons'

const MANAGER_ID = 'agent_manager'

const DEFAULT_OFFICE_AGENTS: Agent[] = [
    {
        id: 'agent_manager',
        name: 'Manager Lead',
        color: '#facc15',
        status: 'idle',
        speech: 'Chào mừng bạn đến với Microservice Multi 3D! Tôi phụ trách điều phối và giao việc cho các chuyên gia.',
        position: [-9.5, 0, -8.0],
        model: 'gemini-2.5-flash',
        prompt_id: 'manager',
        form: 'humanoid',
    },
    {
        id: 'agent_search',
        name: 'Search Researcher',
        color: '#38bdf8',
        status: 'idle',
        speech: 'Sẵn sàng thu thập, tra cứu tin tức và trích xuất dữ liệu Internet chuyên sâu.',
        position: [5.5, 0, -8.0],
        model: 'gemini-2.5-flash-lite',
        prompt_id: 'chuyen_gia_tim_kiem',
        form: 'duck',
    },
    {
        id: 'agent_summarizer',
        name: 'Summarizer Pro',
        color: '#e53e3e',
        status: 'idle',
        speech: 'Tôi đúc kết toàn bộ ngữ cảnh thành báo cáo 3 phần súc tích và mạch lạc.',
        position: [9.5, 0, 4.0],
        model: 'gemini-2.5-flash-lite',
        prompt_id: 'chuyen_gia_tom_tat',
        form: 'amr',
    },
    {
        id: 'agent_calculate',
        name: 'Calculator Pro',
        color: '#9333ea',
        status: 'idle',
        speech: 'Chuyên gia xử lý tính toán số học, tài chính và công thức đại số chính xác 100%.',
        position: [1.5, 0, 4.0],
        model: 'gemini-2.5-flash-lite',
        prompt_id: 'chuyen_gia_tinh_toan',
        form: 'humanoid',
    },
    {
        id: 'agent_analyst',
        name: 'Data Analyst',
        color: '#fb923c',
        status: 'idle',
        speech: 'Phân tích thống kê mô tả (mean, median, std, min, max) và phát hiện xu hướng dữ liệu.',
        position: [5.5, 0, 4.0],
        model: 'gemini-2.5-flash',
        prompt_id: 'chuyen_gia_phan_tich',
        form: 'amr',
    },
    {
        id: 'agent_ml',
        name: 'ML Scientist',
        color: '#10b981',
        status: 'idle',
        speech: 'Chuyên gia Machine Learning & AI, đánh giá metrics (Accuracy, F1, MSE) và gợi ý kiến trúc tối ưu.',
        position: [9.5, 0, -8.0],
        model: 'gemini-2.5-flash',
        prompt_id: 'chuyen_gia_ml',
        form: 'humanoid',
    },
    {
        id: 'agent_visualize',
        name: 'Data Visualizer',
        color: '#ec4899',
        status: 'idle',
        speech: 'Chuyên gia trực quan hóa dữ liệu, biến biến động giá cả và số liệu thành biểu đồ trực quan.',
        position: [-1.5, 0, 4.0],
        model: 'gemini-2.5-flash',
        prompt_id: 'chuyen_gia_truc_quan',
        form: 'drone',
    },
]

type OfficeViewMode = '3d' | 'split'

export default function OfficePage() {
    const { agents: fetchedAgents, connected, error } = useAgents()
    const [mapType, setMapType] = useState<MapType>('office')
    const [viewMode, setViewMode] = useState<OfficeViewMode>('split')

    // Danh sách Agent kết hợp từ API hoặc mặc định
    const [localAgents, setLocalAgents] = useState<Agent[]>(DEFAULT_OFFICE_AGENTS)

    useEffect(() => {
        if (fetchedAgents && fetchedAgents.length > 0) {
            setLocalAgents(fetchedAgents)
        }
    }, [fetchedAgents])

    // Lựa chọn Agent & Điều khiển hành động
    const [selectedAgentId, setSelectedAgentId] = useState<string>(MANAGER_ID)
    const [agentTargetActions, setAgentTargetActions] = useState<
        Record<string, { action: AgentAction; targetPos: [number, number, number] }>
    >({})

    // Modals
    const [configModalOpen, setConfigModalOpen] = useState(false)
    const [workflowModalOpen, setWorkflowModalOpen] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)

    // Pipeline Tasks
    const [taskTitle, setTaskTitle] = useState<string | null>(null)
    const [steps, setSteps] = useState<PipelineStep[]>([])
    const [pipelineRunning, setPipelineRunning] = useState(false)

    // Chat
    const [chatInput, setChatInput] = useState('')
    const [targetAgentId, setTargetAgentId] = useState('')
    const [messages, setMessages] = useState<OfficeMessage[]>([
        {
            id: 'msg-init-1',
            senderId: 'system',
            senderName: 'Hệ thống HQ',
            senderType: 'system',
            content: 'Văn phòng 3D Office đã sẵn sàng với 3 phân khu: P. Quản lý, P. Nghiên cứu & P. Phân tích.',
            timestamp: 'Vừa xong',
        },
        {
            id: 'msg-init-2',
            senderId: 'agent_manager',
            senderName: 'Manager Lead',
            senderType: 'agent',
            agentColor: '#facc15',
            content: 'Chào bạn! Tôi đang trực tại Executive Suite. Bạn có thể bấm trực tiếp vào bất kỳ Robot nào trong 3D để xem cấu hình, nhắn tin hoặc kích hoạt workflow.',
            timestamp: 'Vừa xong',
        },
    ])

    const selectedAgent = useMemo(() => {
        return localAgents.find((a) => a.id === selectedAgentId) || localAgents[0] || null
    }, [localAgents, selectedAgentId])

    const manager = localAgents.find((a) => a.id === MANAGER_ID) || localAgents[0]
    const workers = localAgents
        .filter((a) => a.id !== MANAGER_ID)
        .map((a) => ({ id: a.id, name: a.name }))

    // Click chọn Agent trên 3D hoặc trên thanh Fleet
    const handleSelectAgent = (agentId: string) => {
        setSelectedAgentId(agentId)
        setTargetAgentId(agentId)
        setConfigModalOpen(true)
    }

    // Click trên mặt sàn để di chuyển agent
    const handleFloorClick = (point: [number, number, number]) => {
        if (!selectedAgentId) return
        setAgentTargetActions((prev) => ({
            ...prev,
            [selectedAgentId]: { action: 'custom', targetPos: point },
        }))
    }

    // Điều hướng agent tới các phòng ban hoặc vị trí
    const handleTriggerAction = (agentId: string, action: AgentAction) => {
        const idx = localAgents.findIndex((a) => a.id === agentId)
        const targetPos = resolveTargetPositionForAction(mapType, action, idx !== -1 ? idx : 0)
        setAgentTargetActions((prev) => ({
            ...prev,
            [agentId]: { action, targetPos },
        }))
    }

    // Gửi tin nhắn chat và nhận luồng dữ liệu streaming từ Agent
    const handleSendMessage = async (text: string, directTargetId?: string) => {
        const targetId = directTargetId || targetAgentId || selectedAgentId
        const target = localAgents.find((a) => a.id === targetId)

        const userMsg: OfficeMessage = {
            id: `usr-${Date.now()}`,
            senderId: 'user',
            senderName: 'Bạn (Leader)',
            senderType: 'user',
            content: text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }

        setMessages((prev) => [...prev, userMsg])

        if (!target) return

        // Đổi trạng thái Agent 3D thành thinking
        setLocalAgents((prev) =>
            prev.map((a) => (a.id === target.id ? { ...a, status: 'thinking', speech: 'Đang suy nghĩ...' } : a))
        )

        const botMsgId = `bot-${Date.now()}`
        const initialBotMsg: OfficeMessage = {
            id: botMsgId,
            senderId: target.id,
            senderName: target.name,
            senderType: 'agent',
            agentColor: target.color,
            content: '',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isStreaming: true,
            thinkingText: 'Đang khởi động tiến trình tư duy...',
            onRetry: () => handleSendMessage(text, target.id),
        }

        setMessages((prev) => [...prev, initialBotMsg])

        let accumulatedContent = ''

        try {
            const activeIds = localAgents.map((a) => a.id)
            await agentsApi.chatStream(
                target.id,
                text,
                'office',
                (event) => {
                    if (event.event === 'status' || event.event === 'thinking') {
                        const thinkMsg = event.content || event.thought || 'Đang phân tích yêu cầu...'
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === botMsgId
                                    ? { ...m, thinkingText: thinkMsg }
                                    : m
                            )
                        )
                        setLocalAgents((prev) =>
                            prev.map((a) =>
                                a.id === target.id
                                    ? { ...a, status: 'thinking', speech: thinkMsg.slice(0, 45) + '...' }
                                    : a
                            )
                        )
                    } else if (event.event === 'tool_start') {
                        const toolName = event.tool || 'công cụ phụ trợ'
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === botMsgId
                                    ? { ...m, toolExecuting: toolName, thinkingText: `Đang chạy công cụ: ${toolName}...` }
                                    : m
                            )
                        )
                        setLocalAgents((prev) =>
                            prev.map((a) =>
                                a.id === target.id
                                    ? { ...a, status: 'working', speech: `⚙️ Thực thi ${toolName}` }
                                    : a
                            )
                        )
                    } else if (event.event === 'tool_end') {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === botMsgId
                                    ? { ...m, toolExecuting: undefined, thinkingText: 'Đang tổng hợp kết quả công cụ...' }
                                    : m
                            )
                        )
                    } else if (event.event === 'token') {
                        accumulatedContent += (event.content || '')
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === botMsgId
                                    ? { ...m, content: accumulatedContent, thinkingText: undefined }
                                    : m
                            )
                        )
                    } else if (event.event === 'done') {
                        const finalContent = event.content || accumulatedContent
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === botMsgId
                                    ? {
                                        ...m,
                                        content: finalContent || m.content,
                                        isStreaming: false,
                                        thinkingText: undefined,
                                        toolExecuting: undefined,
                                    }
                                    : m
                            )
                        )
                        // Cập nhật speech bubble và status sang speaking
                        setLocalAgents((prev) =>
                            prev.map((a) =>
                                a.id === target.id
                                    ? {
                                        ...a,
                                        status: 'speaking',
                                        speech: (finalContent || 'Hoàn tất nhiệm vụ!').slice(0, 50) + '...',
                                    }
                                    : a
                            )
                        )
                        setTimeout(() => {
                            setLocalAgents((prev) =>
                                prev.map((a) => (a.id === target.id ? { ...a, status: 'idle' } : a))
                            )
                        }, 6000)
                    } else if (event.event === 'error') {
                        const errorMsg = event.error || event.content || 'Đã xảy ra sự cố trong quá trình phản hồi.'
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === botMsgId
                                    ? {
                                        ...m,
                                        isStreaming: false,
                                        isError: true,
                                        errorDetail: errorMsg,
                                        content: m.content || 'Agent gặp lỗi khi đang xử lý tác vụ.',
                                    }
                                    : m
                            )
                        )
                        setLocalAgents((prev) =>
                            prev.map((a) =>
                                a.id === target.id
                                    ? { ...a, status: 'error', speech: '⚠️ Gặp lỗi khi xử lý!' }
                                    : a
                            )
                        )
                        setTimeout(() => {
                            setLocalAgents((prev) =>
                                prev.map((a) => (a.id === target.id ? { ...a, status: 'idle' } : a))
                            )
                        }, 5000)
                    }
                },
                { activeAgents: activeIds }
            )
        } catch (err: unknown) {
            const errString = err instanceof Error ? err.message : String(err)
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === botMsgId
                        ? {
                            ...m,
                            isStreaming: false,
                            isError: true,
                            errorDetail: errString || 'Không thể kết nối với Agent Service',
                            content: m.content || 'Không thể kết nối đến dịch vụ Agent. Vui lòng kiểm tra dịch vụ.',
                        }
                        : m
                )
            )
            setLocalAgents((prev) =>
                prev.map((a) =>
                    a.id === target.id
                        ? { ...a, status: 'error', speech: '⚠️ Mất kết nối Agent Service' }
                        : a
                )
            )
            setTimeout(() => {
                setLocalAgents((prev) =>
                    prev.map((a) => (a.id === target.id ? { ...a, status: 'idle' } : a))
                )
            }, 5000)
        }
    }

    // Chạy Workflow đa tác tử
    const handleTriggerWorkflow = (preset: {
        title: string
        steps: Array<{ agentId: string; agentName: string; task: string }>
    }) => {
        if (pipelineRunning) return
        setPipelineRunning(true)
        setTaskTitle(preset.title)

        const initialSteps: PipelineStep[] = preset.steps.map((st, i) => ({
            id: `st-${i}`,
            agentId: st.agentId,
            agentName: st.agentName,
            text: st.task,
            status: i === 0 ? 'active' : 'pending',
            at: 'Bắt đầu',
        }))

        setSteps(initialSteps)

        const sysMsg: OfficeMessage = {
            id: `wf-start-${Date.now()}`,
            senderId: 'system',
            senderName: 'Workflow Engine',
            senderType: 'system',
            content: `KÍCH HOẠT WORKFLOW: ${preset.title} (${preset.steps.length} bước)`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
        setMessages((prev) => [...prev, sysMsg])

        // Chạy từng bước pipeline mô phỏng thời gian thực
        preset.steps.forEach((st, idx) => {
            const delay = (idx + 1) * 2800

            setTimeout(() => {
                // Di chuyển agent tương ứng vào vị trí phòng ban
                const agentDept = detectAgentDepartment({ id: st.agentId, name: st.agentName } as Agent)
                if (agentDept === 'research') {
                    handleTriggerAction(st.agentId, 'research_lab')
                } else if (agentDept === 'analytics') {
                    handleTriggerAction(st.agentId, 'analytics_dept')
                } else {
                    handleTriggerAction(st.agentId, 'management_office')
                }

                // Cập nhật bước pipeline
                setSteps((prev) =>
                    prev.map((p, i) => {
                        if (i < idx) return { ...p, status: 'done', at: 'Hoàn tất' }
                        if (i === idx) return { ...p, status: 'active', at: 'Đang xử lý...' }
                        return p
                    })
                )

                // Cập nhật trạng thái agent
                setLocalAgents((prev) =>
                    prev.map((a) =>
                        a.id === st.agentId
                            ? {
                                ...a,
                                status: 'working',
                                speech: `Đang thực hiện: ${st.task}`,
                            }
                            : a
                    )
                )

                // Bắn tin nhắn báo cáo bước
                const traceMsg: OfficeMessage = {
                    id: `wf-step-${idx}-${Date.now()}`,
                    senderId: st.agentId,
                    senderName: st.agentName,
                    senderType: 'agent',
                    content: `[Bước ${idx + 1}/${preset.steps.length}] ${st.task} — Hoàn tất xử lý dữ liệu.`,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    isWorkflowTrace: true,
                }
                setMessages((prev) => [...prev, traceMsg])

                // Nếu là bước cuối
                if (idx === preset.steps.length - 1) {
                    setTimeout(() => {
                        setSteps((prev) =>
                            prev.map((p) => ({ ...p, status: 'done', at: 'Xong' }))
                        )
                        setPipelineRunning(false)
                        setLocalAgents((prev) =>
                            prev.map((a) => ({ ...a, status: 'idle', speech: null }))
                        )
                        setMessages((prev) => [
                            ...prev,
                            {
                                id: `wf-done-${Date.now()}`,
                                senderId: 'system',
                                senderName: 'Workflow Engine',
                                senderType: 'system',
                                content: `WORKFLOW HOÀN THÀNH: Tất cả báo cáo đã được lưu trữ và phê duyệt thành công.`,
                                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            },
                        ])
                    }, 2000)
                }
            }, delay)
        })
    }

    return (
        <div className="relative flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-zinc-950 text-white select-none">
            {/* Top Navigation & Status Bar */}
            <div className="h-12 border-b border-zinc-800 bg-zinc-950/90 px-4 flex items-center justify-between gap-3 shrink-0 backdrop-blur z-20">
                {/* Left: HQ Identity */}
                <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#76b900] shadow-[0_0_8px_#76b900]" />
                    <span className="font-bold text-sm tracking-wide text-white">
                        Microservice Multi 3D HQ
                    </span>
                    <span className="hidden md:inline-block text-xs text-zinc-500">
                        · 3 Phân khu (P. Quản lý, P. Nghiên cứu, P. Phân tích)
                    </span>
                </div>

                {/* Center: Map Type Controls */}
                <div className="hidden sm:flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-zinc-800 backdrop-blur">
                    <button
                        type="button"
                        onClick={() => setMapType('office')}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${mapType === 'office' ? 'bg-blue-600 text-white shadow' : 'text-zinc-400 hover:text-white'
                            }`}
                    >
                        <IconBuilding className="w-3.5 h-3.5" />
                        <span>Office</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setMapType('outdoor')}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${mapType === 'outdoor' ? 'bg-emerald-600 text-white shadow' : 'text-zinc-400 hover:text-white'
                            }`}
                    >
                        <IconTrees className="w-3.5 h-3.5" />
                        <span>Outdoor</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setMapType('iot')}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${mapType === 'iot' ? 'bg-cyan-600 text-white shadow' : 'text-zinc-400 hover:text-white'
                            }`}
                    >
                        <IconGlobe className="w-3.5 h-3.5" />
                        <span>Smart City</span>
                    </button>
                    <a
                        href="/maps/setup"
                        className="bg-zinc-800 hover:bg-zinc-700 text-cyan-300 text-xs font-semibold px-2.5 py-1 rounded-lg border border-cyan-500/30 transition flex items-center gap-1"
                    >
                        <IconPalette className="w-3.5 h-3.5" />
                        <span>Vẽ Map 3D</span>
                    </a>
                </div>

                {/* Right: Workflow, Tasks & View Modes */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setWorkflowModalOpen(true)}
                        className="bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-xs font-semibold px-3 py-1.5 rounded-lg shadow transition flex items-center gap-1.5"
                    >
                        <IconWorkflow className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Workflow Đội ngũ</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setDialogOpen(true)}
                        className="bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow transition flex items-center gap-1"
                    >
                        <IconPlus className="w-3.5 h-3.5" />
                        <span>Giao Task</span>
                    </button>

                    <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                        <button
                            type="button"
                            onClick={() => setViewMode('3d')}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition ${viewMode === '3d'
                                    ? 'bg-zinc-800 text-white shadow'
                                    : 'text-zinc-400 hover:text-white'
                                }`}
                        >
                            3D Full
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('split')}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition flex items-center gap-1 ${viewMode === 'split'
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-zinc-400 hover:text-white'
                                }`}
                        >
                            <IconMessageSquare className="w-3 h-3" />
                            <span>3D + Chat</span>
                        </button>
                    </div>

                    <a
                        href="/rooms"
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-zinc-700 transition flex items-center gap-1"
                    >
                        <IconUsers className="w-3.5 h-3.5" />
                        <span>Rooms →</span>
                    </a>
                </div>
            </div>

            {/* Agent Team Fleet Strip */}
            <AgentTeamStrip
                roomAgents={localAgents}
                selected3dAgentId={selectedAgentId}
                handleSelectAgent={handleSelectAgent}
                setInput={setChatInput}
            />

            {/* Main Workspace Body */}
            <div className="relative flex min-h-0 flex-1">
                {/* 3D Scene Area */}
                <div
                    className={
                        viewMode === 'split'
                            ? 'relative min-h-0 w-full lg:w-3/5 xl:w-2/3 h-full overflow-hidden'
                            : 'relative min-h-0 w-full h-full overflow-hidden'
                    }
                >
                    <Scene
                        agents={localAgents}
                        mapType={mapType}
                        selectedAgentId={selectedAgentId}
                        onSelectAgent={handleSelectAgent}
                        onFloorClick={handleFloorClick}
                        agentTargetActions={agentTargetActions}
                    />

                    {/* HUD Telemetry Card & Action Bar (Phía dưới màn hình 3D) */}
                    <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-col gap-2 pointer-events-none">
                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5 overflow-x-auto text-xs pointer-events-auto bg-black/65 backdrop-blur-md p-2 rounded-xl border border-zinc-800/80 shadow-lg scrollbar-none">
                            <span className="shrink-0 text-[10px] font-bold uppercase text-zinc-400 px-1">
                                Điều khiển @{selectedAgent?.id || 'agent'}:
                            </span>
                            <button
                                onClick={() => handleTriggerAction(selectedAgentId, 'management_office')}
                                className="px-2.5 py-1 rounded-lg border border-amber-500/40 bg-amber-600/20 text-amber-200 hover:bg-amber-600/30 transition flex items-center gap-1 text-[11px]"
                            >
                                <IconUser className="h-3 w-3" />
                                <span>P. Quản lý</span>
                            </button>
                            <button
                                onClick={() => handleTriggerAction(selectedAgentId, 'research_lab')}
                                className="px-2.5 py-1 rounded-lg border border-cyan-500/40 bg-cyan-600/20 text-cyan-200 hover:bg-cyan-600/30 transition flex items-center gap-1 text-[11px]"
                            >
                                <IconDuck className="h-3 w-3" />
                                <span>P. Nghiên cứu</span>
                            </button>
                            <button
                                onClick={() => handleTriggerAction(selectedAgentId, 'analytics_dept')}
                                className="px-2.5 py-1 rounded-lg border border-orange-500/40 bg-orange-600/20 text-orange-200 hover:bg-orange-600/30 transition flex items-center gap-1 text-[11px]"
                            >
                                <IconActivity className="h-3 w-3" />
                                <span>P. Phân tích</span>
                            </button>
                            <button
                                onClick={() => handleTriggerAction(selectedAgentId, 'desk')}
                                className="px-2.5 py-1 rounded-lg border border-blue-500/40 bg-blue-600/25 text-blue-200 hover:bg-blue-600/35 transition flex items-center gap-1 text-[11px]"
                            >
                                <IconLaptop className="h-3 w-3" />
                                <span>Bàn làm việc</span>
                            </button>
                            <button
                                onClick={() => handleTriggerAction(selectedAgentId, 'sofa')}
                                className="px-2.5 py-1 rounded-lg border border-purple-500/40 bg-purple-600/25 text-purple-200 hover:bg-purple-600/35 transition flex items-center gap-1 text-[11px]"
                            >
                                <IconArmchair className="h-3 w-3" />
                                <span>Sofa</span>
                            </button>
                            <button
                                onClick={() => handleTriggerAction(selectedAgentId, 'coffee')}
                                className="px-2.5 py-1 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition flex items-center gap-1 text-[11px]"
                            >
                                <IconCoffee className="h-3 w-3" />
                                <span>Cà phê</span>
                            </button>
                            <button
                                onClick={() => handleTriggerAction(selectedAgentId, 'roam')}
                                className="px-2.5 py-1 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition flex items-center gap-1 text-[11px]"
                            >
                                <IconCompass className="h-3 w-3" />
                                <span>Đi dạo</span>
                            </button>

                            <button
                                onClick={() => setConfigModalOpen(true)}
                                className="ml-auto px-2.5 py-1 rounded-lg border border-emerald-500/40 bg-emerald-600/25 text-emerald-200 hover:bg-emerald-600/35 transition flex items-center gap-1 text-[11px] font-semibold"
                            >
                                <IconSettings className="h-3 w-3" />
                                <span>Xem cấu hình Robot</span>
                            </button>
                        </div>

                        {/* Telemetry card */}
                        <div className="pointer-events-auto">
                            <NvidiaIsaacHud
                                agentForm={selectedAgent?.form || 'humanoid'}
                                agentName={selectedAgent?.name}
                                agentId={selectedAgent?.id}
                                color={selectedAgent?.color}
                            />
                        </div>
                    </div>

                    {/* Task Pipeline Visualizer (Hiển thị góc trên bên trái 3D khi có task) */}
                    <TaskPipelinePanel taskTitle={taskTitle} steps={steps} />
                </div>

                {/* Chat Panel (Split Screen hoặc Drawer) */}
                {viewMode === 'split' && (
                    <div className="flex min-h-0 w-full lg:w-2/5 xl:w-1/3 flex-col overflow-hidden bg-zinc-950 border-l border-zinc-800 z-10">
                        <OfficeChatPanel
                            agents={localAgents}
                            messages={messages}
                            input={chatInput}
                            setInput={setChatInput}
                            targetAgentId={targetAgentId}
                            setTargetAgentId={setTargetAgentId}
                            onSendMessage={handleSendMessage}
                            onRunWorkflowPreset={() => setWorkflowModalOpen(true)}
                        />
                    </div>
                )}
            </div>

            {/* 1. Modal Xem & Điều chỉnh cấu hình Agent */}
            <AgentConfigModal
                open={configModalOpen}
                onClose={() => setConfigModalOpen(false)}
                agent={selectedAgent}
                onTriggerAction={handleTriggerAction}
                onOpenChatWithAgent={(id) => {
                    setTargetAgentId(id)
                    setViewMode('split')
                }}
                onOpenWorkflowWithAgent={() => {
                    setWorkflowModalOpen(true)
                }}
            />

            {/* 2. Modal Điều phối Workflow Đa Tác tử */}
            <OfficeWorkflowModal
                open={workflowModalOpen}
                onClose={() => setWorkflowModalOpen(false)}
                agents={localAgents}
                onTriggerWorkflow={handleTriggerWorkflow}
                isRunning={pipelineRunning}
            />

            {/* 3. Dialog Giao Task Tuỳ biến */}
            <AssignTaskDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                managerId={MANAGER_ID}
                managerName={manager?.name ?? 'Manager Agent'}
                workers={workers}
                useMock={true}
                onPipelineUpdate={(next, title) => {
                    setSteps(next)
                    setTaskTitle(title)
                }}
            />
        </div>
    )
}