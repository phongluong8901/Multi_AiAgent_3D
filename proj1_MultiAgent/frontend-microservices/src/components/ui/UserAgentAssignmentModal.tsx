'use client'

import { useState } from 'react'
import { Agent, UserAgentBinding, roomsApi, Room, UserPresence } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { IconUsers, IconUser, IconX, IconSparkles, IconBot, IconGlobe, IconCpu, IconFileText } from './icons'
import { toast } from 'sonner'

type Props = {
    roomId: string
    isOpen: boolean
    onClose: () => void
    allAgents: Agent[]
    activeAgentIds?: string[]
    userAgents: UserAgentBinding[]
    onlineUsers?: UserPresence[]
    room?: Room | null
    onUpdate: (updatedRoom: Room) => void
    isEmbedded?: boolean
}

export default function UserAgentAssignmentModal({
    roomId,
    isOpen,
    onClose,
    allAgents,
    activeAgentIds = [],
    userAgents,
    room,
    onUpdate,
    isEmbedded = false,
}: Props) {
    if (!isOpen) return null

    const currentUser = getUser()
    const [submitting, setSubmitting] = useState(false)

    // Tạo danh sách thành viên hợp lệ để gán
    const availableAssignees: { id: string; name: string; isOwner?: boolean }[] = []
    const seenUserIds = new Set<string>()

    if (room?.ownerId) {
        seenUserIds.add(room.ownerId)
        availableAssignees.push({
            id: room.ownerId,
            name: `${room.ownerId} (Chủ phòng)`,
            isOwner: true,
        })
    }

    for (const m of room?.members || []) {
        if (!seenUserIds.has(m.memberId)) {
            seenUserIds.add(m.memberId)
            availableAssignees.push({
                id: m.memberId,
                name: m.name || m.memberId,
            })
        }
    }

    // Đếm số lượng agent theo từng user
    const agentCountByUser: Record<string, number> = {}
    let sharedAgentCount = 0
    for (const agId of activeAgentIds) {
        const binding = userAgents.find((b) => b.agentId === agId)
        if (binding?.userId) {
            agentCountByUser[binding.userId] = (agentCountByUser[binding.userId] || 0) + 1
        } else {
            sharedAgentCount++
        }
    }

    const handleAssignChange = async (agent: Agent, newUserId: string) => {
        setSubmitting(true)
        try {
            let updatedRoom: Room
            if (!newUserId) {
                // Hủy gán -> Chuyển về dùng chung
                updatedRoom = await roomsApi.removeUserAgent(roomId, agent.id)
            } else {
                const assignee = availableAssignees.find((u) => u.id === newUserId)
                const assigneeName = assignee?.name?.replace(' (Chủ phòng)', '') || newUserId
                updatedRoom = await roomsApi.assignUserAgent(roomId, {
                    userId: newUserId,
                    userName: assigneeName,
                    userColor: '#3b82f6',
                    agentId: agent.id,
                    agentName: agent.name,
                })
            }
            onUpdate(updatedRoom)
            toast.success('Đã cập nhật phân bổ agent')
        } catch (err: any) {
            toast.error(`Lỗi phân bổ agent: ${err.message}`)
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
            toast.success(isInRoom ? 'Đã gỡ agent khỏi phòng' : 'Đã thêm agent vào phòng')
        } catch (err: any) {
            toast.error(`Lỗi: ${err.message}`)
        } finally {
            setSubmitting(false)
        }
    }

    const renderContent = () => (
        <div className="space-y-4 flex flex-col flex-1 min-h-0">
            {/* Thanh tóm tắt số lượng agent theo mỗi User */}
            <div className="p-3 rounded-2xl bg-zinc-950/90 border border-zinc-800 shrink-0">
                <div className="text-[11px] font-medium text-zinc-400 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-semibold text-zinc-300">
                        <IconBot className="w-3.5 h-3.5 text-blue-400" />
                        <span>Thống kê phân bổ Agent theo User:</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                        {activeAgentIds.length} đang trong phòng / {allAgents.length} tổng số
                    </span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                    {availableAssignees.map((user) => {
                        const count = agentCountByUser[user.id] || 0
                        const isMe = currentUser?.id === user.id
                        return (
                            <div
                                key={user.id}
                                className={`px-2.5 py-1 rounded-xl border flex items-center gap-1.5 transition ${
                                    count > 0
                                        ? 'bg-blue-600/15 border-blue-500/40 text-blue-300'
                                        : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                                }`}
                            >
                                <IconUser className="w-3 h-3 text-blue-400" />
                                <span className="font-medium truncate max-w-[120px]">
                                    {user.name} {isMe ? '(Bạn)' : ''}:
                                </span>
                                <span className="font-bold px-1.5 py-0.2 bg-blue-500/20 text-blue-300 rounded-md font-mono text-[10px]">
                                    {count} Agent
                                </span>
                            </div>
                        )
                    })}
                    <div className="px-2.5 py-1 rounded-xl border bg-zinc-900 border-zinc-800 text-zinc-400 flex items-center gap-1.5">
                        <IconGlobe className="w-3 h-3 text-zinc-400 shrink-0" />
                        <span className="text-zinc-400 font-medium">Dùng chung:</span>
                        <span className="font-bold px-1.5 py-0.2 bg-zinc-800 text-zinc-300 rounded-md font-mono text-[10px]">
                            {sharedAgentCount} Agent
                        </span>
                    </div>
                </div>
            </div>

            {/* Danh sách các Agent với UI tinh gọn: Không nút trùng lặp */}
            <div className="space-y-2.5 overflow-y-auto pr-1 flex-1">
                {allAgents.map((ag) => {
                    const inRoom = activeAgentIds.includes(ag.id)
                    const binding = userAgents.find((b) => b.agentId === ag.id)
                    const currentAssignedUserId = binding?.userId || ''

                    return (
                        <div
                            key={ag.id}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border transition ${
                                inRoom
                                    ? 'bg-zinc-950/90 border-zinc-800/80 hover:border-zinc-700'
                                    : 'bg-zinc-950/40 border-zinc-900 opacity-60'
                            }`}
                        >
                            {/* Cột 1: Thông tin Agent */}
                            <div className="flex items-center gap-3 min-w-0">
                                <div
                                    className="w-4 h-4 rounded-full ring-2 ring-white/10 shrink-0"
                                    style={{ backgroundColor: ag.color || '#3b82f6' }}
                                />
                                <div className="min-w-0">
                                    <div className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
                                        <span>{ag.name}</span>
                                        <span className="text-[10px] text-zinc-500 font-mono">@{ag.id}</span>
                                        {ag.model && (
                                            <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-md font-mono inline-flex items-center gap-1">
                                                <IconCpu className="w-2.5 h-2.5 text-emerald-400" />
                                                <span>{ag.model}</span>
                                            </span>
                                        )}
                                        {ag.prompt_id && (
                                            <span className="text-[9px] bg-blue-500/15 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1">
                                                <IconFileText className="w-2.5 h-2.5 text-blue-400" />
                                                <span>{ag.prompt_id}</span>
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[11px] text-zinc-400 truncate max-w-sm mt-0.5">
                                        {ag.description || ag.speech || 'Chuyên gia AI tự hành'}
                                    </div>
                                </div>
                            </div>

                            {/* Cột 2: Điều khiển tinh gọn (Trạng thái trong phòng & Chọn người quản lý) */}
                            <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                                {/* Chọn Người phụ trách (Dropdown duy nhất, thay thế loạt nút trùng lặp) */}
                                {inRoom && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] text-zinc-400 font-medium">Gán cho:</span>
                                        <select
                                            disabled={submitting}
                                            value={currentAssignedUserId}
                                            onChange={(e) => handleAssignChange(ag, e.target.value)}
                                            className="text-xs bg-zinc-900 border border-zinc-700 hover:border-blue-500 text-zinc-200 rounded-xl px-2.5 py-1.5 outline-none font-medium transition cursor-pointer"
                                        >
                                            <option value="">Dùng chung (Tất cả)</option>
                                            {availableAssignees.map((u) => (
                                                <option key={u.id} value={u.id}>
                                                    {u.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Nút bật/tắt hiện diện trong phòng */}
                                <button
                                    onClick={() => handleToggleRoomPresence(ag.id, inRoom)}
                                    disabled={submitting}
                                    className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition active:scale-95 shrink-0 ${
                                        inRoom
                                            ? 'bg-zinc-900 hover:bg-rose-950/40 text-zinc-300 hover:text-rose-300 border-zinc-800'
                                            : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500 shadow-sm'
                                    }`}
                                >
                                    {inRoom ? 'Rút khỏi phòng' : '+ Vào phòng'}
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="p-3 rounded-2xl bg-blue-950/20 border border-blue-500/30 text-xs text-blue-300 flex items-start gap-2.5 shrink-0">
                <IconSparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                    <strong>Phân bổ thông minh:</strong> Khi một Agent được gán cho một thành viên, Agent đó sẽ ưu tiên nhận chỉ đạo từ người đó, đồng thời các thành viên khác vẫn có thể tag <code className="bg-blue-900/40 px-1 rounded">@agent_id</code> để phối hợp chéo!
                </div>
            </div>
        </div>
    )

    if (isEmbedded) {
        return <div className="h-[480px] max-h-[60vh] flex flex-col">{renderContent()}</div>
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-2xl rounded-3xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-4 text-zinc-200 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                            <IconUsers className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white">
                                Phân Bổ Agent Theo Từng Thành Viên
                            </h3>
                            <p className="text-xs text-zinc-400">
                                Quản lý số lượng và quyền điều phối AI Agent cho từng người trong phòng
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

                {renderContent()}
            </div>
        </div>
    )
}
