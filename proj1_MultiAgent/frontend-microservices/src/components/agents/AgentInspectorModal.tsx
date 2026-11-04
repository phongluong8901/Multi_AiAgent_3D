'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
    Bot,
    Cpu,
    Wrench,
    Compass,
    Sparkles,
    MessageSquare,
    ExternalLink,
    X,
    Activity,
    CheckCircle2,
    Layers,
    Award,
    RefreshCw,
    FileText,
    Settings2,
    ShieldCheck,
    Save,
} from 'lucide-react'
import { Agent as AgentType, agentsApi, promptsApi, toolsApi, rlApi } from '@/lib/api'
import {
    getAgentRLConfig,
    AgentRLConfig,
    ALGORITHM_LABELS,
    MAP_LABELS,
} from '@/lib/rl/agentRLProfile'
import { AgentFormType } from './NvidiaRobots'

type AgentInspectorModalProps = {
    agent: AgentType | null
    isOpen: boolean
    onClose: () => void
    onOpenChat?: (agentId: string) => void
    currentAlgorithm?: string
    mapName?: string
    onAgentUpdated?: (updated: AgentType) => void
}

const FORM_LABELS: Record<string, string> = {
    humanoid: 'Project GR00T Biped (Humanoid)',
    amr: 'Nova Carter AMR (Wheeled Robot)',
    duck: 'MicroDuck Bipedal (Bio-mimetic)',
    drone: 'Cyber Falcon (Aerial Drone)',
    custom: 'Custom Kinematic Model (Body Studio)',
}

