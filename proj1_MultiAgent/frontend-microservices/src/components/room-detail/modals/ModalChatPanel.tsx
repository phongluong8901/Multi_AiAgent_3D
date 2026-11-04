'use client'

import React from 'react'
import { TeamChatPanel } from '../chat/TeamChatPanel'
import { IconX, IconMessageSquare } from '@/components/ui/icons'

interface ModalChatPanelProps {
    isOpen: boolean
    onClose: () => void
    roomId: string
    room: any
    messages: any[]
    chatLoading: boolean
    onlineUsers: any[]
    roomAgents: any[]
    input: string
    setInput: (val: string | ((prev: string) => string)) => void
    targetAgentId: string
    setTargetAgentId: (id: string) => void
    mentionPopupOpen: boolean
    setMentionPopupOpen: (open: boolean) => void
    pipelineRunning: boolean
    runTeamPipeline: () => void
    handleSend: (e: React.FormEvent, attachment?: any) => void
    setActiveTrace: (trace: any) => void
    setTraceModalOpen: (open: boolean) => void
    chatEndRef: React.RefObject<HTMLDivElement | null>
}

export function ModalChatPanel({
    isOpen,
    onClose,
    room,
    messages,
    chatLoading,
    onlineUsers,
    roomAgents,
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
}: ModalChatPanelProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-2xl h-[80vh] rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl flex flex-col overflow-hidden">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                            <IconMessageSquare className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white">Thảo luận nhóm phòng: {room?.name || ''}</h3>
                            <p className="text-[10px] text-zinc-400">Trò chuyện trực tuyến & Tương tác Agent</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-zinc-400 hover:text-white w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center transition"
                    >
                        <IconX className="w-4 h-4" />
                    </button>
                </div>

                {/* Modal Body / Chat Panel */}
                <div className="flex-1 overflow-hidden flex flex-col">
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
            </div>
        </div>
    )
}