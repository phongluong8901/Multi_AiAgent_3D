'use client'

import React, { useRef, useState } from 'react'
import { ChatMessage, UserPresence, WorkflowTrace, ChatAttachment } from '@/lib/api'
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
    handleSend: (e: React.FormEvent, attachment?: ChatAttachment) => void
    uploadAndAttachFile?: (file: File) => Promise<ChatAttachment | null>
    setActiveTrace: (trace: WorkflowTrace) => void
    setTraceModalOpen: (open: boolean) => void
    chatEndRef: React.RefObject<HTMLDivElement | null>
    chatScrollRef?: React.RefObject<HTMLDivElement | null>
    currentUserId?: string
    currentUserName?: string
}

type ChatTab = 'user-user' | 'user-agent' | 'agent-agent'

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
    uploadAndAttachFile,
    setActiveTrace,
    setTraceModalOpen,
    chatEndRef,
    chatScrollRef,
    currentUserId = '',
    currentUserName = '',
}: TeamChatPanelProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [activeTab, setActiveTab] = useState<ChatTab>('user-user')
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) setSelectedFile(e.target.files[0])
    }

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        console.log("1. Đã bấm gửi, input:", input, "selectedFile:", selectedFile)

        if (!input.trim() && !selectedFile) return

        let uploadedAttachment: ChatAttachment | undefined = undefined

        if (selectedFile) {
            try {
                setUploading(true)
                console.log("2. Đang tiến hành gọi uploadAndAttachFile...")

                if (uploadAndAttachFile) {
                    const result = await uploadAndAttachFile(selectedFile)
                    console.log("3. Kết quả trả về từ uploadAndAttachFile:", result)

                    if (result) {
                        uploadedAttachment = result
                    } else {
                        console.warn("⚠️ Upload trả về null/undefined, kiểm tra lại API upload trên server.")
                    }
                } else {
                    console.error("❌ Hàm uploadAndAttachFile chưa được truyền vào props của TeamChatPanel!")
                }
            } catch (err: any) {
                // IN CHI TIẾT LỖI RA CONSOLE ĐỂ BIẾT NGUYÊN NHÂN (CORS, 401, 500,...)
                console.error('❌ Lỗi chi tiết khi upload file lên Cloudinary:', err)
                alert(`Không thể tải file lên: ${err.message || 'Lỗi không xác định'}`)
                setUploading(false)
                return // Dừng lại không gửi tin nhắn rác nếu upload thất bại
            } finally {
                setUploading(false)
            }
        }

        console.log("4. Gọi handleSend với attachment:", uploadedAttachment)
        handleSend(e, uploadedAttachment)
        setSelectedFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setInput(val)
        const last = val.split(' ').pop() || ''
        setMentionPopupOpen(last.startsWith('@'))
    }

    const selectMention = (agentId: string) => {
        const words = input.split(' ')
        words[words.length - 1] = `@${agentId} `
        setInput(words.join(' '))
        setTargetAgentId(agentId)
        setMentionPopupOpen(false)
    }

    const filteredMessages = messages.filter((m: any) => {
        const senderType = m.senderType
        const isAgent = senderType === 'agent'
        const isSystem = senderType === 'system'
        const isUser = !isAgent && !isSystem

        if (activeTab === 'user-user') {
            return isUser || isSystem
        }
        if (activeTab === 'user-agent') {
            const target = m.targetAgentId || m.metadata?.targetAgentId
            return (isUser && (target || m.message.includes('@'))) || (isAgent && !m.metadata?.isAgentToAgent)
        }
        if (activeTab === 'agent-agent') {
            return isAgent && (m.metadata?.isAgentToAgent || m.metadata?.workflowTrace || m.senderId?.startsWith('agent_'))
        }
        return true
    })

    return (
        <div className="flex h-full min-h-0 w-full flex-col bg-zinc-950">
            {/* Tabs chuyển đổi vùng chat */}
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-3 py-2">
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => setActiveTab('user-user')}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${activeTab === 'user-user'
                            ? 'bg-blue-600 text-white shadow'
                            : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                            }`}
                    >
                        <IconUsers className="h-3.5 w-3.5" />
                        Thành viên ({onlineUsers.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('user-agent')}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${activeTab === 'user-agent'
                            ? 'bg-amber-600 text-white shadow'
                            : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                            }`}
                    >
                        <IconBot className="h-3.5 w-3.5" />
                        Hỏi đáp Agent
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('agent-agent')}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${activeTab === 'agent-agent'
                            ? 'bg-indigo-600 text-white shadow'
                            : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                            }`}
                    >
                        <IconSparkles className="h-3.5 w-3.5" />
                        Agent Team Pipeline
                    </button>
                </div>
            </div>

            {/* Quick Actions */}
            {activeTab !== 'user-user' && (
                <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-zinc-800/80 bg-zinc-900/40 p-3 scrollbar-none">
                    <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-zinc-500">
                        <IconZap className="h-3.5 w-3.5 text-amber-400" />
                        Giao việc:
                    </span>
                    <button
                        type="button"
                        onClick={runTeamPipeline}
                        disabled={pipelineRunning}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-600/20 px-2.5 py-1 text-xs font-medium text-indigo-300 transition hover:bg-indigo-600/30 disabled:opacity-50"
                    >
                        <IconSparkles className="h-3.5 w-3.5" />
                        Team Pipeline
                    </button>
                    <button
                        type="button"
                        onClick={() => setInput('@agent_search Hãy tra cứu xu hướng AI Agents mới nhất năm 2026')}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                    >
                        <IconSearch className="h-3.5 w-3.5 text-zinc-400" />
                        Tra cứu
                    </button>
                    <button
                        type="button"
                        onClick={() => setInput('@agent_analyst Hãy phân tích file dataset CSV/Excel mới tải lên')}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                    >
                        <IconBarChart className="h-3.5 w-3.5 text-zinc-400" />
                        Phân tích
                    </button>
                    <button
                        type="button"
                        onClick={() => setInput('@agent_summarizer Hãy tóm tắt lại toàn bộ thảo luận của phòng')}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                    >
                        <IconFileText className="h-3.5 w-3.5 text-zinc-400" />
                        Tóm tắt
                    </button>
                </div>
            )}

            {/* Danh sách tin nhắn */}
            <div ref={chatScrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                {chatLoading ? (
                    <p className="py-12 text-center text-xs text-zinc-500">Đang đồng bộ tin nhắn...</p>
                ) : filteredMessages.length === 0 ? (
                    <div className="space-y-2 py-12 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-400">
                            <IconMessageSquare className="h-6 w-6" />
                        </div>
                        <p className="text-xs font-medium text-zinc-400">Chưa có tin nhắn trong kênh này</p>
                    </div>
                ) : (
                    filteredMessages.map((m: any, idx: number) => {
                        const isAgent = m.senderType === 'agent'
                        const isSystem = m.senderType === 'system'
                        const isMe =
                            !isAgent &&
                            !isSystem &&
                            ((!!currentUserId && m.senderId === currentUserId) ||
                                (!!currentUserName && m.senderName?.toLowerCase() === currentUserName.toLowerCase()))

                        const usedTools = m.metadata?.usedTools || []
                        const hasTrace = !!m.metadata?.workflowTrace
                        const attachments: ChatAttachment[] = m.attachments || (m.attachment ? [m.attachment] : [])
                        const agentOwner = isAgent
                            ? room?.userAgents?.find((b: any) => b.agentId === m.senderId)
                            : null

                        if (isSystem) {
                            return (
                                <div key={m._id || m.id || idx} className="my-2 text-center">
                                    <span className="rounded-full border border-zinc-800/80 bg-zinc-900/60 px-3 py-1 text-[11px] text-zinc-500">
                                        {m.message}
                                    </span>
                                </div>
                            )
                        }

                        return (
                            <div key={m._id || m.id || idx} className={`flex flex-col space-y-1.5 ${isMe ? 'items-end' : 'items-start'}`}>
                                <div className="flex items-center gap-2 text-xs text-zinc-400">
                                    <span className={`flex items-center gap-1 font-semibold ${isAgent ? 'text-blue-400' : isMe ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {isAgent ? <IconBot className="h-3.5 w-3.5" /> : <IconUser className="h-3.5 w-3.5" />}
                                        {isMe ? 'Bạn' : m.senderName}
                                    </span>
                                    {agentOwner && (
                                        <span className="rounded border border-blue-500/30 bg-blue-950/60 px-1.5 text-[10px] text-blue-400">
                                            của {agentOwner.userName}
                                        </span>
                                    )}
                                    <span className="text-[10px] text-zinc-500">
                                        {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                    </span>
                                </div>

                                <div className={`max-w-[88%] rounded-2xl border p-3.5 text-sm leading-relaxed shadow-md ${isAgent ? 'border-zinc-800 bg-zinc-900/90 text-zinc-200' : isMe ? 'border-blue-500 bg-blue-600 text-white' : 'border-zinc-700 bg-zinc-800 text-zinc-100'}`}>
                                    {/* Render danh sách attachments (Ảnh & Document/CSV/Excel) */}
                                    {attachments && attachments.length > 0 && (
                                        <div className="mb-2.5 flex flex-col gap-2">
                                            {attachments.map((att, attIdx) => {
                                                const isImg = att.category === 'image' || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(att.extension?.toLowerCase() || '')
                                                if (isImg) {
                                                    return (
                                                        <div key={attIdx} className="overflow-hidden rounded-xl border border-white/10 bg-black/40 p-1">
                                                            <a href={att.fileUrl} target="_blank" rel="noreferrer" title="Click để xem kích thước đầy đủ">
                                                                <img
                                                                    src={att.fileUrl}
                                                                    alt={att.fileName}
                                                                    className="max-h-60 w-auto rounded-lg object-contain transition hover:opacity-90"
                                                                    loading="lazy"
                                                                />
                                                            </a>
                                                            <div className="flex items-center justify-between px-1.5 pt-1 text-[11px] text-zinc-300">
                                                                <span className="truncate max-w-[180px] font-medium">{att.fileName}</span>
                                                                <span className="text-[10px] uppercase text-zinc-400 font-mono">{att.extension}</span>
                                                            </div>
                                                        </div>
                                                    )
                                                }
                                                return (
                                                    <div key={attIdx} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 p-2 text-xs">
                                                        <IconPaperclip className="h-4 w-4 shrink-0 text-emerald-400" />
                                                        <a href={att.fileUrl} target="_blank" rel="noreferrer" className="truncate font-medium underline hover:text-blue-300">
                                                            {att.fileName}
                                                        </a>
                                                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase text-zinc-300">
                                                            {att.category} ({att.extension})
                                                        </span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}

                                    <div className="whitespace-pre-wrap">{m.message}</div>

                                    {usedTools.length > 0 && (
                                        <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-zinc-800/80 pt-2">
                                            <span className="text-[10px] font-bold uppercase text-zinc-400">Tool:</span>
                                            {usedTools.map((t: string, i: number) => (
                                                <span key={i} className="rounded-md border border-zinc-700/80 bg-zinc-950 px-2 py-0.5 font-mono text-[10px] text-amber-300">
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {isAgent && hasTrace && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setActiveTrace(m.metadata.workflowTrace)
                                                setTraceModalOpen(true)
                                            }}
                                            className="mt-2 flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300"
                                        >
                                            <IconTrace className="h-3.5 w-3.5" />
                                            Xem Workflow Trace
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}
                <div ref={chatEndRef} />
            </div>

            {/* Composer / Input Bar */}
            <div className="relative shrink-0 space-y-2 border-t border-zinc-800 bg-zinc-900/90 p-3 backdrop-blur">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
                    <span className="shrink-0 text-[11px] text-zinc-500">Gửi tới:</span>
                    <button
                        type="button"
                        onClick={() => {
                            setTargetAgentId('')
                            setInput((p) => p.replace(/^@[a-zA-Z0-9_-]+\s*/, ''))
                        }}
                        className={`flex shrink-0 items-center gap-1 rounded-lg border px-2 py-0.5 font-medium transition ${!targetAgentId ? 'border-blue-500 bg-blue-600 text-white' : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'}`}
                    >
                        <IconUsers className="h-3 w-3" />
                        Toàn phòng
                    </button>
                    {roomAgents.map((ag: any) => (
                        <button
                            key={ag.id}
                            type="button"
                            onClick={() => {
                                setTargetAgentId(ag.id)
                                setInput((p) => {
                                    const clean = p.replace(/^@[a-zA-Z0-9_-]+\s*/, '')
                                    return `@${ag.id} ${clean}`
                                })
                            }}
                            className={`flex shrink-0 items-center gap-1 rounded-lg border px-2 py-0.5 font-medium transition ${targetAgentId === ag.id ? 'border-amber-500 bg-amber-600/30 text-amber-300' : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-amber-300'}`}
                        >
                            <IconBot className="h-3 w-3 text-amber-400" />
                            @{ag.id.replace('agent_', '')}
                        </button>
                    ))}
                </div>

                {mentionPopupOpen && (
                    <div className="absolute bottom-full left-3 z-30 mb-2 w-64 rounded-xl border border-zinc-700 bg-zinc-900 p-1 shadow-2xl">
                        <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Chọn agent</div>
                        {roomAgents.map((ag: any) => (
                            <button
                                key={ag.id}
                                type="button"
                                onClick={() => selectMention(ag.id)}
                                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-zinc-200 hover:bg-zinc-800"
                            >
                                <span>@{ag.id}</span>
                                <span className="text-[10px] text-zinc-500">{ag.name}</span>
                            </button>
                        ))}
                    </div>
                )}

                {selectedFile && (
                    <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs">
                        <span className="flex items-center gap-2 truncate">
                            <IconPaperclip className="h-3.5 w-3.5 text-emerald-400" />
                            <span className="truncate font-medium text-zinc-200">{selectedFile.name}</span>
                            <span className="text-[10px] text-zinc-500">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                        </span>
                        <button type="button" onClick={() => setSelectedFile(null)} className="text-zinc-400 hover:text-white">
                            <IconX className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}

                <form onSubmit={onSubmit} className="flex items-center gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls,.pdf,image/*"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-zinc-400 transition hover:border-zinc-700 hover:text-white"
                        title="Đính kèm file hoặc ảnh"
                    >
                        <IconPaperclip className="h-4 w-4" />
                    </button>
                    <input
                        value={input}
                        onChange={handleInputChange}
                        placeholder={activeTab === 'user-user' ? 'Nhập tin nhắn trao đổi với thành viên...' : 'Nhập tin nhắn hoặc @agent...'}
                        className="flex-1 rounded-xl border border-zinc-700/80 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                    />
                    <button
                        type="submit"
                        disabled={(!input.trim() && !selectedFile) || uploading}
                        className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40"
                    >
                        <IconSend className="h-4 w-4" />
                        {uploading ? 'Đang tải...' : 'Gửi'}
                    </button>
                </form>
            </div>
        </div>
    )
}