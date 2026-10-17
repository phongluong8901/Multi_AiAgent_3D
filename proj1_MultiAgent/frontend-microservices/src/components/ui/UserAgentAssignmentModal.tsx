'use client'

import { useState } from 'react'
import { Agent, UserAgentBinding, roomsApi, Room, UserPresence } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { IconUsers, IconUser, IconX, IconSparkles, IconPlus, IconBot } from './icons'

type Props = {
    roomId: string
    isOpen: boolean
    onClose: () => void
    allAgents: Agent[]
    activeAgentIds?: string[]
    userAgents: UserAgentBinding[]
    onlineUsers?: UserPresence[]
    onUpdate: (updatedRoom: Room) => void
}

export default function UserAgentAssignmentModal({
    roomId,
    isOpen,
    onClose,
    allAgents,
    activeAgentIds = [],
    userAgents,
    onlineUsers = [],
    onUpdate,
}: Props) {
    if (!isOpen) return null

    const currentUser = getUser()
    const [submitting, setSubmitting] = useState(false)
    const [selectedUserForAgent, setSelectedUserForAgent] = useState<Record<string, string>>({})

    const handleAssign = async (agent: Agent, targetUserId?: string, targetUserName?: string) => {
        const uId = targetUserId || currentUser?.id
        const uName = targetUserName || currentUser?.name || currentUser?.email || 'Thành viên'

        if (!uId) {
            alert('Vui lòng đăng nhập hoặc chọn thành viên!')
            return
        }

        setSubmitting(true)
        try {
            const updatedRoom = await roomsApi.assignUserAgent(roomId, {
                userId: uId,
                userName: uName,
                userColor: '#3b82f6',
                agentId: agent.id,
                agentName: agent.name,
            })
            onUpdate(updatedRoom)
        } catch (err: any) {
            alert(`Lỗi: ${err.message}`)
        } finally {
            setSubmitting(false)
        }
    }

    const handleRemoveAssignment = async (agentId: string) => {
        setSubmitting(true)
        try {
            const updatedRoom = await roomsApi.removeUserAgent(roomId, agentId)
            onUpdate(updatedRoom)
        } catch (err: any) {
            alert(`Lỗi: ${err.message}`)
        } finally {
            setSubmitting(false)
        }
    }

    const handleToggleRoomPresence = async (agentId: string, isInRoom: boolean) => {
        setSubmitting(true)
        try {
            let updatedRoom: Room
            if (isInRoom) {
                updatedRoom = await roomsApi.removeAgent(roomId, agentId)
            } else {
                updatedRoom = await roomsApi.addAgent(roomId, agentId)
            }
            onUpdate(updatedRoom)
        } catch (err: any) {
            alert(`Lỗi: ${err.message}`)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-2xl rounded-3xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-5 text-zinc-200 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                            <IconUsers className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white">
                                Quản Lý & Phân Bổ Agent Trong Phòng
                            </h3>
                            <p className="text-xs text-zinc-400">
                                Thêm/bớt Agent của các thành viên vào phòng, gán quyền sở hữu để ra lệnh chéo
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-zinc-400 hover:text-white transition w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center"
                    >
                        <IconX className="w-4 h-4" />
                    </button>
                </div>

                <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                    {allAgents.map((ag) => {
                        const inRoom = activeAgentIds.includes(ag.id)
                        const binding = userAgents.find((b) => b.agentId === ag.id)
                        const isMine = binding && currentUser && binding.userId === currentUser.id

                        return (
                            <div
                                key={ag.id}
                                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border transition ${
                                    inRoom
                                        ? 'bg-zinc-950 border-zinc-800/80 hover:border-zinc-700'
                                        : 'bg-zinc-950/40 border-zinc-900 opacity-60'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-4 h-4 rounded-full ring-2 ring-white/10 shrink-0"
                                        style={{ backgroundColor: ag.color || '#3b82f6' }}
                                    />
                                    <div>
                                        <div className="text-xs font-bold text-white flex items-center gap-2">
                                            <span>{ag.name}</span>
                                            <span className="text-[10px] text-zinc-500 font-mono">@{ag.id}</span>
                                            <span
                                                className={`text-[9px] px-1.5 py-0.2 rounded font-medium border ${
                                                    inRoom
                                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                        : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                                }`}
                                            >
                                                {inRoom ? 'Đang trong phòng' : 'Chưa vào phòng'}
                                            </span>
                                        </div>
                                        <div className="text-[11px] mt-0.5">
                                            {binding ? (
                                                <span className="text-blue-400 font-medium flex items-center gap-1">
                                                    <IconUser className="w-3 h-3 inline" />
                                                    <span>Thuộc quyền: <strong>{binding.userName}</strong> {isMine ? '(Bạn)' : ''}</span>
                                                </span>
                                            ) : (
                                                <span className="text-zinc-500 italic">Chưa ai nhận quản lý</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
                                    {/* Nút thêm/bớt khỏi phòng */}
                                    <button
                                        onClick={() => handleToggleRoomPresence(ag.id, inRoom)}
                                        disabled={submitting}
                                        className={`text-xs px-2.5 py-1.5 rounded-xl border font-medium transition ${
                                            inRoom
                                                ? 'bg-zinc-900 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-300 border-zinc-800'
                                                : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500'
                                        }`}
                                    >
                                        {inRoom ? 'Rút khỏi phòng' : '+ Vào phòng'}
                                    </button>

                                    {/* Quản lý quyền sở hữu */}
                                    {inRoom && (
                                        <>
                                            {isMine ? (
                                                <button
                                                    onClick={() => handleRemoveAssignment(ag.id)}
                                                    disabled={submitting}
                                                    className="text-xs px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-rose-900/40 hover:text-rose-300 text-zinc-400 border border-zinc-700 transition font-medium"
                                                >
                                                    Hủy sở hữu
                                                </button>
                                            ) : binding ? (
                                                <button
                                                    onClick={() => handleAssign(ag)}
                                                    disabled={submitting}
                                                    className="text-xs px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition font-medium"
                                                >
                                                    Chuyển sang tôi
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleAssign(ag)}
                                                    disabled={submitting}
                                                    className="text-xs px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow transition active:scale-95 flex items-center gap-1.5"
                                                >
                                                    <IconPlus className="w-3.5 h-3.5" />
                                                    <span>Nhận Agent này</span>
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="p-3.5 rounded-2xl bg-blue-950/20 border border-blue-500/30 text-xs text-blue-300 flex items-start gap-2.5 shrink-0">
                    <IconSparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                        <strong>Giao tiếp đa chiều:</strong> Bạn có thể thêm bất kỳ Agent nào vào phòng, nhận quản lý riêng hoặc ra lệnh chéo cho Agent của người khác qua cú pháp <code className="bg-blue-900/40 px-1 rounded">@agent_id</code>!
                    </div>
                </div>
            </div>
        </div>
    )
}
