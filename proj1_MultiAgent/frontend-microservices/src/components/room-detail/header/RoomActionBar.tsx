'use client'

import { Room } from '@/lib/api'
import { IconUser, IconUsers, IconPlus, IconLogOut } from '@/components/ui/icons'

interface RoomActionBarProps {
    room: Room | null
    roomId: string
    onOpenInvite: () => void
    onOpenManagement: () => void
    onLeaveRoom: () => void
}

export function RoomActionBar({
    room,
    roomId,
    onOpenInvite,
    onOpenManagement,
    onLeaveRoom,
}: RoomActionBarProps) {
    return (
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-4 py-1.5 text-xs">
            <div className="flex flex-wrap items-center gap-3 text-zinc-300">
                <span className="flex items-center gap-1 font-semibold text-white">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                    {room?.name || roomId}
                </span>
                <span className="flex items-center gap-1 text-zinc-400">
                    <IconUser className="h-3.5 w-3.5 text-blue-400" />
                    Chủ: <strong className="text-blue-400">{room?.ownerId || '—'}</strong>
                </span>
                <span className="flex items-center gap-1 text-zinc-400">
                    <IconUsers className="h-3.5 w-3.5 text-emerald-400" />
                    TV: <strong className="text-white">{room?.members?.length ?? 0}</strong>
                </span>
            </div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onOpenInvite}
                    className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 font-medium text-white hover:bg-blue-500"
                >
                    <IconPlus className="h-3.5 w-3.5" />
                    Mời
                </button>
                <button
                    type="button"
                    onClick={onOpenManagement}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-zinc-200 hover:bg-zinc-700"
                >
                    Quản lý
                </button>
                {/* Nút thoát phòng có kèm IconLogOut */}
                <button
                    type="button"
                    onClick={onLeaveRoom}
                    className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-rose-300 transition hover:bg-rose-500/20"
                >
                    <IconLogOut className="h-3.5 w-3.5" />
                    Thoát
                </button>
            </div>
        </div>
    )
}