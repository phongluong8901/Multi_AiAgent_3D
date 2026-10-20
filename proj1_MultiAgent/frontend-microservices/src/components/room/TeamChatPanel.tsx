'use client'

import React, { useRef, useState } from 'react'
import { ChatMessage, UserPresence, WorkflowTrace } from '@/lib/api'
import {
    IconZap,
    IconUsers,
    IconUser,
    IconBot,
    IconSparkles,
    IconSearch,
    IconBarChart,
    IconFileText,
    IconSend,
    IconMessageSquare,
    IconTrace,
    IconPaperclip,
    IconX,
} from '@/components/ui/icons'

interface TeamChatPanelProps {
    messages: ChatMessage[]
    chatLoading: boolean
    onlineUsers: UserPresence[]
    roomAgents: any[]
    room: any
    input: string
    setInput: (val: string | ((prev: string) => string)) => void
    targetAgentId: string
    setTargetAgentId: (id: string) => void
    mentionPopupOpen: boolean
    setMentionPopupOpen: (open: boolean) => void
    pipelineRunning: boolean
    runTeamPipeline: () => void
    handleSend: (e: React.FormEvent, attachment?: any) => void
    setActiveTrace: (trace: WorkflowTrace) => void
    setTraceModalOpen: (open: boolean) => void
    chatEndRef: React.RefObject<HTMLDivElement | null>
}

