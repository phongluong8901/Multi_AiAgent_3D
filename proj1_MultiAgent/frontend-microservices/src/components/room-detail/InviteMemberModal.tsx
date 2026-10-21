'use client'

import { useEffect, useState } from 'react'
import { usersApi, roomsApi, Room } from '@/lib/api'
import type { InviteUser } from '@/lib/api/users'
import { getUser } from '@/lib/auth'
import { IconX, IconUsers, IconPlus } from '@/components/ui/icons'

type Props = {
    roomId: string
    room: Room | null
    open: boolean
    onClose: () => void
    onInvited: (room: Room) => void
}

export function InviteMemberModal({
    roomId,
    room,
    open,
    onClose,
    onInvited,
}: Props) {
    const me = getUser()
    const myId = String(me?.id || '').trim()

    const [q, setQ] = useState('')
    const [users, setUsers] = useState<InviteUser[]>([])
    const [loading, setLoading] = useState(false)
    const [inviting, setInviting] = useState<string | null>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!open) return
        let cancelled = false
            ; (async () => {
                setLoading(true)
                setError('')
                try {
                    const list = await usersApi.listOnline(q || undefined)
                    if (!cancelled) {
                        setUsers(list.filter((u) => String(u.id) !== myId))
                    }
                } catch (e: any) {
                    if (!cancelled) setError(e.message || 'Không tải được user online')
                } finally {
                    if (!cancelled) setLoading(false)
                }
            })()
        return () => {
            cancelled = true
        }
    }, [open, q, myId])

    if (!open) return null

    const memberIds = new Set((room?.members ?? []).map((m) => m.memberId))
    if (room?.ownerId) memberIds.add(room.ownerId)

    const pendingIds = new Set(
        ((room as any)?.pendingInvites ?? []).map((i: any) => i.userId)
    )

    const handleInvite = async (u: InviteUser) => {
        const uid = String(u.id || '').trim()
        if (!uid || uid === myId) return
        if (memberIds.has(uid)) return

        try {
            setInviting(uid)
            const updated = await roomsApi.invite(roomId, {
                userId: uid,
                userName: u.username,
            })
            onInvited(updated)
            alert(`Đã gửi lời mời tới ${u.username}. Họ cần Accept trên trang Phòng.`)
            onClose()
        } catch (e: any) {
            alert(e.message || 'Gửi lời mời thất bại')
        } finally {
            setInviting(null)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
                <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <IconUsers className="h-4 w-4 text-blue-400" />
                        <h3 className="text-sm font-semibold text-white">Mời thành viên</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                    >
                        <IconX className="h-4 w-4" />
                    </button>
                </div>

                <div className="border-b border-zinc-800 p-3">
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Tìm username / email..."
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                    />
                    <p className="mt-1.5 text-[10px] text-zinc-500">
                        Gửi lời mời — họ Accept rồi mới vào phòng
                    </p>
                </div>

                <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
                    {loading && (
                        <p className="py-8 text-center text-xs text-zinc-500">Đang tải...</p>
                    )}
                    {error && (
                        <p className="py-4 text-center text-xs text-rose-400">{error}</p>
                    )}
                    {!loading && !error && users.length === 0 && (
                        <p className="py-8 text-center text-xs text-zinc-500">
                            Không có user online
                        </p>
                    )}
                    {users.map((u) => {
                        const uid = String(u.id)
                        const already = memberIds.has(uid)
                        const pending = pendingIds.has(uid)
                        return (
                            <div
                                key={uid}
                                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5"
                            >
                                <div className="flex min-w-0 items-center gap-2.5">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-xs font-bold text-blue-300">
                                        {(u.username || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="truncate text-xs font-medium text-white">
                                            {u.username}
                                        </div>
                                        <div className="truncate text-[10px] text-zinc-500">
                                            {u.email}
                                        </div>
                                    </div>
                                    <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-400">
                                        {u.status || 'online'}
                                    </span>
                                </div>
                                {already ? (
                                    <span className="text-[10px] text-zinc-500">Đã trong phòng</span>
                                ) : pending ? (
                                    <span className="text-[10px] text-amber-400">Đã gửi lời mời</span>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={inviting === uid}
                                        onClick={() => handleInvite(u)}
                                        className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                                    >
                                        <IconPlus className="h-3 w-3" />
                                        {inviting === uid ? '...' : 'Mời'}
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}