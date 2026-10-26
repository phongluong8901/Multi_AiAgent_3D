'use client'

import React, { useRef, useEffect } from 'react'
import { Agent } from '@/lib/api'
import { detectAgentDepartment } from '@/components/office/Room'
import { ROBOT_HARDWARE_SPECS } from '@/components/agents/NvidiaIsaacHud'
import { AgentFormType } from '@/components/agents/NvidiaRobots'
import {
    IconSend,
    IconUser,
    IconBot,
    IconSparkles,
    IconWorkflow,
    IconActivity,
    IconSearch,
    IconBarChart,
    IconLayers,
    IconX,
} from '@/components/ui/icons'

export interface OfficeMessage {
    id: string
    senderId: string
    senderName: string
    senderType: 'user' | 'agent' | 'system'
    content: string
    timestamp: string
    agentColor?: string
    isWorkflowTrace?: boolean
}

interface OfficeChatPanelProps {
    agents: Agent[]
    messages: OfficeMessage[]
    input: string
    setInput: (val: string) => void
    targetAgentId: string
    setTargetAgentId: (id: string) => void
    onSendMessage: (text: string, targetAgentId?: string) => void
    onRunWorkflowPreset?: (presetName: string) => void
    onClose?: () => void
    isDrawer?: boolean
}

function getAgentForm(agent: Agent | undefined): AgentFormType {
    if (!agent) return 'humanoid'
    const lower = `${agent.name || ''} ${agent.id || ''}`.toLowerCase()
    if (lower.includes('duck') || lower.includes('vit')) return 'duck'
    if (lower.includes('amr') || lower.includes('agv') || lower.includes('xe')) return 'amr'
    if (lower.includes('drone') || lower.includes('fly')) return 'drone'
    return 'humanoid'
}

