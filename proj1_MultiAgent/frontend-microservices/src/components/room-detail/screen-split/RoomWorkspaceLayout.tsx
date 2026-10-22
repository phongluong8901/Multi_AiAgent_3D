'use client'

import { Agent, Room, WorkflowTrace, ChatAttachment, ChatType } from '@/lib/api'
import { AgentAction } from '@/components/agents/Agent'
import { Workspace3DPanel } from '@/components/room-detail/Workspace3DPanel'
import { TeamChatPanel } from '@/components/room-detail/chat/TeamChatPanel'
import { MapType } from '@/components/Scene'

interface RoomWorkspaceLayoutProps {
    viewMode: 'split' | '3d' | 'chat'
    mapType: MapType
    roomAgents: Agent[]
    selected3dAgentId: string
    handleSelectAgent: (id: string) => void
    handleFloorClick: (point: [number, number, number]) => void
    agentTargetActions: Record<string, { action: AgentAction; targetPos: [number, number, number] }>
    handleTriggerAction: (agentId: string, action: AgentAction) => void
    messages: any[]
    chatLoading: boolean
    visibleOnlineUsers: any[]
    room: Room | null
    input: string
    setInput: React.Dispatch<React.SetStateAction<string>>
    targetAgentId: string
    setTargetAgentId: (val: string) => void
    mentionPopupOpen: boolean
    setMentionPopupOpen: (val: boolean) => void
    pipelineRunning: boolean
    runTeamPipeline: () => void
    handleSend: (
        e: React.FormEvent,
        attachment?: ChatAttachment,
        options?: { typeChat?: ChatType; targetAgentId?: string; targetUserId?: string }
    ) => void
    uploadAndAttachFile?: (file: File) => Promise<ChatAttachment | null> // <-- Bổ sung prop này
    setActiveTrace: (trace: WorkflowTrace) => void
    setTraceModalOpen: (open: boolean) => void
    chatEndRef: React.RefObject<HTMLDivElement | null>
    chatScrollRef: React.RefObject<HTMLDivElement | null>
    currentUserId: string
    currentUserName: string
}

export function RoomWorkspaceLayout({
    viewMode,
    mapType,
    roomAgents,
    selected3dAgentId,
    handleSelectAgent,
    handleFloorClick,
    agentTargetActions,
    handleTriggerAction,
    messages,
    chatLoading,
    visibleOnlineUsers,
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
    uploadAndAttachFile, // <-- Nhận prop này
    setActiveTrace,
    setTraceModalOpen,
    chatEndRef,
    chatScrollRef,
    currentUserId,
    currentUserName,
}: RoomWorkspaceLayoutProps) {
    return (
        <div className="relative flex min-h-0 flex-1">
            {(viewMode === '3d' || viewMode === 'split') && (
                <div
                    className={
                        viewMode === 'split'
                            ? 'relative hidden min-h-0 w-1/2 overflow-hidden border-r border-zinc-800 lg:block'
                            : 'relative min-h-0 w-full overflow-hidden'
                    }
                >
                    <Workspace3DPanel
                        mapType={mapType}
                        roomAgents={roomAgents}
                        selected3dAgentId={selected3dAgentId}
                        handleSelectAgent={handleSelectAgent}
                        handleFloorClick={handleFloorClick}
                        agentTargetActions={agentTargetActions}
                        handleTriggerAction={handleTriggerAction}
                    />
                </div>
            )}

            {(viewMode === 'chat' || viewMode === 'split') && (
                <div
                    className={
                        viewMode === 'split'
                            ? 'flex min-h-0 w-full flex-col overflow-hidden bg-zinc-950 lg:w-1/2'
                            : 'flex min-h-0 w-full flex-col overflow-hidden bg-zinc-950'
                    }
                >
                    <TeamChatPanel
                        messages={messages}
                        chatLoading={chatLoading}
                        onlineUsers={visibleOnlineUsers}
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
                        uploadAndAttachFile={uploadAndAttachFile} // <-- Truyền tiếp xuống TeamChatPanel
                        setActiveTrace={setActiveTrace}
                        setTraceModalOpen={setTraceModalOpen}
                        chatEndRef={chatEndRef}
                        chatScrollRef={chatScrollRef}
                        currentUserId={currentUserId}
                        currentUserName={currentUserName}
                    />
                </div>
            )}
        </div>
    )
}