export default function AgentInspectorModal({
    agent,
    isOpen,
    onClose,
    onOpenChat,
    currentAlgorithm,
    mapName: propMapName,
    onAgentUpdated,
}: AgentInspectorModalProps) {
    const [agentData, setAgentData] = useState<AgentType | null>(agent)
    const [rlConfig, setRlConfig] = useState<AgentRLConfig | null>(null)
    const [promptDetails, setPromptDetails] = useState<{ id: string; title: string; content?: string } | null>(null)
    const [toolNames, setToolNames] = useState<string[]>([])
    const [backendPolicyName, setBackendPolicyName] = useState<string | null>(null)
    const [isSyncing, setIsSyncing] = useState<boolean>(false)
    const [lastSyncText, setLastSyncText] = useState<string>('')

    const agentId = agent?.id || ''

    // Hàm nạp dữ liệu tức thời và đồng bộ từ Backend & LocalStorage
    const loadFreshAgentData = useCallback(async (targetId: string) => {
        if (!targetId) return
        setIsSyncing(true)

        try {
            // 1. Đọc dữ liệu cục bộ đã lưu trên trình duyệt (từ Agent Setup và RL Training)
            let localModel: string | null = null
            let localForm: string | null = null
            let localBodyId: string | null = null
            let localPolicy: string | null = null

            if (typeof window !== 'undefined') {
                localModel = localStorage.getItem(`agent_model:${targetId}`)
                localForm = localStorage.getItem(`agent_form:${targetId}`)
                localBodyId = localStorage.getItem(`agent_body_id:${targetId}`)
                localPolicy = localStorage.getItem(`agent_policy:${targetId}`)
            }

            // 2. Nạp cấu hình RL hiện tại của robot
            const initialRL = getAgentRLConfig(targetId)
            if (currentAlgorithm) {
                initialRL.algorithm = currentAlgorithm as any
                initialRL.algorithmName = ALGORITHM_LABELS[currentAlgorithm.toLowerCase()] || currentAlgorithm.toUpperCase()
            }
            if (propMapName) {
                initialRL.mapName = propMapName === 'grid' ? 'grid' : 'office'
            }
            if (localPolicy) {
                initialRL.policyName = localPolicy
                setBackendPolicyName(localPolicy)
            }
            setRlConfig(initialRL)

            // 3. Gọi song song API Backend để lấy cấu hình mới nhất từ Database & RL Service
            const [freshAgentRes, promptsRes, toolsRes, policiesRes] = await Promise.allSettled([
                agentsApi.get(targetId),
                promptsApi.list(),
                toolsApi.list(),
                rlApi.listPolicies(),
            ])

            let latestAgent: AgentType | null = null

            if (freshAgentRes.status === 'fulfilled' && freshAgentRes.value) {
                latestAgent = freshAgentRes.value
            } else if (agent) {
                latestAgent = { ...agent }
            }

            if (latestAgent) {
                // Áp dụng cấu hình ưu tiên (Local cache vừa thay đổi hoặc DB)
                const mergedModel = localModel || latestAgent.model || 'gemini-2.5-flash-lite'
                const mergedForm = (localForm as AgentFormType) || latestAgent.form || 'humanoid'
                const mergedBodyId = localBodyId || latestAgent.body_id || latestAgent.bodyId || null

                const mergedAgent: AgentType = {
                    ...latestAgent,
                    model: mergedModel,
                    form: mergedForm,
                    body_id: mergedBodyId,
                }
                setAgentData(mergedAgent)
                onAgentUpdated?.(mergedAgent)

                // Đồng bộ tên Prompt
                const targetPromptId = mergedAgent.prompt_id
                if (targetPromptId && promptsRes.status === 'fulfilled' && Array.isArray(promptsRes.value)) {
                    const foundPrompt = promptsRes.value.find((p) => p.id === targetPromptId)
                    if (foundPrompt) {
                        setPromptDetails({
                            id: foundPrompt.id,
                            title: foundPrompt.title || foundPrompt.id,
                            content: foundPrompt.content,
                        })
                    } else {
                        setPromptDetails({ id: targetPromptId, title: targetPromptId })
                    }
                } else if (targetPromptId) {
                    setPromptDetails({ id: targetPromptId, title: targetPromptId })
                } else {
                    setPromptDetails(null)
                }

                // Đồng bộ danh sách Tools
                const allAvailableTools = toolsRes.status === 'fulfilled' && Array.isArray(toolsRes.value) ? toolsRes.value : []
                const agentToolsRaw = mergedAgent.tools || []
                const resolvedNames: string[] = []

                if (Array.isArray(agentToolsRaw) && agentToolsRaw.length > 0) {
                    agentToolsRaw.forEach((t: any) => {
                        if (typeof t === 'string') {
                            const match = allAvailableTools.find((item) => item.id === t)
                            resolvedNames.push(match ? match.name : t)
                        } else if (t && typeof t === 'object') {
                            resolvedNames.push(t.name || t.id || 'Tool')
                        }
                    })
                }

                if (resolvedNames.length === 0) {
                    resolvedNames.push('workflow_planner_tool', 'web_search_tool', 'text_summarizer')
                }
                setToolNames(resolvedNames)
            }

            // Đồng bộ thông tin Policy đã huấn luyện từ Backend RL
            let matchedPolicy: string | null = null
            if (policiesRes.status === 'fulfilled' && Array.isArray(policiesRes.value)) {
                // Khớp chính xác theo agent_id hoặc tên file policy chứa agent_id
                const agentPolicies = policiesRes.value.filter(
                    (p) => p.agent_id === targetId || p.name.includes(targetId)
                )
                if (agentPolicies.length > 0) {
                    const latestPolicy = agentPolicies[agentPolicies.length - 1]
                    matchedPolicy = latestPolicy.name
                    setBackendPolicyName(latestPolicy.name)
                    setRlConfig((prev) => {
                        const base = prev || initialRL
                        return {
                            ...base,
                            policyName: latestPolicy.name || base.policyName,
                            episodes: latestPolicy.episodes || base.episodes,
                            statesLearned: latestPolicy.states || base.statesLearned,
                            algorithm: (latestPolicy.algorithm as any) || base.algorithm,
                            algorithmName:
                                latestPolicy.algorithm_name ||
                                (latestPolicy.algorithm ? ALGORITHM_LABELS[latestPolicy.algorithm] : base.algorithmName),
                        }
                    })
                }
            }

            if (!matchedPolicy && localPolicy) {
                setBackendPolicyName(localPolicy)
            }

            const now = new Date()
            setLastSyncText(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`)
        } catch (err) {
            console.error('[AGENT_INSPECTOR] Lỗi đồng bộ dữ liệu:', err)
        } finally {
            setIsSyncing(false)
        }
    }, [agent, currentAlgorithm, propMapName, onAgentUpdated])

    // Kích hoạt nạp khi mở modal hoặc agentId thay đổi
    useEffect(() => {
        if (!isOpen || !agentId) return
        loadFreshAgentData(agentId)

        // Lắng nghe sự kiện cập nhật cấu hình RL từ trang RL Training 3D
        const handleRLUpdate = (e: any) => {
            if (e.detail?.agentId === agentId) {
                setRlConfig(e.detail.config)
                if (e.detail.config?.policyName) {
                    setBackendPolicyName(e.detail.config.policyName)
                }
            }
        }

        // Lắng nghe sự kiện cập nhật Model/Tools/Prompt từ trang Agent Setup
        const handleAgentUpdate = (e: any) => {
            if (e.detail?.id === agentId) {
                loadFreshAgentData(agentId)
            }
        }

        // Lắng nghe sự thay đổi LocalStorage xuyên tab/cửa sổ
        const handleStorage = (e: StorageEvent) => {
            if (
                e.key === `agent_rl_config_${agentId}` ||
                e.key === `agent_policy:${agentId}` ||
                e.key === `agent_model:${agentId}` ||
                e.key === `agent_form:${agentId}` ||
                e.key === `agent_body_id:${agentId}`
            ) {
                loadFreshAgentData(agentId)
            }
        }

        // Tự động đồng bộ lại khi người dùng quay lại tab trình duyệt
        const handleWindowFocus = () => {
            loadFreshAgentData(agentId)
        }

        window.addEventListener('agent-rl-updated', handleRLUpdate)
        window.addEventListener('agent-updated', handleAgentUpdate)
        window.addEventListener('storage', handleStorage)
        window.addEventListener('focus', handleWindowFocus)

        return () => {
            window.removeEventListener('agent-rl-updated', handleRLUpdate)
            window.removeEventListener('agent-updated', handleAgentUpdate)
            window.removeEventListener('storage', handleStorage)
            window.removeEventListener('focus', handleWindowFocus)
        }
    }, [isOpen, agentId, loadFreshAgentData])

    if (!isOpen || !agentData) return null

    // Nhận diện Model LLM đã nạp (Ưu tiên: Cấu hình mới nhất tại Agent Setup)
    const effectiveModel = agentData.model || 'gemini-2.5-flash-lite'
    const isRentedModel = effectiveModel.startsWith('rented:') || effectiveModel.startsWith('rental:')

    // Nhận diện thuật toán RL & Bản đồ
    const activeRL = rlConfig || getAgentRLConfig(agentData.id)
    const effectiveAlgoName =
        activeRL.algorithmName || ALGORITHM_LABELS[activeRL.algorithm] || activeRL.algorithm?.toUpperCase()
    const effectiveMapName =
        activeRL.mapName === 'grid' ? MAP_LABELS.grid : MAP_LABELS.office

    // Nhận diện chính xác tên Tập Policy đã lưu / nạp tại kho lưu trữ RL Training
    const effectivePolicyName =
        backendPolicyName ||
        activeRL.policyName ||
        (typeof window !== 'undefined' ? localStorage.getItem(`agent_policy:${agentData.id}`) : null) ||
        `policy_${agentData.id}_v1`

    const currentForm = agentData.form || 'humanoid'
    const formDisplay = FORM_LABELS[currentForm] || FORM_LABELS.humanoid
    const hasCustomBody = currentForm === 'custom' || agentData.body_id || agentData.bodyId

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fadeIn">
            {/* Modal Container */}
            <div className="relative w-full max-w-2xl bg-zinc-950/95 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden p-6 text-zinc-100 space-y-4 max-h-[92vh] flex flex-col">
                {/* Nút hành động trên Header */}
                <div className="absolute top-5 right-5 flex items-center gap-2">
                    <button
                        onClick={() => loadFreshAgentData(agentData.id)}
                        disabled={isSyncing}
                        className="p-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition disabled:opacity-50"
                        title="Đồng bộ ngay dữ liệu mới nhất từ Agent Setup & RL Training"
                    >
                        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[#76b900]' : ''}`} />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                        title="Đóng cửa sổ"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* 1. Header: Thông tin Định danh Robot / Agent */}
                <div className="flex items-center gap-4 border-b border-zinc-800/80 pb-4 shrink-0">
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg border border-white/10 shrink-0"
                        style={{
                            backgroundColor: `${agentData.color || '#3b82f6'}25`,
                            color: agentData.color || '#3b82f6',
                        }}
                    >
                        <Bot className="w-8 h-8" />
                    </div>
                    <div className="flex-1 min-w-0 pr-16">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-xl font-bold text-white truncate">{agentData.name}</h2>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                                ID: {agentData.id}
                            </span>
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#76b900]/15 text-[#76b900] border border-[#76b900]/30 font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-[#76b900]" />
                                Đồng bộ Trực tiếp
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400 flex-wrap">
                            <span className="flex items-center gap-1.5">
                                <span
                                    className={`w-2 h-2 rounded-full ${
                                        agentData.status === 'working' || agentData.status === 'thinking'
                                            ? 'bg-amber-400 animate-pulse'
                                            : agentData.status === 'speaking'
                                            ? 'bg-purple-400 animate-pulse'
                                            : 'bg-[#76b900]'
                                    }`}
                                />
                                <span className="capitalize">{agentData.status || 'idle'}</span>
                            </span>
                            <span>·</span>
                            <span className="font-mono text-[11px] text-zinc-300">
                                Toạ độ: [{agentData.position?.[0]?.toFixed(1) ?? 0}, {agentData.position?.[2]?.toFixed(1) ?? 0}]
                            </span>
                            <span>·</span>
                            <span className="text-[10px] text-zinc-300 font-semibold bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md">
                                {formDisplay}
                            </span>
                            {lastSyncText && (
                                <span className="text-[10px] text-zinc-500 font-mono">
                                    (Cập nhật: {lastSyncText})
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Cấu hình Nạp (Model, Prompt, Tools, RL Navigation) */}
                <div className="space-y-3 overflow-y-auto pr-1 flex-1 text-xs">
                    {/* Mục Model LLM */}
                    <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-zinc-200 flex items-center gap-2">
                                <Cpu className={`w-4 h-4 ${isRentedModel ? 'text-cyan-400' : 'text-purple-400'}`} />
                                Mô hình Trí tuệ Suy luận (LLM Core)
                            </span>
                            {isRentedModel ? (
                                <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono text-[11px] font-bold">
                                    [P2P Mesh AI] {effectiveModel}
                                </span>
                            ) : (
                                <span className="px-2.5 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 font-mono text-[11px] font-bold">
                                    {effectiveModel}
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                            {isRentedModel
                                ? 'Mô hình Local AI đang chạy trên máy trạm của đối tác Seller (P2P Mesh). Suy luận thời gian thực và thực thi an toàn trên Agent Service.'
                                : 'Mô hình ngôn ngữ lớn phụ trách lập kế hoạch, phản xạ hội thoại và kích hoạt Tool calling tự động theo cấu hình tại Agent Setup.'}
                        </p>
                    </div>

                    {/* Mục Prompt Kịch bản */}
                    <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-zinc-200 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-emerald-400" />
                                Kịch bản Vai trò & Chỉ thị (System Prompt)
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                {promptDetails ? promptDetails.id : 'default_system_prompt'}
                            </span>
                        </div>
                        <p className="text-[11px] text-zinc-300 font-medium">
                            {promptDetails ? promptDetails.title : 'Chỉ thị hệ thống mặc định (Default Role Directive)'}
                        </p>
                        {promptDetails?.content && (
                            <p className="text-[10px] text-zinc-400 line-clamp-2 italic bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/60">
                                &quot;{promptDetails.content}&quot;
                            </p>
                        )}
                    </div>

                    {/* Mục Tools đã nạp */}
                    <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-zinc-200 flex items-center gap-2">
                                <Wrench className="w-4 h-4 text-amber-400" />
                                Bộ Công cụ Thực thi (Assigned Tools)
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono bg-zinc-800 px-2 py-0.5 rounded">
                                {toolNames.length} công cụ
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {toolNames.map((t, idx) => (
                                <span
                                    key={idx}
                                    className="px-2.5 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-zinc-200 font-mono text-[11px] flex items-center gap-1.5"
                                >
                                    <Sparkles className="w-3 h-3 text-amber-400" />
                                    {t}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Mục Khung Khớp Động Học Custom Body Studio (nếu có) */}
                    {hasCustomBody && (
                        <div className="p-3.5 rounded-2xl bg-purple-950/30 border border-purple-500/30 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-purple-300 flex items-center gap-2">
                                    <Bot className="w-4 h-4 text-purple-400" />
                                    Khung Xương & Khớp Động Học (Body Studio)
                                </span>
                                <Link
                                    href="/agent-body-studio"
                                    className="px-2.5 py-1 rounded-lg bg-purple-900/40 hover:bg-purple-800/50 text-purple-200 border border-purple-500/30 text-[11px] font-semibold flex items-center gap-1 transition"
                                >
                                    <span>Mở Body Studio</span>
                                    <ExternalLink className="w-3 h-3 text-purple-300" />
                                </Link>
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-300 pt-0.5">
                                <span className="text-zinc-400">Mã Cấu trúc Khớp (URDF):</span>
                                <span className="text-purple-300 font-semibold">
                                    {agentData.body_id || agentData.bodyId || 'Custom URDF Articulation'}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Mục Reinforcement Learning Policy */}
                    <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/40 to-indigo-950/40 border border-blue-500/30 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-blue-300 flex items-center gap-2">
                                <Compass className="w-4 h-4 text-blue-400" />
                                Thuật toán RL & Điều hướng Nạp vào {agentData.name}
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px] font-mono font-medium flex items-center gap-1">
                                    <Save className="w-3 h-3 text-blue-400" />
                                    <span>{effectivePolicyName}</span>
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full bg-[#76b900]/15 text-[#76b900] border border-[#76b900]/30 text-[10px] font-bold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#76b900] animate-pulse" />
                                    ACTIVE STEERING
                                </span>
                            </div>
                        </div>

                        {/* 4 Ô thông số quan trọng của RL */}
                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 text-zinc-300">
                            <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-0.5">
                                <span className="text-zinc-500 block text-[10px]">Thuật toán Huấn luyện</span>
                                <strong className="text-white text-xs">{effectiveAlgoName}</strong>
                            </div>
                            <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-0.5">
                                <span className="text-zinc-500 block text-[10px]">Tập Policy Huấn luyện (Storage)</span>
                                <strong className="text-emerald-400 font-mono text-xs flex items-center gap-1.5 truncate" title={effectivePolicyName}>
                                    <Save className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <span className="truncate">{effectivePolicyName}</span>
                                </strong>
                            </div>
                            <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-0.5">
                                <span className="text-zinc-500 block text-[10px]">Môi trường Bản đồ</span>
                                <strong className="text-indigo-400 text-xs">{effectiveMapName}</strong>
                            </div>
                            <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-0.5">
                                <span className="text-zinc-500 block text-[10px]">Cảm biến Không gian</span>
                                <strong className="text-cyan-400 text-xs">{activeRL.sensorType || '8-Beam 13D Continuous LIDAR'}</strong>
                            </div>
                        </div>

                        {/* Thống kê Tri thức Huấn luyện đã nạp */}
                        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-[11px] text-zinc-300">
                            <span className="flex items-center gap-1.5">
                                <Activity className="w-3.5 h-3.5 text-blue-400" />
                                <span>Episodes: <strong className="text-white">{activeRL.episodes ?? 300}</strong></span>
                            </span>
                            <span>·</span>
                            <span className="flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                                <span>States: <strong className="text-white">{activeRL.statesLearned ?? 0}</strong></span>
                            </span>
                            <span>·</span>
                            <span className="flex items-center gap-1.5">
                                <Award className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Thành công: <strong className="text-emerald-300">{activeRL.successRate ?? 95}%</strong></span>
                            </span>
                        </div>

                        {/* Ghi chú mô tả kỹ thuật rõ ràng về Policy */}
                        <p className="text-[10px] text-zinc-400 pt-0.5 leading-relaxed">
                            [RL POLICY] Robot <strong className="text-zinc-200">{agentData.name}</strong> ({agentData.id}) đang nạp tập policy <strong className="text-emerald-300 font-mono">{effectivePolicyName}</strong> ({effectiveAlgoName}) từ kho lưu trữ huấn luyện, tự nhận diện mép bàn, ghế sofa, vách kính để tự động né vật cản.
                        </p>

                        {activeRL.flashedAt && (
                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
                                <ShieldCheck className="w-3.5 h-3.5 text-[#76b900]" />
                                <span>Thời điểm nạp chính thức: {new Date(activeRL.flashedAt).toLocaleString('vi-VN')}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Action Buttons */}
                <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-zinc-800/80 shrink-0">
                    <div className="flex items-center gap-2">
                        <Link
                            href={`/agents/${agentData.id}`}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 transition"
                        >
                            <Settings2 className="w-4 h-4 text-zinc-400" />
                            <span>Cấu hình Agent (Setup)</span>
                        </Link>
                        <Link
                            href={`/training?agent=${encodeURIComponent(agentData.id)}`}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 transition"
                        >
                            <Compass className="w-4 h-4 text-blue-400" />
                            <span>RL Training 3D</span>
                            <ExternalLink className="w-3 h-3 text-zinc-500" />
                        </Link>
                    </div>

                    {onOpenChat && (
                        <button
                            onClick={() => {
                                onOpenChat(agentData.id)
                                onClose()
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-blue-500/25 transition"
                        >
                            <MessageSquare className="w-4 h-4" />
                            <span>Mở Chat Trực Tiếp</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
