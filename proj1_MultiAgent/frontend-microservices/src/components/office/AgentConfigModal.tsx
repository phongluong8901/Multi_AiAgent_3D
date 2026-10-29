'use client'

import React from 'react'
import Link from 'next/link'
import { Agent } from '@/lib/api'
import { AgentAction } from '@/components/agents/Agent'
import { detectAgentDepartment } from '@/components/office/Room'
import { ROBOT_HARDWARE_SPECS } from '@/components/agents/NvidiaIsaacHud'
import { AgentFormType } from '@/components/agents/NvidiaRobots'
import {
    IconX,
    IconExternalLink,
    IconCpu,
    IconActivity,
    IconZap,
    IconBrain,
    IconWrench,
    IconMessageSquare,
    IconWorkflow,
    IconUser,
    IconLaptop,
    IconArmchair,
    IconCoffee,
    IconCompass,
    IconShield,
    IconLayers,
} from '@/components/ui/icons'

interface AgentConfigModalProps {
    open: boolean
    onClose: () => void
    agent: Agent | null
    onTriggerAction?: (agentId: string, action: AgentAction) => void
    onOpenChatWithAgent?: (agentId: string) => void
    onOpenWorkflowWithAgent?: (agentId: string) => void
}

function getAgentForm(agent: Agent | null): AgentFormType {
    if (!agent) return 'humanoid'
    if (typeof window !== 'undefined' && agent.id) {
        const saved = localStorage.getItem(`agent_form:${agent.id}`)
        if (saved === 'duck' || saved === 'amr' || saved === 'drone' || saved === 'humanoid') {
            return saved as AgentFormType
        }
    }
    const lower = `${agent.name || ''} ${agent.id || ''}`.toLowerCase()
    if (lower.includes('duck') || lower.includes('vit')) return 'duck'
    if (lower.includes('amr') || lower.includes('agv') || lower.includes('xe') || lower.includes('logistics')) return 'amr'
    if (lower.includes('drone') || lower.includes('fly') || lower.includes('bay')) return 'drone'
    return 'humanoid'
}

