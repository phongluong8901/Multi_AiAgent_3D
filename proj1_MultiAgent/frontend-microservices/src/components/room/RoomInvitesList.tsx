'use client'

import { Room, roomsApi } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { toast } from 'sonner'

interface RoomInvitesListProps {
    invites: Room[]
    setInvites: React.Dispatch<React.SetStateAction<Room[]>>
}

export function RoomInvitesList({ invites, setInvites }: RoomInvitesListProps) {
    if (invites.length === 0) return null

    return (
        <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
            <h2 className="text-sm font-semibold text-amber-300">
                Lời mời vào phòng ({invites.length})
            </h2>
            {invites.map((room) => {
                const id = room._id || room.id || ''
                return (
                    <div
                        key={id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3"
                    >
                        <div>
                            <div className="text-sm font-medium text-white">{room.name}</div>
                            <div className="text-xs text-zinc-500">
                                {room.description || 'Không có mô tả'}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
                                onClick={async () => {
                                    try {
                                        await roomsApi.acceptInvite(id, getUser()?.name)
                                        setInvites((prev) =>
                                            prev.filter((r) => (r._id || r.id) !== id)
                                        )
                                        toast.success('Đã chấp nhận lời mời vào phòng!')
                                        window.location.href = `/rooms/${id}`
                                    } catch (e: any) {
                                        toast.error(e.message || 'Chấp nhận lời mời thất bại')
                                    }
                                }}
                            >
                                Chấp nhận
                            </button>
                            <button
                                type="button"
                                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                                onClick={async () => {
                                    try {
                                        await roomsApi.declineInvite(id)
                                        setInvites((prev) =>
                                            prev.filter((r) => (r._id || r.id) !== id)
                                        )
                                        toast.info('Đã từ chối lời mời vào phòng')
                                    } catch (e: any) {
                                        toast.error(e.message || 'Từ chối lời mời thất bại')
                                    }
                                }}
                            >
                                Từ chối
                            </button>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}