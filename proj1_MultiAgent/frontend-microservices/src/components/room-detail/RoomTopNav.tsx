'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Room, UserPresence } from '@/lib/api'
import {
    IconArrowLeft,
    IconUsers,
    IconTrace,
    IconBuilding,
    IconTrees,
    IconLayers,
    IconMessageSquare,
    IconShare2,
    IconCheck,
    IconSettings,
    IconLogOut,
    IconLock,
    IconGlobe,
} from '@/components/ui/icons'

import { MapType } from '@/lib/maps/mapRegistry'

type ViewMode = 'split' | '3d' | 'chat'

interface RoomTopNavProps {
    roomId: string
    room: Room | null
    connected: boolean
    onlineUsers: UserPresence[]
    latestTraces: Record<string, any>
    activeTrace: any
    setActiveTrace: (trace: any) => void
    setTraceModalOpen: (open: boolean) => void
    onOpenManagement: () => void
    onLeaveRoom: () => void
    mapType: MapType
    setMapType: (map: MapType) => void
    viewMode: ViewMode
    setViewMode: (mode: ViewMode) => void
}

export function RoomTopNav({
    roomId,
    room,
    connected,
    onlineUsers,
    latestTraces,
    setActiveTrace,
    setTraceModalOpen,
    onOpenManagement,
    onLeaveRoom,
    mapType,
    setMapType,
    viewMode,
    setViewMode,
}: RoomTopNavProps) {
    const [copied, setCopied] = useState(false)
    const hasErrorTrace = Object.values(latestTraces).some((t: any) => t.status === 'error')

    const handleCopyShareLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            alert('Không thể sao chép liên kết.')
        }
    }

    const isPublic = room?.policy?.isPublic ?? true

    return (
        <header className="h-14 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-4 shrink-0 z-20">
            {/* --- KHU VỰC BÊN TRÁI: ĐIỀU HƯỚNG & THÔNG TIN PHÒNG --- */}
            <div className="flex items-center gap-2.5 min-w-0">
                <Link
                    href="/rooms"
                    className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition text-xs font-medium flex items-center gap-1 shrink-0"
                    title="Về danh sách phòng"
                >
                    <IconArrowLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Rooms</span>
                </Link>

                <div className="h-4 w-px bg-zinc-800 shrink-0" />

                <div className="flex items-center gap-2 min-w-0">
                    <h1 className="font-bold text-white text-xs sm:text-sm tracking-tight truncate max-w-[130px] sm:max-w-xs md:max-w-sm">
                        {room?.name || `Phòng #${roomId}`}
                    </h1>

                    {/* Badge công khai / riêng tư */}
                    <span
                        className={`hidden md:flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border shrink-0 ${
                            isPublic
                                ? 'bg-zinc-800 text-zinc-300 border-zinc-700'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}
                        title={isPublic ? 'Phòng công khai' : 'Phòng riêng tư (có mật khẩu)'}
                    >
                        {isPublic ? <IconGlobe className="w-3 h-3" /> : <IconLock className="w-3 h-3" />}
                        <span>{isPublic ? 'Public' : 'Private'}</span>
                    </span>

                    {/* Trạng thái Live Sync Socket */}
                    <span
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0 ${
                            connected
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        }`}
                    >
                        <span
                            className={`w-1.5 h-1.5 rounded-full ${
                                connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                            }`}
                        />
                        <span className="hidden sm:inline">{connected ? 'Live' : 'Connecting'}</span>
                    </span>

                    {/* Nút chia sẻ link nhanh */}
                    <button
                        onClick={handleCopyShareLink}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition shrink-0"
                        title="Sao chép link phòng"
                    >
                        {copied ? (
                            <IconCheck className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                            <IconShare2 className="w-3.5 h-3.5" />
                        )}
                    </button>
                </div>
            </div>

            {/* --- KHU VỰC Ở GIỮA: CHUYỂN BẢN ĐỒ & CHẾ ĐỘ HIỂN THỊ --- */}
            <div className="hidden xl:flex items-center gap-2">
                {/* Map Switcher */}
                <div className="flex items-center p-0.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
                    <button
                        onClick={() => setMapType('office')}
                        className={`px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1.5 ${
                            mapType === 'office'
                                ? 'bg-blue-600 text-white shadow'
                                : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                        <IconBuilding className="w-3.5 h-3.5" />
                        <span>Office</span>
                    </button>
                    <button
                        onClick={() => setMapType('outdoor')}
                        className={`px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1.5 ${
                            mapType === 'outdoor'
                                ? 'bg-emerald-600 text-white shadow'
                                : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                        <IconTrees className="w-3.5 h-3.5" />
                        <span>Outdoor</span>
                    </button>
                    <button
                        onClick={() => setMapType('iot')}
                        className={`px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1.5 ${
                            mapType === 'iot'
                                ? 'bg-cyan-600 text-white shadow'
                                : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                        <IconGlobe className="w-3.5 h-3.5" />
                        <span>Smart City</span>
                    </button>
                </div>

                <Link
                    href="/maps/setup"
                    target="_blank"
                    className="p-1.5 rounded-xl text-zinc-400 hover:text-cyan-400 hover:bg-zinc-800 transition text-xs font-medium flex items-center gap-1 shrink-0 border border-transparent hover:border-cyan-500/30"
                    title="Vào Map Studio để vẽ & tùy chỉnh bản đồ 3D"
                >
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 font-mono border border-cyan-500/40">Studio 3D</span>
                </Link>

                {/* View Mode Switcher */}
                <div className="flex items-center p-0.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
                    <button
                        onClick={() => setViewMode('split')}
                        className={`px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1 ${
                            viewMode === 'split' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                        <IconLayers className="w-3.5 h-3.5" />
                        <span>Split</span>
                    </button>
                    <button
                        onClick={() => setViewMode('3d')}
                        className={`px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1 ${
                            viewMode === '3d' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                        <IconBuilding className="w-3.5 h-3.5" />
                        <span>3D</span>
                    </button>
                    <button
                        onClick={() => setViewMode('chat')}
                        className={`px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1 ${
                            viewMode === 'chat' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                        <IconMessageSquare className="w-3.5 h-3.5" />
                        <span>Chat</span>
                    </button>
                </div>
            </div>

            {/* --- KHU VỰC BÊN PHẢI: ONLINE USERS, QUẢN LÝ, TRACES, RỜI PHÒNG --- */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Online Users Pill */}
                <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300">
                    <IconUsers className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-zinc-500 font-medium">Online ({onlineUsers.length}):</span>
                    <div className="flex items-center -space-x-1.5">
                        {onlineUsers.slice(0, 3).map((u: any, i) => {
                            const displayName = u.userName || u.name || 'User'
                            return (
                                <div
                                    key={i}
                                    title={displayName}
                                    className="w-5 h-5 rounded-full bg-blue-600 border border-zinc-900 text-[10px] flex items-center justify-center font-bold text-white shadow"
                                >
                                    {displayName.charAt(0).toUpperCase()}
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Nút kiểm tra luồng Workflow Traces */}
                <button
                    onClick={() => {
                        const tracesArr = Object.values(latestTraces)
                        if (tracesArr.length > 0) {
                            setActiveTrace(tracesArr[0])
                        }
                        setTraceModalOpen(true)
                    }}
                    className={`text-xs px-2.5 py-1.5 rounded-xl border transition font-medium flex items-center gap-1.5 shadow-sm ${
                        hasErrorTrace
                            ? 'bg-rose-950/40 border-rose-500/50 text-rose-300 hover:bg-rose-900/50 animate-pulse'
                            : 'bg-indigo-950/30 border-indigo-500/30 text-indigo-300 hover:bg-indigo-900/40'
                    }`}
                    title="Kiểm tra luồng thực thi Workflow (LangSmith Inspector)"
                >
                    <IconTrace className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="hidden sm:inline">Traces</span>
                </button>

                {/* NÚT DUY NHẤT: Quản lý phòng (Thành viên, Phân bổ Agent, Mời) */}
                <button
                    onClick={onOpenManagement}
                    className="text-xs px-3 py-1.5 rounded-xl border border-blue-500/30 bg-blue-600/10 hover:bg-blue-600/20 text-blue-300 transition font-medium flex items-center gap-1.5 shadow-sm active:scale-95"
                    title="Mở bảng điều khiển quản lý phòng"
                >
                    <IconSettings className="w-3.5 h-3.5 text-blue-400" />
                    <span className="font-semibold">Quản lý</span>
                    <span className="text-[10px] bg-blue-600/30 text-blue-200 px-1.5 py-0.2 rounded-full font-mono">
                        {room?.members?.length || 1}
                    </span>
                </button>

                {/* Nút thoát phòng */}
                <button
                    onClick={onLeaveRoom}
                    className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-medium transition flex items-center gap-1 active:scale-95"
                    title="Rời khỏi phòng làm việc này"
                >
                    <IconLogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Thoát</span>
                </button>
            </div>
        </header>
    )
}