export function TeamChatPanel({
    messages,
    chatLoading,
    onlineUsers,
    roomAgents,
    room,
    input,
    setInput,
    targetAgentId,
    setTargetAgentId,
    mentionPopupOpen,
    setMentionPopupOpen,
    pipelineRunning,
    runTeamPipeline,
    handleSend,
    setActiveTrace,
    setTraceModalOpen,
    chatEndRef,
}: TeamChatPanelProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0])
        }
    }

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() && !selectedFile) return

        let attachmentPayload = undefined
        if (selectedFile) {
            const ext = selectedFile.name.split('.').pop()?.toLowerCase()
            let fileType: 'image' | 'csv' | 'xlsx' | 'pdf' | 'other' = 'other'
            if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '')) fileType = 'image'
            else if (ext === 'csv') fileType = 'csv'
            else if (['xlsx', 'xls'].includes(ext || '')) fileType = 'xlsx'
            else if (ext === 'pdf') fileType = 'pdf'

            attachmentPayload = {
                fileName: selectedFile.name,
                fileUrl: URL.createObjectURL(selectedFile),
                fileType,
                fileSize: selectedFile.size,
            }
        }

        handleSend(e, attachmentPayload)
        setSelectedFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setInput(val)
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

    return (
        <div className="flex flex-col h-full bg-zinc-950 w-full">
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
                        onClick={() => setInput('@agent_analyst Hãy phân tích file dữ liệu CSV/Excel mới tải lên')}
                        className="shrink-0 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition flex items-center gap-1.5"
                    >
                        <IconBarChart className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Phân tích dữ liệu</span>
                    </button>
                    <button
                        onClick={() => setInput('@agent_summarizer Hãy tóm tắt lại toàn bộ thảo luận của phòng')}
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
                    <div className="text-center py-12 text-zinc-500 text-xs">Đang đồng bộ tin nhắn phòng...</div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 mx-auto flex items-center justify-center text-zinc-400">
                            <IconMessageSquare className="w-6 h-6" />
                        </div>
                        <p className="text-zinc-400 text-xs font-medium">Chưa có tin nhắn trong phòng.</p>
                        <p className="text-zinc-500 text-[11px] max-w-sm mx-auto">
                            Gửi tin nhắn, đính kèm file <span className="text-emerald-400">.csv, .xlsx</span> hoặc gắn tag{' '}
                            <span className="text-blue-400">@agent_id</span> để bắt đầu!
                        </p>
                    </div>
                ) : (
                    messages.map((m: any, idx: number) => {
                        const isAgent = m.senderType === 'agent'
                        const isSystem = m.senderType === 'system'
                        const usedTools = m.metadata?.usedTools || []
                        const hasTrace = !!m.metadata?.workflowTrace
                        const attachment = m.attachment || m.metadata?.attachment

                        if (isSystem) {
                            return (
                                <div key={m._id || m.id || idx} className="text-center my-2">
                                    <span className="text-[11px] text-zinc-500 bg-zinc-900/60 border border-zinc-800/80 px-3 py-1 rounded-full">
                                        {m.message}
                                    </span>
                                </div>
                            )
                        }

                        const agentOwner = isAgent ? room?.userAgents?.find((b: any) => b.agentId === m.senderId) : null

                        return (
                            <div key={m._id || m.id || idx} className={`flex flex-col space-y-1.5 ${isAgent ? 'items-start' : 'items-end'}`}>
                                <div className="flex items-center gap-2 text-xs text-zinc-400">
                                    <span className={`font-semibold flex items-center gap-1 ${isAgent ? 'text-blue-400' : 'text-zinc-200'}`}>
                                        {isAgent ? <IconBot className="w-3.5 h-3.5 text-blue-400" /> : <IconUser className="w-3.5 h-3.5 text-zinc-300" />}
                                        <span>{m.senderName}</span>
                                    </span>
                                    {agentOwner && (
                                        <span className="text-[10px] text-blue-400 bg-blue-950/60 border border-blue-500/30 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                                            <IconUser className="w-2.5 h-2.5" />
                                            <span>của {agentOwner.userName}</span>
                                        </span>
                                    )}
                                    <span className="text-[10px] text-zinc-500">
                                        {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                    </span>
                                </div>

                                <div
                                    className={`rounded-2xl p-3.5 max-w-[88%] text-sm leading-relaxed border ${isAgent
                                        ? 'bg-zinc-900/90 text-zinc-200 border-zinc-800 shadow-md'
                                        : 'bg-blue-600 text-white border-blue-500 shadow-md'
                                        }`}
                                >
                                    {/* Hiển thị tệp đính kèm nếu có */}
                                    {attachment && (
                                        <div className="mb-2.5 p-2 rounded-xl bg-black/40 border border-white/10 flex items-center gap-2 text-xs">
                                            <IconPaperclip className="w-4 h-4 text-emerald-400 shrink-0" />
                                            <div className="flex-1 truncate">
                                                <span className="font-medium text-white">{attachment.fileName}</span>
                                                <span className="text-[10px] text-zinc-400 ml-2 uppercase">({attachment.fileType})</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="whitespace-pre-wrap">{m.message}</div>

                                    {usedTools && usedTools.length > 0 && (
                                        <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex flex-wrap items-center gap-1.5">
                                            <span className="text-[10px] uppercase font-bold text-zinc-400">Tool đã gọi:</span>
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
                    <span className="text-[11px] text-zinc-500 font-medium shrink-0">Giao tiếp với:</span>
                    <button
                        type="button"
                        onClick={() => {
                            setTargetAgentId('')
                            setInput((prev) => prev.replace(/^@[a-zA-Z0-9_-]+\s*/, ''))
                        }}
                        className={`shrink-0 px-2 py-0.5 rounded-lg text-xs font-medium border transition flex items-center gap-1 ${!targetAgentId
                            ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                            }`}
                    >
                        <IconUsers className="w-3 h-3" />
                        <span>Toàn phòng</span>
                    </button>
                    {roomAgents.map((ag: any) => {
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
                                className={`shrink-0 px-2 py-0.5 rounded-lg text-xs font-medium border transition flex items-center gap-1 ${isTarget
                                    ? 'bg-amber-600/30 text-amber-300 border-amber-500 shadow-sm'
                                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-amber-300'
                                    }`}
                            >
                                <IconBot className="w-3 h-3 text-amber-400" />
                                <span>@{ag.id.replace('agent_', '')}</span>
                            </button>
                        )
                    })}
                </div>

                {/* Mention Popup Menu */}
                {mentionPopupOpen && (
                    <div className="absolute bottom-full left-3 mb-2 w-64 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl p-1 z-30">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold px-2.5 py-1">
                            Chọn Agent để ra lệnh:
                        </div>
                        <div className="space-y-0.5">
                            {roomAgents.map((ag: any) => (
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

                {/* File preview khi chọn đính kèm */}
                {selectedFile && (
                    <div className="flex items-center justify-between bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800 text-xs">
                        <div className="flex items-center gap-2 truncate">
                            <IconPaperclip className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-zinc-200 font-medium truncate">{selectedFile.name}</span>
                            <span className="text-[10px] text-zinc-500">
                                ({(selectedFile.size / 1024).toFixed(1)} KB)
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSelectedFile(null)}
                            className="text-zinc-400 hover:text-white"
                        >
                            <IconX className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                <form onSubmit={onSubmit} className="space-y-2">
                    <div className="flex gap-2 items-center">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".csv, .xlsx, .xls, .pdf, image/*"
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition"
                            title="Đính kèm file (.csv, .xlsx, .pdf, ảnh)"
                        >
                            <IconPaperclip className="w-4 h-4" />
                        </button>

                        <input
                            value={input}
                            onChange={handleInputChange}
                            placeholder="Nhập tin nhắn trao đổi, đính kèm file hoặc gõ @ để ra lệnh..."
                            className="flex-1 rounded-xl bg-zinc-950 border border-zinc-700/80 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() && !selectedFile}
                            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2.5 shadow transition active:scale-95 flex items-center gap-1.5"
                        >
                            <IconSend className="w-4 h-4" />
                            <span>Gửi</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}