export default function OfficeChatPanel({
    agents,
    messages,
    input,
    setInput,
    targetAgentId,
    setTargetAgentId,
    onSendMessage,
    onRunWorkflowPreset,
    onClose,
    isDrawer = false,
}: OfficeChatPanelProps) {
    const chatEndRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages.length])

    const targetAgent = agents.find((a) => a.id === targetAgentId)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim()) return
        onSendMessage(input.trim(), targetAgentId || undefined)
        setInput('')
    }

    const quickPrompts = [
        {
            label: 'Hỏi P. Quản lý',
            text: '@agent_manager Hãy tổng hợp tình hình hoạt động của các phòng ban hôm nay.',
            icon: IconUser,
            color: 'border-amber-500/40 text-amber-300 bg-amber-500/10',
        },
        {
            label: 'Yêu cầu P. Nghiên cứu',
            text: '@agent_search Hãy tìm kiếm tài liệu và xu hướng AI Robotics mới nhất.',
            icon: IconSearch,
            color: 'border-sky-500/40 text-sky-300 bg-sky-500/10',
        },
        {
            label: 'Yêu cầu P. Phân tích',
            text: '@agent_analyst Hãy đánh giá các chỉ số hiệu năng và chất lượng KCS.',
            icon: IconBarChart,
            color: 'border-orange-500/40 text-orange-300 bg-orange-500/10',
        },
    ]

    return (
        <div className="flex h-full flex-col bg-zinc-950 border-l border-zinc-800 text-white select-none">
            {/* Header */}
            <div className="flex items-center justify-between p-3.5 border-b border-zinc-800/90 bg-zinc-900/50">
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#76b900] shadow-[0_0_8px_#76b900]" />
                    <div>
                        <h3 className="text-xs font-bold tracking-wide uppercase text-zinc-200">
                            Office Team Chat
                        </h3>
                        <p className="text-[10px] text-zinc-400">
                            Giao tiếp đa tác tử với các phòng ban
                        </p>
                    </div>
                </div>

                {isDrawer && onClose && (
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                    >
                        <IconX className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Target Agent Selector Bar */}
            <div className="p-2 border-b border-zinc-800/80 bg-zinc-900/20 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px]">
                <span className="shrink-0 text-[10px] uppercase font-bold text-zinc-500 px-1">
                    Gửi đến:
                </span>
                <button
                    type="button"
                    onClick={() => setTargetAgentId('')}
                    className={`shrink-0 px-2 py-0.5 rounded-lg border transition ${
                        !targetAgentId
                            ? 'bg-blue-600 border-blue-500 text-white font-semibold'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                >
                    Tất cả (@all)
                </button>
                {agents.map((ag) => {
                    const isSelected = targetAgentId === ag.id
                    const dept = detectAgentDepartment(ag)
                    const deptColor =
                        dept === 'management'
                            ? 'text-amber-400'
                            : dept === 'research'
                            ? 'text-sky-400'
                            : 'text-orange-400'

                    return (
                        <button
                            key={ag.id}
                            type="button"
                            onClick={() => setTargetAgentId(ag.id)}
                            className={`shrink-0 px-2 py-0.5 rounded-lg border flex items-center gap-1 transition ${
                                isSelected
                                    ? 'bg-zinc-800 border-zinc-600 text-white font-medium ring-1 ring-zinc-500'
                                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                        >
                            <span className={deptColor}>•</span>
                            <span>{ag.name}</span>
                        </button>
                    )
                })}
            </div>

            {/* Quick Prompts Bar */}
            <div className="px-3 py-1.5 bg-zinc-950/80 border-b border-zinc-800/60 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                {quickPrompts.map((qp, idx) => {
                    const Icon = qp.icon
                    return (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => {
                                setInput(qp.text)
                            }}
                            className={`shrink-0 text-[10px] font-medium px-2 py-1 rounded-lg border transition flex items-center gap-1 ${qp.color}`}
                        >
                            <Icon className="w-3 h-3" />
                            <span>{qp.label}</span>
                        </button>
                    )
                })}
            </div>

            {/* Message Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-zinc-800">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 text-xs">
                        <IconBot className="w-8 h-8 text-zinc-600 mb-2 stroke-1" />
                        <p className="font-semibold text-zinc-400">Chưa có tin nhắn nào</p>
                        <p className="mt-1 text-[11px] text-zinc-500 max-w-xs">
                            Gửi yêu cầu hoặc click vào một trong các gợi ý trên để bắt đầu giao tiếp với các Agent trong văn phòng.
                        </p>
                    </div>
                ) : (
                    messages.map((m) => {
                        const isUser = m.senderType === 'user'
                        const isSystem = m.senderType === 'system'

                        if (isSystem) {
                            return (
                                <div
                                    key={m.id}
                                    className="my-2 p-2 rounded-lg bg-zinc-900/60 border border-zinc-800 text-center text-[11px] text-zinc-400 font-mono"
                                >
                                    {m.content}
                                </div>
                            )
                        }

                        return (
                            <div
                                key={m.id}
                                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                            >
                                <div className="flex items-center gap-1.5 mb-1 text-[10px] text-zinc-400 font-mono">
                                    <span
                                        className="w-1.5 h-1.5 rounded-full"
                                        style={{ backgroundColor: m.agentColor || (isUser ? '#3b82f6' : '#76b900') }}
                                    />
                                    <span className="font-semibold text-zinc-300">{m.senderName}</span>
                                    <span>·</span>
                                    <span>{m.timestamp}</span>
                                </div>

                                <div
                                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-sm ${
                                        isUser
                                            ? 'bg-blue-600 text-white rounded-br-none'
                                            : m.isWorkflowTrace
                                            ? 'bg-indigo-950/40 border border-indigo-500/30 text-indigo-100 rounded-bl-none font-mono text-[11px]'
                                            : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-none'
                                    }`}
                                >
                                    {m.content}
                                </div>
                            </div>
                        )
                    })
                )}
                <div ref={chatEndRef} />
            </div>

            {/* Input Box */}
            <form onSubmit={handleSubmit} className="p-3 border-t border-zinc-800 bg-zinc-900/40">
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={
                            targetAgent
                                ? `Nhắn tin cho ${targetAgent.name}...`
                                : 'Nhập tin nhắn cho toàn bộ văn phòng (hoặc gõ @tên)...'
                        }
                        className="flex-1 bg-zinc-900 border border-zinc-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim()}
                        className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition shadow"
                    >
                        <IconSend className="w-4 h-4" />
                    </button>
                </div>
            </form>
        </div>
    )
}
