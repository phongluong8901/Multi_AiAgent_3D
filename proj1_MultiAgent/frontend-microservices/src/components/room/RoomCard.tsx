'use client'

import Link from 'next/link'
import { Room } from '@/lib/api'

interface RoomCardProps {
    room: Room
    currentUserId?: string
    isDeleting: boolean
    onDelete: (room: Room) => void
}

export function RoomCard({ room, currentUserId, isDeleting, onDelete }: RoomCardProps) {
    const roomId = room._id || room.id || ''
    const agentsCount = room.activeAgents?.length || 0
    const membersCount = room.members?.length || 0
    const tierBadge = room.policy?.tier || 'standard'
    const ownedCount = room.policy?.ownedAgentsCount ?? 3
    const isOwner = !!currentUserId && room.ownerId === currentUserId

    const getAgentBadgeColor = (agentId: string) => {
        const colors: Record<string, string> = {
            agent_manager: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
            agent_ml: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
            agent_analyst: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
            agent_search: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
            agent_summarizer: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
        }
        return colors[agentId] || 'bg-zinc-800 text-zinc-300 border-zinc-700'
    }

    const getAgentShortName = (agentId: string) => {
        const names: Record<string, string> = {
            agent_manager: 'Manager',
            agent_ml: 'ML Expert',
            agent_analyst: 'Data Analyst',
            agent_search: 'Search Expert',
            agent_summarizer: 'Summarizer',
        }
        return names[agentId] || agentId.replace('agent_', '')
    }

    return (
        <div className="group relative flex flex-col justify-between rounded-2xl border border-zinc-800/80 bg-zinc-900/80 p-6 backdrop-blur transition hover:border-blue-500/40 hover:shadow-xl hover:shadow-blue-500/5">
            <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-white transition group-hover:text-blue-400">
                                {room.name}
                            </h3>
                            <span className="rounded border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-400">
                                {tierBadge}
                            </span>
                            {isOwner && (
                                <span className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                                    Chủ phòng
                                </span>
                            )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-400">
                            {room.description || 'Không có mô tả.'}
                        </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                        Live
                    </span>
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
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
                            <span className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                                +{agentsCount - 4}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-zinc-800/80 pt-5">
                <div className="text-xs text-zinc-400">
                    Thành viên:{' '}
                    <span className="font-medium text-zinc-200">
                        {membersCount}/{room.maxCapacity}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {isOwner && (
                        <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => onDelete(room)}
                            className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                        >
                            {isDeleting ? 'Đang xóa...' : 'Xóa'}
                        </button>
                    )}
                    <Link
                        href={`/rooms/${roomId}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600/90 px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-blue-600 active:scale-95"
                    >
                        Vào Room →
                    </Link>
                </div>
            </div>
        </div>
    )
}