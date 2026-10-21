'use client'

import { useState } from 'react'
import { Agent, Room, UserPresence, WorkflowTrace, roomsApi } from '@/lib/api'
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
    const [activeTab, setActiveTab] = useState<'members' | 'agents'>('members')

    // Hàm đá/xóa thành viên ra khỏi phòng
    const handleRemoveMember = async (memberId: string) => {
        if (!confirm(`Xóa thành viên ${memberId} khỏi phòng này?`)) return
        try {
            const updated = await roomsApi.removeMember(roomId, memberId)
            setRoom(updated) // bắt buộc — cập nhật list members ngay
        } catch (err: any) {
            alert(`Lỗi khi xóa thành viên: ${err.message}`)
        }
    }

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

            {/* Modal Quản lý Thành viên (Zalo style) & Phân bổ Agent */}
            {assignmentModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-xl rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-semibold text-white">Quản lý Phòng</h3>
                                <div className="flex items-center p-0.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs ml-4">
                                    <button
                                        onClick={() => setActiveTab('members')}
                                        className={`px-3 py-1 rounded-md transition font-medium ${activeTab === 'members' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
                                            }`}
                                    >
                                        Thành viên ({room?.members?.length || 1})
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('agents')}
                                        className={`px-3 py-1 rounded-md transition font-medium ${activeTab === 'agents' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
                                            }`}
                                    >
                                        Phân bổ Agent
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={() => setAssignmentModalOpen(false)}
                                className="text-zinc-400 hover:text-white w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center transition"
                            >
                                <IconX className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Nội dung tab Thành viên */}
                        {activeTab === 'members' ? (
                            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                                <div className="text-xs text-zinc-400">
                                    Danh sách thành viên tham gia phòng và quản lý quyền hạn (Chủ phòng / Quản trị viên).
                                </div>

                                <div className="space-y-2">
                                    {/* Hiển thị chủ phòng (Owner) */}
                                    <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-blue-500/30">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500 text-blue-400 flex items-center justify-center font-bold text-xs">
                                                {room?.ownerId?.charAt(0).toUpperCase() || 'O'}
                                            </div>
                                            <div>
                                                <div className="font-medium text-xs text-white flex items-center gap-1.5">
                                                    <span>{room?.ownerId || 'System Owner'}</span>
                                                    <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-mono">
                                                        Owner
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-zinc-500">Chủ sở hữu phòng</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Hiển thị danh sách các thành viên khác trong mảng room.members */}
                                    {room?.members?.map((m: any, idx: number) => {
                                        if (m.memberId === room?.ownerId) return null
                                        return (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center font-bold text-xs">
                                                        {m.memberId?.charAt(0).toUpperCase() || 'U'}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-xs text-white flex items-center gap-1.5">
                                                            <span>{m.memberId}</span>
                                                            <span className="text-[10px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded font-mono uppercase">
                                                                {m.role || 'participant'}
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-zinc-500">Loại: {m.memberType || 'user'}</div>
                                                    </div>
                                                </div>

                                                {/* Nút đá/xóa thành viên sử dụng IconX */}
                                                <button
                                                    onClick={() => handleRemoveMember(m.memberId)}
                                                    className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium transition flex items-center gap-1"
                                                    title="Xóa/Đá thành viên ra khỏi phòng"
                                                >
                                                    <IconX className="w-3.5 h-3.5" />
                                                    <span>Xóa</span>
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ) : (
                            /* Nội dung tab Phân bổ Agent */
                            <div className="max-h-80 overflow-y-auto">
                                <UserAgentAssignmentModal
                                    roomId={roomId}
                                    isOpen={true}
                                    onClose={() => setAssignmentModalOpen(false)}
                                    allAgents={allAgents}
                                    activeAgentIds={room?.activeAgents || []}
                                    userAgents={room?.userAgents || []}
                                    onlineUsers={onlineUsers}
                                    onUpdate={(updatedRoom) => setRoom(updatedRoom)}
                                />
                            </div>
                        )}
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
        </>
    )
}