'use client'

import { Agent, Room, UserPresence, WorkflowTrace } from '@/lib/api'
import WorkflowTraceModal from '@/components/ui/WorkflowTraceModal'
import UserAgentAssignmentModal from '@/components/ui/UserAgentAssignmentModal'
import { IconX, IconPlus } from '@/components/ui/icons'

interface ModalsContainerProps {
    roomId: string
    room: Room | null
    allAgents: Agent[]
    onlineUsers: UserPresence[]
    addAgentModalOpen: boolean
    setAddAgentModalOpen: (open: boolean) => void
    handleAddAgentToRoom: (agentId: string) => void
    traceModalOpen: boolean
    setTraceModalOpen: (open: boolean) => void
    activeTrace: WorkflowTrace | null
    latestTraces: Record<string, WorkflowTrace>
    setActiveTrace: (trace: WorkflowTrace) => void
    assignmentModalOpen: boolean
    setAssignmentModalOpen: (open: boolean) => void
    setRoom: (room: Room) => void
}

export function ModalsContainer({
    roomId,
    room,
    allAgents,
    onlineUsers,
    addAgentModalOpen,
    setAddAgentModalOpen,
    handleAddAgentToRoom,
    traceModalOpen,
    setTraceModalOpen,
    activeTrace,
    latestTraces,
    setActiveTrace,
    assignmentModalOpen,
    setAssignmentModalOpen,
    setRoom,
}: ModalsContainerProps) {
    return (
        <>
            {/* Modal Thêm Agent vào phòng */}
            {addAgentModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                            <h3 className="text-base font-semibold text-white">Thêm Agent vào Phòng</h3>
                            <button
                                onClick={() => setAddAgentModalOpen(false)}
                                className="text-zinc-400 hover:text-white w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center transition"
                            >
                                <IconX className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
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
                                            <span className="text-[11px] text-zinc-500 font-medium px-2 py-1 bg-zinc-900 rounded-lg">
                                                Đã trong phòng
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => handleAddAgentToRoom(ag.id)}
                                                className="text-xs px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition flex items-center gap-1 active:scale-95"
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

            {/* Modal Phân Bổ & Gán Agent cho từng User */}
            <UserAgentAssignmentModal
                roomId={roomId}
                isOpen={assignmentModalOpen}
                onClose={() => setAssignmentModalOpen(false)}
                allAgents={allAgents}
                activeAgentIds={room?.activeAgents || []}
                userAgents={room?.userAgents || []}
                onlineUsers={onlineUsers}
                onUpdate={(updatedRoom) => setRoom(updatedRoom)}
            />
        </>
    )
}