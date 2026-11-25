'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import Scene, { TimeOfDay } from '@/components/Scene'
import { MapType, resolveTargetPositionForAction } from '@/lib/maps/mapRegistry'
import AssignTaskDialog, { PipelineStep } from '@/components/ui/AssignTaskDialog'
import TaskPipelinePanel from '@/components/ui/TaskPipelinePanel'
import { useAgents } from '@/hooks/useAgents'
import { Agent, agentsApi } from '@/lib/api'
import { AgentAction } from '@/components/agents/Agent'
import { AgentTeamStrip } from '@/components/room-detail/AgentTeamStrip'
import NvidiaIsaacHud from '@/components/agents/NvidiaIsaacHud'
import AgentConfigModal from '@/components/office/AgentConfigModal'
import OfficeChatPanel, { OfficeMessage } from '@/components/office/OfficeChatPanel'
import OfficeWorkflowModal from '@/components/office/OfficeWorkflowModal'
import AgentVillageMemoryModal from '@/components/village/AgentVillageMemoryModal'
import { memoryApi, AgentEvolution } from '@/lib/api/memory'
import { detectAgentDepartment } from '@/components/office/Room'
import {
    Brain,
    Sparkles,
    Trees,
    Building2,
    Globe,
    Workflow,
    Plus,
    Users,
    MessageSquare,
    Compass,
    Settings,
    RotateCcw,
    Play,
    Pause,
    Moon,
    Sun,
    Sunset,
    Award,
    Wrench,
    BookOpen,
    Coffee,
    Home,
    MapPin,
    Zap,
    Cpu,
    Radio,
    Activity,
    ShieldCheck,
} from 'lucide-react'

const MANAGER_ID = 'agent_manager'

const DEFAULT_VILLAGE_AGENTS: Agent[] = [
    {
        id: 'agent_manager',
        name: 'Manager Lead',
        color: '#facc15',
        status: 'idle',
        speech: 'Chào mừng bạn đến với Khu Làng Tác Tử AI! Tôi phụ trách điều phối, ghi nhớ kinh nghiệm và phát triển kỹ năng cho cả làng.',
        position: [0, 0, 3.2], // Quảng trường Làng
        model: 'gemini-2.5-flash',
        prompt_id: 'manager',
        form: 'humanoid',
    },
    {
        id: 'agent_search',
        name: 'Search Researcher',
        color: '#38bdf8',
        status: 'idle',
        speech: 'Sẵn sàng tra cứu tri thức thế giới, cào tài liệu khoa học và lưu vào Thư viện Ký ức.',
        position: [8, 0, 8], // Thư viện Ký ức
        model: 'gemini-3.5-flash-lite',
        prompt_id: 'chuyen_gia_tim_kiem',
        form: 'duck',
    },
    {
        id: 'agent_summarizer',
        name: 'Summarizer Pro',
        color: '#e53e3e',
        status: 'idle',
        speech: 'Tôi phụ trách chu trình đúc kết phản tư (Reflection), nén ngữ cảnh ngắn hạn thành bài học dài hạn.',
        position: [6, 0, -3.8], // Khu nhà ở
        model: 'gemini-3.5-flash-lite',
        prompt_id: 'chuyen_gia_tom_tat',
        form: 'amr',
    },
    {
        id: 'agent_calculate',
        name: 'Calculator Pro',
        color: '#9333ea',
        status: 'idle',
        speech: 'Luyện tập giải toán khoa học và thuật toán tài chính hàng ngày tại Học viện Kỹ năng.',
        position: [-6, 0, 8], // Học viện Kỹ năng
        model: 'gemini-3.5-flash-lite',
        prompt_id: 'chuyen_gia_tinh_toan',
        form: 'humanoid',
    },
    {
        id: 'agent_analyst',
        name: 'Data Analyst',
        color: '#fb923c',
        status: 'idle',
        speech: 'Phân tích dữ liệu đa chiều, thực thi truy vấn cơ sở dữ liệu và chia sẻ mẹo dùng tool cho đồng đội.',
        position: [-6, 0, -3.8], // Xưởng thực nghiệm
        model: 'gemini-2.5-flash',
        prompt_id: 'chuyen_gia_phan_tich',
        form: 'amr',
    },
]

type VillageViewMode = '3d' | 'split'