export default function AgentConfigModal({
    open,
    onClose,
    agent,
    onTriggerAction,
    onOpenChatWithAgent,
    onOpenWorkflowWithAgent,
}: AgentConfigModalProps) {
    if (!open || !agent) return null

    const form = getAgentForm(agent)
    const specs = ROBOT_HARDWARE_SPECS[form] || ROBOT_HARDWARE_SPECS.humanoid
    const FormIcon = specs.icon
    const dept = detectAgentDepartment(agent)

    const deptInfo = {
        management: {
            title: 'Phòng Quản Lý & Điều Hành',
            enTitle: 'Executive Suite',
            color: 'text-amber-400',
            bg: 'bg-amber-500/10 border-amber-500/30',
        },
        research: {
            title: 'Phòng Nghiên Cứu & Tìm Kiếm',
            enTitle: 'Research & Search Lab',
            color: 'text-sky-400',
            bg: 'bg-sky-500/10 border-sky-500/30',
        },
        analytics: {
            title: 'Phòng Phân Tích & Đánh Giá',
            enTitle: 'Data & Analytics Dept',
            color: 'text-orange-400',
            bg: 'bg-orange-500/10 border-orange-500/30',
        },
    }[dept]

    const effectiveColor = agent.color || specs.accentColor

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl text-white">
                {/* Header Top Accent */}
                <div
                    className="h-1.5 w-full"
                    style={{ backgroundColor: effectiveColor }}
                />

                {/* Modal Header */}
                <div className="flex items-start justify-between p-5 border-b border-zinc-800/80">
                    <div className="flex items-center gap-3.5">
                        <div
                            className="p-3 rounded-xl border flex items-center justify-center"
                            style={{
                                borderColor: `${effectiveColor}40`,
                                backgroundColor: `${effectiveColor}15`,
                                color: effectiveColor,
                            }}
                        >
                            <FormIcon className="w-7 h-7" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-lg font-bold tracking-tight text-white">
                                    {agent.name}
                                </h2>
                                <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-400">
                                    @{agent.id}
                                </span>
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${deptInfo.bg} ${deptInfo.color}`}>
                                    {deptInfo.title}
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-1 flex items-center gap-2">
                                <span className="flex items-center gap-1">
                                    <span
                                        className={`w-2 h-2 rounded-full ${
                                            agent.status === 'working' || agent.status === 'thinking'
                                                ? 'bg-amber-400 animate-ping'
                                                : agent.status === 'blocked'
                                                ? 'bg-rose-400'
                                                : 'bg-[#76b900]'
                                        }`}
                                    />
                                    <span className="capitalize">{agent.status || 'idle'}</span>
                                </span>
                                <span>·</span>
                                <span>Form: {specs.modelName}</span>
                                {agent.ownerName && (
                                    <>
                                        <span>·</span>
                                        <span className="text-blue-400">Sở hữu: {agent.ownerName}</span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition"
                    >
                        <IconX className="w-5 h-5" />
                    </button>
                </div>

                {/* Content Body */}
                <div className="p-5 space-y-4 text-xs">
                    {/* Speech / Live Thought (nếu có) */}
                    {agent.speech && (
                        <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/30 text-purple-200 flex items-start gap-2.5">
                            <IconMessageSquare className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                            <div>
                                <div className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">
                                    Suy nghĩ / Phản hồi hiện tại:
                                </div>
                                <div className="mt-0.5 italic">{agent.speech}</div>
                            </div>
                        </div>
                    )}

                    {/* Hardware & NVIDIA Specs */}
                    <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/90">
                        <div className="flex items-center justify-between mb-2.5">
                            <span className="font-semibold text-zinc-200 flex items-center gap-1.5 text-xs">
                                <IconCpu className="w-4 h-4 text-[#76b900]" />
                                <span>Cấu hình Phần cứng (NVIDIA Isaac Specs)</span>
                            </span>
                            <span className="text-[10px] font-mono text-[#76b900] bg-[#76b900]/10 border border-[#76b900]/30 px-2 py-0.5 rounded">
                                PHYSX 5.3 VERIFIED
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-zinc-300">
                            <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/60">
                                <span className="text-zinc-500 block text-[10px]">Chip xử lý AI</span>
                                <span className="font-semibold text-white mt-0.5 block">{specs.chipset}</span>
                            </div>
                            <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/60">
                                <span className="text-zinc-500 block text-[10px]">Sức mạnh tính toán</span>
                                <span className="font-semibold text-[#76b900] mt-0.5 block">{specs.computePower}</span>
                            </div>
                            <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/60">
                                <span className="text-zinc-500 block text-[10px]">Cảm biến thị giác (Perception)</span>
                                <span className="font-semibold text-white mt-0.5 block">{specs.perception}</span>
                            </div>
                            <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/60">
                                <span className="text-zinc-500 block text-[10px]">Hệ thống truyền động</span>
                                <span className="font-semibold text-white mt-0.5 block">{specs.chassisType}</span>
                            </div>
                        </div>
                    </div>

                    {/* AI Model & Brain Config */}
                    <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/90 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-zinc-200 flex items-center gap-1.5 text-xs">
                                <IconBrain className="w-4 h-4 text-purple-400" />
                                <span>Mô hình Trí tuệ (LLM Model Nạp Vào)</span>
                            </span>
                            <span className="text-[11px] font-mono text-purple-300 bg-purple-500/10 border border-purple-500/30 px-2.5 py-0.5 rounded-lg font-bold">
                                {agent.model || 'gemini-2.5-flash-lite'}
                            </span>
                        </div>

                        <div className="space-y-2 text-zinc-300">
                            <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/60">
                                <span className="text-zinc-500 block text-[10px]">Chỉ thị Cốt lõi (System Prompt ID):</span>
                                <p className="text-xs text-zinc-300 mt-1 line-clamp-2 italic">
                                    {agent.prompt_id
                                        ? `Prompt ID: [${agent.prompt_id}] • Đảm bảo chỉ đạo chuyên môn cho ${deptInfo.title}`
                                        : `Chuyên gia trí tuệ nhân tạo phối hợp phân tích và điều phối nghiệp vụ`}
                                </p>
                            </div>

                            {/* Danh sách Tools đã nạp */}
                            <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/60 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-400 flex items-center gap-1.5 text-[11px]">
                                        <IconWrench className="w-3.5 h-3.5 text-amber-400" />
                                        <span>Bộ Công cụ đã nạp (Tools & Plugins):</span>
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {(() => {
                                        const rawTools = (agent as any).tools || (agent as any).tool_ids || []
                                        const tools = Array.isArray(rawTools) && rawTools.length > 0
                                            ? rawTools
                                            : dept === 'management'
                                            ? ['workflow_planner_tool', 'system_control_tool']
                                            : dept === 'research'
                                            ? ['web_search_tool', 'google_search_tool', 'text_summarizer', 'pdf_analyzer_tool']
                                            : ['data_analysis_tool', 'csv_analyzer_tool', 'ml_evaluator_tool', 'python_sandbox_tool']

                                        return tools.map((t: any, idx: number) => {
                                            const name = typeof t === 'string' ? t : t.name || t.id || 'tool'
                                            return (
                                                <span
                                                    key={idx}
                                                    className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-300 font-mono text-[10px] inline-flex items-center gap-1"
                                                >
                                                    <IconWrench className="w-2.5 h-2.5 text-amber-400" />
                                                    {name}
                                                </span>
                                            )
                                        })
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RL Navigation & Obstacle Avoidance Policy */}
                    <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-zinc-900/60 border border-blue-500/40 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-blue-200 flex items-center gap-1.5 text-xs">
                                <IconCompass className="w-4 h-4 text-blue-400" />
                                <span>Bộ não RL Điều hướng (Reinforcement Learning)</span>
                            </span>
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                ACTIVE STEERING
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-zinc-300 text-[11px]">
                            <div className="bg-zinc-950/70 p-2 rounded-lg border border-zinc-800">
                                <span className="text-zinc-500 block text-[10px]">Thuật toán Nạp</span>
                                <strong className="text-white">Q-Learning + 3D LIDAR</strong>
                            </div>
                            <div className="bg-zinc-950/70 p-2 rounded-lg border border-zinc-800">
                                <span className="text-zinc-500 block text-[10px]">Cảm biến Không gian</span>
                                <strong className="text-cyan-400">8 Tia LIDAR (Quét 2.4m)</strong>
                            </div>
                            <div className="bg-zinc-950/70 p-2 rounded-lg border border-zinc-800">
                                <span className="text-zinc-500 block text-[10px]">Khả năng Né tránh</span>
                                <strong className="text-emerald-400">Né Bàn Ghế, Sofa, Vách Kính</strong>
                            </div>
                            <div className="bg-zinc-950/70 p-2 rounded-lg border border-zinc-800">
                                <span className="text-zinc-500 block text-[10px]">Môi trường Map</span>
                                <strong className="text-indigo-400">Office 3D Room Layout</strong>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                            <p className="text-[10px] text-zinc-400 italic">
                                [RL] Tự động né vật cản tiếp tuyến khi bạn click chọn điểm đến trên sàn.
                            </p>
                            <Link
                                href="/training"
                                className="text-[10px] text-blue-400 hover:text-blue-300 underline flex items-center gap-1 shrink-0 ml-2"
                            >
                                <span>Mở phòng Huấn luyện RL -&gt;</span>
                            </Link>
                        </div>
                    </div>

                    {/* Điều khiển vị trí nhanh trong văn phòng */}
                    {onTriggerAction && (
                        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/90">
                            <span className="font-semibold text-zinc-200 block mb-2 text-xs">
                                Điều phối di chuyển trong văn phòng:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                <button
                                    onClick={() => onTriggerAction(agent.id, 'management_office')}
                                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition flex items-center gap-1"
                                >
                                    <IconUser className="w-3.5 h-3.5" />
                                    <span>P. Quản lý</span>
                                </button>
                                <button
                                    onClick={() => onTriggerAction(agent.id, 'research_lab')}
                                    className="px-2.5 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 hover:bg-sky-500/25 transition flex items-center gap-1"
                                >
                                    <IconLaptop className="w-3.5 h-3.5" />
                                    <span>P. Nghiên cứu</span>
                                </button>
                                <button
                                    onClick={() => onTriggerAction(agent.id, 'analytics_dept')}
                                    className="px-2.5 py-1.5 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-300 hover:bg-orange-500/25 transition flex items-center gap-1"
                                >
                                    <IconActivity className="w-3.5 h-3.5" />
                                    <span>P. Phân tích</span>
                                </button>
                                <button
                                    onClick={() => onTriggerAction(agent.id, 'desk')}
                                    className="px-2.5 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 hover:bg-blue-500/25 transition flex items-center gap-1"
                                >
                                    <IconLaptop className="w-3.5 h-3.5" />
                                    <span>Bàn làm việc</span>
                                </button>
                                <button
                                    onClick={() => onTriggerAction(agent.id, 'sofa')}
                                    className="px-2.5 py-1.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 transition flex items-center gap-1"
                                >
                                    <IconArmchair className="w-3.5 h-3.5" />
                                    <span>Sofa</span>
                                </button>
                                <button
                                    onClick={() => onTriggerAction(agent.id, 'coffee')}
                                    className="px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition flex items-center gap-1"
                                >
                                    <IconCoffee className="w-3.5 h-3.5" />
                                    <span>Cà phê</span>
                                </button>
                                <button
                                    onClick={() => onTriggerAction(agent.id, 'roam')}
                                    className="px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition flex items-center gap-1"
                                >
                                    <IconCompass className="w-3.5 h-3.5" />
                                    <span>Đi dạo</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-between p-4 border-t border-zinc-800/80 bg-zinc-950/70">
                    <Link
                        href={`/agents/${agent.id}`}
                        className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 transition"
                    >
                        <span>Chỉnh sửa cấu hình chuyên sâu</span>
                        <IconExternalLink className="w-3 h-3" />
                    </Link>

                    <div className="flex items-center gap-2">
                        {onOpenWorkflowWithAgent && (
                            <button
                                onClick={() => {
                                    onOpenWorkflowWithAgent(agent.id)
                                    onClose()
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 hover:bg-indigo-600/50 transition flex items-center gap-1.5"
                            >
                                <IconWorkflow className="w-3.5 h-3.5 text-indigo-400" />
                                <span>Giao Workflow</span>
                            </button>
                        )}
                        {onOpenChatWithAgent && (
                            <button
                                onClick={() => {
                                    onOpenChatWithAgent(agent.id)
                                    onClose()
                                }}
                                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg transition flex items-center gap-1.5"
                            >
                                <IconMessageSquare className="w-3.5 h-3.5" />
                                <span>Chat với Agent</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
