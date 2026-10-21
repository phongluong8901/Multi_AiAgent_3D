'use client'

import { useState } from 'react'
import { Room, roomsApi } from '@/lib/api'
import { IconShare2, IconCheck, IconLogOut } from '@/components/ui/icons' // Hoặc icon tương ứng trong dự án

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
    const [copied, setCopied] = useState(false)

    // Hàm sao chép link phòng
    const handleCopyShareLink = async () => {
        try {
            const shareUrl = window.location.href // Lấy URL hiện tại của phòng
            await navigator.clipboard.writeText(shareUrl)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000) // Ẩn trạng thái 'Đã copy' sau 2 giây
        } catch (err) {
            alert('Không thể sao chép liên kết.')
        }
    }

    return (
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-4 py-2 text-xs shrink-0">
            <div className="flex items-center gap-3">
                <div className="font-semibold text-white">
                    {room?.name || 'Đang tải phòng...'}
                </div>
                <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-400 border border-blue-500/20">
                    Thành viên: {room?.members?.length || 0}/{room?.maxCapacity || 20}
                </span>
            </div>

            <div className="flex items-center gap-2">
                {/* --- NÚT CHIA SẺ LINK PHÒNG --- */}
                <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 font-medium text-zinc-200 transition hover:bg-zinc-700 active:scale-95"
                    title="Sao chép đường dẫn phòng để chia sẻ"
                >
                    {copied ? (
                        <>
                            <IconCheck className="h-3.5 w-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Đã chép link!</span>
                        </>
                    ) : (
                        <>
                            {/* Dùng icon share hoặc icon link tùy ý */}
                            <span className="text-blue-400 font-bold">🔗</span>
                            <span>Chia sẻ link</span>
                        </>
                    )}
                </button>

                <button
                    type="button"
                    onClick={onOpenInvite}
                    className="rounded-xl bg-blue-600 px-3 py-1.5 font-semibold text-white transition hover:bg-blue-500"
                >
                    Mời thành viên
                </button>

                <button
                    type="button"
                    onClick={onLeaveRoom}
                    className="flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 font-semibold text-rose-300 transition hover:bg-rose-500/20"
                >
                    <IconLogOut className="h-3.5 w-3.5" />
                    <span>Thoát phòng</span>
                </button>
            </div>
        </div>
    )
}