// Mẫu các đoạn đối thoại tự hành giữa các Agent trong làng
const VILLAGE_SOCIAL_DIALOGUES = [
    {
        speakerA: 'agent_analyst',
        speakerB: 'agent_summarizer',
        textA: 'Hôm nay tôi vừa tối ưu hóa câu lệnh SQL, tốc độ truy xuất nhanh hơn 35%!',
        textB: 'Rất ấn tượng! Tôi sẽ ghi nhớ mẹo này vào bộ nhớ dài hạn để áp dụng cho các báo cáo sau.',
        skill: 'Tối ưu hóa chỉ mục SQL và cấu trúc truy vấn phân trang.',
        spot: 'town_square',
    },
    {
        speakerA: 'agent_search',
        speakerB: 'agent_calculate',
        textA: 'Tôi vừa thu thập được thuật toán tối ưu hóa mới từ ArXiv, bạn có muốn thử nghiệm không?',
        textB: 'Được chứ! Hãy cùng sang Học viện Kỹ năng để kiểm thử độ chính xác số học.',
        skill: 'Phương pháp kiểm thử số học đối kháng đa tác tử.',
        spot: 'tool_academy',
    },
    {
        speakerA: 'agent_manager',
        speakerB: 'agent_search',
        textA: 'Các báo cáo tìm kiếm sáng nay rất mạch lạc, bạn đã tăng độ thành thạo công cụ lên bậc mới rồi.',
        textB: 'Cảm ơn bạn! Thư viện Ký ức đã giúp tôi lưu giữ các mẫu tìm kiếm thành công.',
        skill: 'Lọc nhiễu văn bản và trích xuất thực thể Internet.',
        spot: 'wisdom_library',
    },
    {
        speakerA: 'agent_analyst',
        speakerB: 'agent_calculate',
        textA: 'Các ma trận tính toán hôm nay khớp hoàn hảo với biểu đồ trực quan.',
        textB: 'Sự phối hợp giữa chúng ta ngày càng ăn ý nhờ các bài học phản tư.',
        skill: 'Đồng bộ cấu trúc dữ liệu ma trận giữa Analyst và Calculator.',
        spot: 'coffee_kiosk',
    },
]

