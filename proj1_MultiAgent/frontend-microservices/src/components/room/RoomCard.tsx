'use client'

import { useState } from 'react'
import { Room, roomsApi } from '@/lib/api'
import { IconLock } from '@/components/ui/icons'
import { RoomPasswordModal } from './private-room/RoomPasswordModal'

interface RoomCardProps {
    room: Room
    currentUserId?: string
    isDeleting: boolean
    onDelete: (room: Room) => void
}

export function RoomCard({ room, currentUserId, isDeleting, onDelete }: RoomCardProps) {
    const roomId = room._id || room.id || ''
    const agentsCount = room.activeAgents?.length || 0
    const userMembers = (room.members || []).filter(
        (m) => m.memberType !== 'agent' && !String(m.memberId).startsWith('agent_')
    )
    const membersCount = room.totalMembers ?? (userMembers.length || room.members?.length || 0)
    const onlineCount =
        room.onlineCount ??
        (room.onlineUsers?.length ||
            userMembers.filter((m) => m.isOnline || m.status === 'online').length)
    const offlineCount = room.offlineCount ?? Math.max(0, membersCount - onlineCount)

    const tierBadge = room.policy?.tier || 'standard'
    const ownedCount = room.policy?.ownedAgentsCount ?? 3
    const isOwner = !!currentUserId && room.ownerId === currentUserId
    const isPublicRoom = room.policy?.isPublic ?? true
    const isMember = room.members?.some((m) => m.memberId === currentUserId)

    const [showPasswordModal, setShowPasswordModal] = useState(false)

    const getAgentBadgeColor = (agentId: string) => {
        const colors: Record<string, string> = {
            agent_manager: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
            agent_ml: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
            agent_analyst: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
            agent_analysis: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
            agent_search: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
            agent_summarizer: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
            agent_coder: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
            agent_calculate: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
        }
        return colors[agentId] || 'bg-secondary text-foreground border-border'
    }

    const getAgentShortName = (agentId: string) => {
        const names: Record<string, string> = {
            agent_manager: 'Manager',
            agent_ml: 'ML Expert',
            agent_analyst: 'Data Analyst',
            agent_analysis: 'Data Analyst',
            agent_search: 'Search Expert',
            agent_summarizer: 'Summarizer',
            agent_coder: 'Coder & SQL',
            agent_calculate: 'Quant & Math',
        }
        return names[agentId] || agentId.replace('agent_', '')
    }

    const handleOpenRoom = (e: React.MouseEvent) => {
        e.preventDefault()

        if (!isPublicRoom && !isOwner && !isMember) {
            setShowPasswordModal(true)
        } else {
            window.location.href = `/rooms/${roomId}`
        }
    }

    const handleVerifyPassword = async (passwordInput: string) => {
        await roomsApi.join(roomId, { password: passwordInput })
        window.location.href = `/rooms/${roomId}`
    }

    return (
        <>
            <div className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm backdrop-blur transition hover:border-blue-500/40 hover:shadow-md">
                <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold text-foreground transition group-hover:text-blue-500 dark:group-hover:text-blue-400">
                                    {room.name}
                                </h3>
                                <span className="rounded border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                                    {tierBadge}
                                </span>
                                {!isPublicRoom && (
                                    <span className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                        <IconLock className="h-3 w-3" />
                                        Private
                                    </span>
                                )}
                                {isOwner && (
                                    <span className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                                        Chủ phòng
                                    </span>
                                )}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                {room.description || 'Không có mô tả.'}
                            </p>
                        </div>
                        <span className="flex shrink-0 items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                            Live
                        </span>
                    </div>

                    {/* Thống kê Online & Offline trực quan */}
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-secondary/40 px-3 py-2 text-xs">
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                            <span>{onlineCount} Online</span>
                        </div>
                        <span className="text-muted-foreground/60">•</span>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                            <span>{offlineCount} Offline</span>
                        </div>
                        <span className="ml-auto text-[11px] text-muted-foreground">
                            Tổng: <strong className="text-foreground">{membersCount}</strong>/{room.maxCapacity}
                        </span>
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            <span>Nhóm Agent ({agentsCount})</span>
                            <span>Sở hữu tối đa: {ownedCount}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {room.activeAgents?.slice(0, 4).map((agId) => (
                                <span
                                    key={agId}
                                    className={`rounded-md border px-2 py-0.5 text-xs font-medium ${getAgentBadgeColor(agId)}`}
                                >
                                    @{getAgentShortName(agId)}
                                </span>
                            ))}
                            {agentsCount > 4 && (
                                <span className="rounded-md border border-border bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                                    +{agentsCount - 4}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/80 pt-4">
                    <div className="flex items-center -space-x-1.5 overflow-hidden">
                        {(room.onlineUsers || []).slice(0, 4).map((u) => (
                            <div
                                key={u.userId}
                                title={`${u.userName} (Đang Online)`}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-emerald-500/60 bg-emerald-500/20 text-[10px] font-bold text-emerald-600 dark:text-emerald-300 ring-2 ring-card"
                            >
                                {(u.userName || 'U').slice(0, 1).toUpperCase()}
                            </div>
                        ))}
                        {(room.onlineUsers?.length || 0) === 0 && (
                            <span className="text-[11px] text-muted-foreground">Chưa có ai đang trong phòng</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {isOwner && (
                            <button
                                type="button"
                                disabled={isDeleting}
                                onClick={() => onDelete(room)}
                                className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                            >
                                {isDeleting ? 'Đang xóa...' : 'Xóa'}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleOpenRoom}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600/90 px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-blue-600 active:scale-95"
                        >
                            Vào Room &rarr;
                        </button>
                    </div>
                </div>
            </div>

            <RoomPasswordModal
                isOpen={showPasswordModal}
                roomName={room.name}
                onClose={() => setShowPasswordModal(false)}
                onSubmit={handleVerifyPassword}
            />
        </>
    )
}