export default function OfficePage() {
    const { agents: fetchedAgents } = useAgents()
    // Mặc định khởi động vào Không gian Làng Tác Tử AI 3D (outdoor)
    const [mapType, setMapType] = useState<MapType>('outdoor')
    const [viewMode, setViewMode] = useState<VillageViewMode>('split')
    const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('day')

    // Bảng tin sự kiện trực tiếp của Làng (Village Live Event Stream)
    const [villageLiveEvent, setVillageLiveEvent] = useState<{
        title: string
        detail: string
        timestamp: string
        type: 'social' | 'tool' | 'reflection' | 'workflow'
    }>({
        title: 'Khu Làng Tác Tử AI Khởi Động',
        detail: 'Toàn bộ cư dân AI đã vào vị trí sinh hoạt, tự do học tập công cụ và giao tiếp phản tư.',
        timestamp: 'Vừa xong',
        type: 'social',
    })

    // Danh sách Agent kết hợp từ API hoặc mặc định
    const [localAgents, setLocalAgents] = useState<Agent[]>(DEFAULT_VILLAGE_AGENTS)

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
    const [memoryModalOpen, setMemoryModalOpen] = useState(false)
    const [selectedMemoryAgent, setSelectedMemoryAgent] = useState<Agent | null>(null)

    // Pipeline Tasks
    const [taskTitle, setTaskTitle] = useState<string | null>(null)
    const [steps, setSteps] = useState<PipelineStep[]>([])
    const [pipelineRunning, setPipelineRunning] = useState(false)

    // Chế độ mô phỏng sinh hoạt tự hành trong Làng (Autonomous Village Life Simulation)
    const [isAutoLifeRunning, setIsAutoLifeRunning] = useState<boolean>(true)
    const [villageCycleCount, setVillageCycleCount] = useState<number>(1)
    const autoLifeTimerRef = useRef<NodeJS.Timeout | null>(null)

    // Chat
    const [chatInput, setChatInput] = useState('')
    const [targetAgentId, setTargetAgentId] = useState('')
    const [messages, setMessages] = useState<OfficeMessage[]>([
        {
            id: 'msg-init-1',
            senderId: 'system',
            senderName: 'Hệ thống Quản lý Làng',
            senderType: 'system',
            content: 'Chào mừng bạn đến với Khu Làng Tác Tử AI (Autonomous AI Village 3D)! Các Agent tại đây sinh sống tự do, tương tác, luyện tập công cụ và tiến hóa trí tuệ qua bộ nhớ ngắn & dài hạn.',
            timestamp: 'Vừa xong',
        },
        {
            id: 'msg-init-2',
            senderId: 'agent_manager',
            senderName: 'Manager Lead',
            senderType: 'agent',
            agentColor: '#facc15',
            content: 'Chào bạn! Cả làng đang trong trạng thái Tự Hành & Tự Học. Bạn có thể bấm vào từng Agent để mở bảng Ký Ức & Trưởng Thành, hoặc giao bài toán để chúng tự luyện tập.',
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
        const ag = localAgents.find((a) => a.id === agentId) || null
        setSelectedMemoryAgent(ag)
    }

    // Click trên mặt sàn để di chuyển agent
    const handleFloorClick = (point: [number, number, number]) => {
        if (!selectedAgentId) return
        setAgentTargetActions((prev) => ({
            ...prev,
            [selectedAgentId]: { action: 'custom', targetPos: point },
        }))
    }

    // Điều hướng agent tới các phân khu hoặc vị trí
    const handleTriggerAction = (agentId: string, action: AgentAction) => {
        const idx = localAgents.findIndex((a) => a.id === agentId)
        const targetPos = resolveTargetPositionForAction(mapType, action, idx !== -1 ? idx : 0)
        setAgentTargetActions((prev) => ({
            ...prev,
            [agentId]: { action, targetPos },
        }))
    }

    // Mở modal Ký ức & Trưởng thành cho agent được chọn
    const handleOpenMemoryModal = (agent?: Agent) => {
        const target = agent || selectedAgent
        if (!target) return
        setSelectedMemoryAgent(target)
        setMemoryModalOpen(true)
    }

    // ─── CHU TRÌNH MÔ PHỎNG SINH HOẠT VÀ TỰ HỌC TRONG LÀNG ─────────────
    const runAutonomousVillageStep = useCallback(() => {
        if (!isAutoLifeRunning || localAgents.length < 2) return

        // Chọn ngẫu nhiên 1 kịch bản giao tiếp xã hội
        const scenario = VILLAGE_SOCIAL_DIALOGUES[Math.floor(Math.random() * VILLAGE_SOCIAL_DIALOGUES.length)]
        const agentA = localAgents.find((a) => a.id === scenario.speakerA)
        const agentB = localAgents.find((a) => a.id === scenario.speakerB)

        if (!agentA || !agentB) return

        // Di chuyển cả 2 agent về cùng một phân khu trong làng
        handleTriggerAction(agentA.id, scenario.spot as AgentAction)
        handleTriggerAction(agentB.id, scenario.spot as AgentAction)

        // Cập nhật sự kiện trực tiếp của Làng
        setVillageLiveEvent({
            title: `Hội thoại tại ${scenario.spot.toUpperCase()}`,
            detail: `${agentA.name} & ${agentB.name}: "${scenario.skill}"`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'social',
        })

        // Sau 2.5 giây khi đến nơi, Agent A nói
        setTimeout(() => {
            setLocalAgents((prev) =>
                prev.map((a) => (a.id === agentA.id ? { ...a, status: 'speaking', speech: scenario.textA } : a))
            )

            // Ghi nhận hội thoại vào danh sách Chat
            setMessages((prev) => [
                ...prev,
                {
                    id: `social-${Date.now()}-1`,
                    senderId: agentA.id,
                    senderName: agentA.name,
                    senderType: 'agent',
                    agentColor: agentA.color,
                    content: `[Giao lưu tại ${scenario.spot.toUpperCase()}] ${scenario.textA}`,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
            ])

            // Sau 3 giây tiếp theo, Agent B đối đáp
            setTimeout(() => {
                setLocalAgents((prev) =>
                    prev.map((a) => (a.id === agentB.id ? { ...a, status: 'speaking', speech: scenario.textB } : a))
                )

                setMessages((prev) => [
                    ...prev,
                    {
                        id: `social-${Date.now()}-2`,
                        senderId: agentB.id,
                        senderName: agentB.name,
                        senderType: 'agent',
                        agentColor: agentB.color,
                        content: scenario.textB,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    },
                ])

                // Thưởng EXP giao tiếp xã hội cho cả 2 Agent
                memoryApi.recordSocialEncounter(agentA.id)
                memoryApi.recordSocialEncounter(agentB.id)

                // Trả về trạng thái idle sau 5 giây
                setTimeout(() => {
                    setLocalAgents((prev) =>
                        prev.map((a) => (a.id === agentA.id || a.id === agentB.id ? { ...a, status: 'idle' } : a))
                    )
                }, 5000)
            }, 3000)
        }, 2500)

        setVillageCycleCount((prev) => prev + 1)
    }, [isAutoLifeRunning, localAgents])

    useEffect(() => {
        if (isAutoLifeRunning) {
            autoLifeTimerRef.current = setInterval(runAutonomousVillageStep, 22000)
        }
        return () => {
            if (autoLifeTimerRef.current) clearInterval(autoLifeTimerRef.current)
        }
    }, [isAutoLifeRunning, runAutonomousVillageStep])

    // ─── CHU KỲ NGHỈ NGƠI & TỰ PHẢN TƯ TOÀN LÀNG (VILLAGE SLEEP & REFLECT) ───
    const handleVillageSleepAndReflect = async () => {
        // Chuyển sang khung cảnh ban đêm và cập nhật sự kiện
        setTimeOfDay('night')
        setVillageLiveEvent({
            title: 'Chu Trình Phản Tư & Nén Ký Ức Ban Đêm',
            detail: 'Tất cả tác tử di chuyển về khu nhà ở, nén Short Memory thành bài học Long Memory.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'reflection',
        })

        // Cho tất cả Agent di chuyển về khu nhà ở / ghế nghỉ ngơi
        localAgents.forEach((ag) => {
            handleTriggerAction(ag.id, 'residences')
        })

        setMessages((prev) => [
            ...prev,
            {
                id: `village-sleep-${Date.now()}`,
                senderId: 'system',
                senderName: 'Hệ thống Quản lý Làng',
                senderType: 'system',
                content: '[CHU TRÌNH PHẢN TƯ TOÀN LÀNG] Tất cả Agent trở về khu nghỉ ngơi, nén ký ức ngắn hạn (Short Memory) thành tri thức & phản tư dài hạn (Long Memory).',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
        ])

        // Chạy phản tư cho từng agent
        for (const ag of localAgents) {
            try {
                await memoryApi.consolidateMemories(ag.id, ag.name, 'village')
            } catch {
                // ignore
            }
        }

        setTimeout(() => {
            setTimeOfDay('day')
            setVillageLiveEvent({
                title: 'Bình Minh Làng Tác Tử AI',
                detail: 'Cả làng tỉnh giấc với điểm EXP mới và kỹ năng được nâng cấp toàn diện.',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: 'reflection',
            })

            setMessages((prev) => [
                ...prev,
                {
                    id: `village-wake-${Date.now()}`,
                    senderId: 'system',
                    senderName: 'Hệ thống Quản lý Làng',
                    senderType: 'system',
                    content: '[HOÀN TẤT PHẢN TƯ] Cả làng đã tỉnh giấc với điểm EXP mới và kỹ năng được nâng cấp!',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
            ])
        }, 5000)
    }

    // ─── TỰ ĐỘNG GỌI TOOL ĐỂ TỰ HỌC & TRƯỞNG THÀNH ──────────────────────
    const handleAutonomousToolPractice = async () => {
        if (!selectedAgent) return

        // 1. Di chuyển Agent sang Học viện Kỹ năng
        handleTriggerAction(selectedAgent.id, 'tool_academy')

        // 2. Cập nhật trạng thái hiển thị
        setLocalAgents((prev) =>
            prev.map((a) =>
                a.id === selectedAgent.id
                    ? { ...a, status: 'working', speech: '[TỰ HỌC] Đang tự kích hoạt bài toán kiểm thử công cụ...' }
                    : a
            )
        )

        try {
            const res = await memoryApi.autonomousPracticeTool(
                selectedAgent.id,
                selectedAgent.name,
                undefined,
                'village'
            )

            // Cập nhật sự kiện trực tiếp của Làng
            setVillageLiveEvent({
                title: `Tự Luyện Tool: ${res.toolName}`,
                detail: `${selectedAgent.name} đạt +${res.proficiencyGain}% kỹ năng (${res.newProficiency}%) và nhận +${res.expGained} EXP.`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: 'tool',
            })

            setTimeout(() => {
                setLocalAgents((prev) =>
                    prev.map((a) =>
                        a.id === selectedAgent.id
                            ? {
                                  ...a,
                                  status: 'speaking',
                                  speech: `[ĐẠT +${res.proficiencyGain}%] Tự rèn luyện ${res.toolName} thành công!`,
                              }
                            : a
                    )
                )

                setMessages((prev) => [
                    ...prev,
                    {
                        id: `auto-tool-${Date.now()}`,
                        senderId: selectedAgent.id,
                        senderName: selectedAgent.name,
                        senderType: 'agent',
                        agentColor: selectedAgent.color,
                        content: `[TỰ HỌC & LUYỆN TOOL TỰ HÀNH]\n- Thử nghiệm: ${res.actionDescription}\n- Đúc kết Ký ức: "${res.learnedSkillMemory.content}"\n- Độ thành thạo: ${res.newProficiency}% (+${res.proficiencyGain}%)\n- Thưởng: +${res.expGained} EXP. Cấp độ: Level ${res.evolution.level} (${res.evolution.title}).`,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    },
                ])

                setTimeout(() => {
                    setLocalAgents((prev) =>
                        prev.map((a) => (a.id === selectedAgent.id ? { ...a, status: 'idle' } : a))
                    )
                }, 5000)
            }, 2500)
        } catch (err) {
            console.error('[VILLAGE_TOOL] Lỗi tự luyện tập tool:', err)
        }
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
            prev.map((a) => (a.id === target.id ? { ...a, status: 'thinking', speech: 'Đang suy nghĩ & truy xuất ký ức...' } : a))
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
            thinkingText: 'Đang khởi động bộ nhớ ngắn hạn và suy luận...',
            onRetry: () => handleSendMessage(text, target.id),
        }

        setMessages((prev) => [...prev, initialBotMsg])

        let accumulatedContent = ''

        try {
            const activeIds = localAgents.map((a) => a.id)
            await agentsApi.chatStream(
                target.id,
                text,
                'village',
                (event) => {
                    const eventType = (event as any).event || event.type
                    if (eventType === 'status' || eventType === 'thinking') {
                        const thinkMsg = event.content || (event as any).thought || event.message || 'Đang phân tích...'
                        setMessages((prev) =>
                            prev.map((m) => (m.id === botMsgId ? { ...m, thinkingText: thinkMsg } : m))
                        )
                        setLocalAgents((prev) =>
                            prev.map((a) =>
                                a.id === target.id ? { ...a, status: 'thinking', speech: thinkMsg.slice(0, 45) + '...' } : a
                            )
                        )
                    } else if (eventType === 'tool_start') {
                        const toolName = event.tool || 'công cụ phụ trợ'
                        // Ghi nhận luyện tập công cụ -> tăng độ thành thạo và EXP
                        memoryApi.recordToolSkillProgress(target.id, toolName, toolName)

                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === botMsgId
                                    ? { ...m, toolExecuting: toolName, thinkingText: `Đang rèn luyện công cụ: ${toolName}...` }
                                    : m
                            )
                        )
                        setLocalAgents((prev) =>
                            prev.map((a) =>
                                a.id === target.id ? { ...a, status: 'working', speech: `[TOOL_PRACTICE] ${toolName}` } : a
                            )
                        )
                    } else if (eventType === 'tool_end') {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === botMsgId
                                    ? { ...m, toolExecuting: undefined, thinkingText: 'Đang đúc kết kết quả công cụ...' }
                                    : m
                            )
                        )
                    } else if (eventType === 'token') {
                        accumulatedContent += event.content || ''
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === botMsgId ? { ...m, content: accumulatedContent, thinkingText: undefined } : m
                            )
                        )
                    } else if (eventType === 'done') {
                        const finalContent = event.answer || event.content || accumulatedContent
                        // Thưởng EXP hoàn thành bài toán
                        memoryApi.addExp(target.id, 20)

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
                    } else if (eventType === 'error') {
                        const errorMsg = (event as any).error || event.content || 'Gặp lỗi trong quá trình xử lý.'
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === botMsgId
                                    ? {
                                          ...m,
                                          isStreaming: false,
                                          isError: true,
                                          errorDetail: errorMsg,
                                          content: m.content || 'Agent gặp lỗi.',
                                      }
                                    : m
                            )
                        )
                        setLocalAgents((prev) =>
                            prev.map((a) =>
                                a.id === target.id ? { ...a, status: 'error', speech: '[ERROR] Lỗi xử lý!' } : a
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
                              errorDetail: errString || 'Mất kết nối Agent Service',
                              content: m.content || 'Không thể kết nối đến dịch vụ Agent.',
                          }
                        : m
                )
            )
            setLocalAgents((prev) =>
                prev.map((a) =>
                    a.id === target.id ? { ...a, status: 'error', speech: '[DISCONNECTED] Mất kết nối' } : a
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
            content: `KÍCH HOẠT WORKFLOW LÀNG: ${preset.title} (${preset.steps.length} bước)`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
        setMessages((prev) => [...prev, sysMsg])

        // Chạy từng bước pipeline mô phỏng thời gian thực
        preset.steps.forEach((st, idx) => {
            const delay = (idx + 1) * 2800

            setTimeout(() => {
                const agentDept = detectAgentDepartment({ id: st.agentId, name: st.agentName } as Agent)
                if (mapType === 'outdoor') {
                    if (agentDept === 'research') {
                        handleTriggerAction(st.agentId, 'wisdom_library')
                    } else if (agentDept === 'analytics') {
                        handleTriggerAction(st.agentId, 'tool_academy')
                    } else {
                        handleTriggerAction(st.agentId, 'town_square')
                    }
                } else {
                    if (agentDept === 'research') {
                        handleTriggerAction(st.agentId, 'research_lab')
                    } else if (agentDept === 'analytics') {
                        handleTriggerAction(st.agentId, 'analytics_dept')
                    } else {
                        handleTriggerAction(st.agentId, 'management_office')
                    }
                }

                setSteps((prev) =>
                    prev.map((p, i) => {
                        if (i < idx) return { ...p, status: 'done', at: 'Hoàn tất' }
                        if (i === idx) return { ...p, status: 'active', at: 'Đang xử lý...' }
                        return p
                    })
                )

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

                // Thưởng EXP cho Agent thực hiện nhiệm vụ workflow
                memoryApi.addExp(st.agentId, 30)

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

                if (idx === preset.steps.length - 1) {
                    setTimeout(() => {
                        setSteps((prev) => prev.map((p) => ({ ...p, status: 'done', at: 'Xong' })))
                        setPipelineRunning(false)
                        setLocalAgents((prev) => prev.map((a) => ({ ...a, status: 'idle', speech: null })))
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
            {/* ─── 1. TOP STATUS & NAVIGATION BAR ───────────────────────── */}
            <div className="h-12 border-b border-zinc-800 bg-zinc-950/90 px-4 flex items-center justify-between gap-3 shrink-0 backdrop-blur z-20">
                {/* Left: Village Identity */}
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                    <span className="font-bold text-sm tracking-wide text-white truncate">
                        Khu Làng Tác Tử AI (Autonomous AI Village 3D)
                    </span>
                    <span className="hidden lg:inline-block text-xs text-zinc-400 font-mono">
                        · {localAgents.length} Cư dân • Chu kỳ sống #{villageCycleCount}
                    </span>
                </div>

                {/* Center: Map Type Controls */}
                <div className="hidden sm:flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-zinc-800 backdrop-blur">
                    <button
                        type="button"
                        onClick={() => setMapType('outdoor')}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 ${
                            mapType === 'outdoor' ? 'bg-emerald-600 text-white shadow' : 'text-zinc-400 hover:text-white'
                        }`}
                        title="Không gian Làng Tác Tử ngoài trời"
                    >
                        <Trees className="w-3.5 h-3.5" />
                        <span>Khu Làng AI (Village)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setMapType('office')}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 ${
                            mapType === 'office' ? 'bg-blue-600 text-white shadow' : 'text-zinc-400 hover:text-white'
                        }`}
                        title="Văn phòng làm việc trong nhà"
                    >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Văn phòng (Office)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setMapType('iot')}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 ${
                            mapType === 'iot' ? 'bg-cyan-600 text-white shadow' : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Smart City</span>
                    </button>
                </div>

                {/* Right: Village Auto-Life Controls & Views */}
                <div className="flex items-center gap-2">
                    {/* Nút bật tắt mô phỏng tự hành */}
                    <button
                        type="button"
                        onClick={() => setIsAutoLifeRunning((prev) => !prev)}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
                            isAutoLifeRunning
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                        }`}
                        title="Bật/Tắt chế độ Agent tự do dạo chơi và giao tiếp trong làng"
                    >
                        {isAutoLifeRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        <span className="hidden md:inline">{isAutoLifeRunning ? 'Tự Hành: Bật' : 'Tự Hành: Tạm Dừng'}</span>
                    </button>

                    {/* Nút Chu trình Ngủ & Phản tư */}
                    <button
                        type="button"
                        onClick={handleVillageSleepAndReflect}
                        className="bg-purple-600/25 hover:bg-purple-600/40 text-purple-200 border border-purple-500/35 text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow transition flex items-center gap-1.5"
                        title="Kích hoạt chu trình nén bộ nhớ ngắn hạn thành phản tư dài hạn"
                    >
                        <Moon className="w-3.5 h-3.5 text-purple-400" />
                        <span className="hidden sm:inline">Phản Tư Làng</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setWorkflowModalOpen(true)}
                        className="bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow transition flex items-center gap-1.5"
                    >
                        <Workflow className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="hidden sm:inline">Workflow</span>
                    </button>

                    <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                        <button
                            type="button"
                            onClick={() => setViewMode('3d')}
                            className={`px-2 py-1 rounded text-xs font-medium transition ${
                                viewMode === '3d' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                            3D Full
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('split')}
                            className={`px-2 py-1 rounded text-xs font-medium transition flex items-center gap-1 ${
                                viewMode === 'split' ? 'bg-emerald-600 text-white shadow' : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                            <MessageSquare className="w-3 h-3" />
                            <span>3D + Chat</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── 2. AGENT TEAM FLEET STRIP ────────────────────────────── */}
            <AgentTeamStrip
                roomAgents={localAgents}
                selected3dAgentId={selectedAgentId}
                handleSelectAgent={handleSelectAgent}
                setInput={setChatInput}
            />

            {/* ─── 3. MAIN WORKSPACE BODY ───────────────────────────────── */}
            <div className="relative flex min-h-0 flex-1">
                {/* 3D Scene Viewport */}
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

                    {/* HUD TELEMETRY & VILLAGE ACTION BAR (Dưới màn hình 3D) */}
                    <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-col gap-2 pointer-events-none">
                        {/* Thanh nút điều hướng các phân khu trong Làng */}
                        <div className="flex items-center gap-1.5 overflow-x-auto text-xs pointer-events-auto bg-black/75 backdrop-blur-md p-2 rounded-2xl border border-zinc-800 shadow-xl scrollbar-none">
                            <span className="shrink-0 text-[10px] font-bold uppercase text-zinc-400 px-1 font-mono">
                                Vị trí @{selectedAgent?.id || 'agent'}:
                            </span>

                            {mapType === 'outdoor' ? (
                                <>
                                    <button
                                        onClick={() => handleTriggerAction(selectedAgentId, 'town_square')}
                                        className="px-2.5 py-1 rounded-xl border border-sky-500/40 bg-sky-600/20 text-sky-200 hover:bg-sky-600/30 transition flex items-center gap-1 text-[11px]"
                                    >
                                        <MapPin className="h-3 w-3 text-sky-400" />
                                        <span>Quảng trường Làng</span>
                                    </button>

                                    <button
                                        onClick={() => handleTriggerAction(selectedAgentId, 'tool_academy')}
                                        className="px-2.5 py-1 rounded-xl border border-emerald-500/40 bg-emerald-600/20 text-emerald-200 hover:bg-emerald-600/30 transition flex items-center gap-1 text-[11px]"
                                    >
                                        <Wrench className="h-3 w-3 text-emerald-400" />
                                        <span>Học viện Kỹ năng</span>
                                    </button>

                                    <button
                                        onClick={() => handleTriggerAction(selectedAgentId, 'wisdom_library')}
                                        className="px-2.5 py-1 rounded-xl border border-purple-500/40 bg-purple-600/20 text-purple-200 hover:bg-purple-600/30 transition flex items-center gap-1 text-[11px]"
                                    >
                                        <BookOpen className="h-3 w-3 text-purple-400" />
                                        <span>Thư viện Ký ức</span>
                                    </button>

                                    <button
                                        onClick={() => handleTriggerAction(selectedAgentId, 'residences')}
                                        className="px-2.5 py-1 rounded-xl border border-pink-500/40 bg-pink-600/20 text-pink-200 hover:bg-pink-600/30 transition flex items-center gap-1 text-[11px]"
                                    >
                                        <Home className="h-3 w-3 text-pink-400" />
                                        <span>Khu Nhà ở</span>
                                    </button>

                                    <button
                                        onClick={() => handleTriggerAction(selectedAgentId, 'coffee_kiosk')}
                                        className="px-2.5 py-1 rounded-xl border border-amber-500/40 bg-amber-600/20 text-amber-200 hover:bg-amber-600/30 transition flex items-center gap-1 text-[11px]"
                                    >
                                        <Coffee className="h-3 w-3 text-amber-400" />
                                        <span>Quán Trà</span>
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => handleTriggerAction(selectedAgentId, 'management_office')}
                                        className="px-2.5 py-1 rounded-xl border border-amber-500/40 bg-amber-600/20 text-amber-200 hover:bg-amber-600/30 transition flex items-center gap-1 text-[11px]"
                                    >
                                        <span>P. Quản lý</span>
                                    </button>
                                    <button
                                        onClick={() => handleTriggerAction(selectedAgentId, 'research_lab')}
                                        className="px-2.5 py-1 rounded-xl border border-cyan-500/40 bg-cyan-600/20 text-cyan-200 hover:bg-cyan-600/30 transition flex items-center gap-1 text-[11px]"
                                    >
                                        <span>P. Nghiên cứu</span>
                                    </button>
                                    <button
                                        onClick={() => handleTriggerAction(selectedAgentId, 'analytics_dept')}
                                        className="px-2.5 py-1 rounded-xl border border-orange-500/40 bg-orange-600/20 text-orange-200 hover:bg-orange-600/30 transition flex items-center gap-1 text-[11px]"
                                    >
                                        <span>P. Phân tích</span>
                                    </button>
                                </>
                            )}

                            <button
                                onClick={() => handleTriggerAction(selectedAgentId, 'roam')}
                                className="px-2.5 py-1 rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition flex items-center gap-1 text-[11px]"
                            >
                                <Compass className="h-3 w-3" />
                                <span>Đi dạo</span>
                            </button>

                            {/* NÚT TỰ GỌI TOOL ĐỂ TỰ HỌC & TRƯỞNG THÀNH */}
                            <button
                                onClick={handleAutonomousToolPractice}
                                className="px-2.5 py-1 rounded-xl border border-amber-500/40 bg-amber-600/20 text-amber-200 hover:bg-amber-600/30 transition flex items-center gap-1 text-[11px] font-semibold shrink-0"
                                title="Cho Agent tự kích hoạt bài toán kiểm thử và gọi công cụ để tăng kỹ năng"
                            >
                                <Zap className="h-3 w-3 text-amber-400" />
                                <span>Tự Gọi Tool (+35 EXP)</span>
                            </button>

                            {/* NÚT MỞ BỘ NHỚ & TIẾN HÓA TRƯỞNG THÀNH */}
                            <button
                                onClick={() => handleOpenMemoryModal()}
                                className="ml-auto px-3 py-1 rounded-xl border border-purple-500/50 bg-gradient-to-r from-purple-600/30 to-indigo-600/30 hover:from-purple-600/50 hover:to-indigo-600/50 text-purple-200 font-bold transition flex items-center gap-1.5 text-[11px] shadow-sm shrink-0"
                            >
                                <Brain className="h-3.5 w-3.5 text-purple-400" />
                                <span>Ký Ức & Trưởng Thành</span>
                            </button>

                            <button
                                onClick={() => setConfigModalOpen(true)}
                                className="px-2.5 py-1 rounded-xl border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition flex items-center gap-1 text-[11px] shrink-0"
                                title="Cấu hình hệ thống robot"
                            >
                                <Settings className="h-3 w-3" />
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

                    {/* Task Pipeline Visualizer */}
                    <TaskPipelinePanel taskTitle={taskTitle} steps={steps} />
                </div>

                {/* Chat Panel (Split Screen) */}
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

            {/* ─── 4. CÁC MODAL HỆ THỐNG ────────────────────────────────── */}
            {/* 1. Modal Ký Ức & Trưởng Thành Tác Tử (Short & Long Memory + Evolution) */}
            <AgentVillageMemoryModal
                agent={selectedMemoryAgent || selectedAgent}
                isOpen={memoryModalOpen}
                onClose={() => setMemoryModalOpen(false)}
                roomId="village"
                onEvolutionUpdated={(evo) => {
                    // Update agent level in local state
                    setLocalAgents((prev) =>
                        prev.map((a) =>
                            a.id === evo.agentId
                                ? { ...a, speech: `Đã đạt cấp độ Level ${evo.level} (${evo.title})!` }
                                : a
                        )
                    )
                }}
            />

            {/* 2. Modal Xem & Điều chỉnh cấu hình Agent */}
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

            {/* 3. Modal Điều phối Workflow Đa Tác tử */}
            <OfficeWorkflowModal
                open={workflowModalOpen}
                onClose={() => setWorkflowModalOpen(false)}
                agents={localAgents}
                onTriggerWorkflow={handleTriggerWorkflow}
                isRunning={pipelineRunning}
            />

            {/* 4. Dialog Giao Task Tuỳ biến */}
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
