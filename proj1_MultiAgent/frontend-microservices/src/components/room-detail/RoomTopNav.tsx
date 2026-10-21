'use client'

import Link from 'next/link'
import { Room, UserPresence } from '@/lib/api'
import {
    IconArrowLeft,
    IconUsers,
    IconTrace,
    IconPlus,
    IconBuilding,
    IconTrees,
    IconLayers,
    IconMessageSquare,
} from '@/components/ui/icons'

type ViewMode = 'split' | '3d' | 'chat'
type MapType = 'office' | 'outdoor'

interface RoomTopNavProps {
    roomId: string
    room: Room | null
    connected: boolean
    onlineUsers: UserPresence[]
    latestTraces: Record<string, any>
    activeTrace: any
    setActiveTrace: (trace: any) => void
    setTraceModalOpen: (open: boolean) => void
    setAssignmentModalOpen: (open: boolean) => void
    setAddAgentModalOpen: (open: boolean) => void
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
    setAssignmentModalOpen,
    setAddAgentModalOpen,
    mapType,
    setMapType,
    viewMode,
    setViewMode,
}: RoomTopNavProps) {
    const hasErrorTrace = Object.values(latestTraces).some((t: any) => t.status === 'error')

    return (
        <div className="h-14 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur px-4 flex items-center justify-between gap-4 shrink-0 z-20">
            <div className="flex items-center gap-3">
                <Link
                    href="/rooms"
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition text-sm flex items-center gap-1.5"
                    title="Về danh sách phòng"
                >
                    <IconArrowLeft className="w-4 h-4" />
                    <span className="hidden sm:inline font-medium">Rooms</span>
                </Link>
                <div className="h-5 w-px bg-zinc-800" />
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="font-bold text-white text-sm sm:text-base tracking-tight truncate max-w-xs sm:max-w-md">
                            {room?.name || `Phòng #${roomId}`}
                        </h1>
                        <span
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${connected
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                }`}
                        >
                            <span
                                className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                                    }`}
                            />
                            {connected ? 'Live Sync' : 'Connecting...'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2 sm:gap-2.5">
                {/* Online Users Pill */}
                <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300">
                    <IconUsers className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-zinc-500 font-medium">Online ({onlineUsers.length}):</span>
                    <div className="flex items-center -space-x-1.5">
                        {onlineUsers.slice(0, 4).map((u: any, i) => {
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

                {/* LangSmith Traces */}
                <button
                    onClick={() => {
                        const tracesArr = Object.values(latestTraces)
                        if (tracesArr.length > 0) {
                            setActiveTrace(tracesArr[0])
                        }
                        setTraceModalOpen(true)
                    }}
                    className={`text-xs px-2.5 py-1.5 rounded-xl border transition font-medium flex items-center gap-1.5 shadow-sm ${hasErrorTrace
                        ? 'bg-rose-950/40 border-rose-500/50 text-rose-300 hover:bg-rose-900/50 animate-pulse'
                        : 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300 hover:bg-indigo-900/50'
                        }`}
                    title="Kiểm tra luồng thực thi Workflow (LangSmith Inspector)"
                >
                    <IconTrace className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Traces</span>
                    {hasErrorTrace && <span className="w-2 h-2 rounded-full bg-rose-500" />}
                </button>

                {/* Phân bổ Agent */}
                <button
                    onClick={() => setAssignmentModalOpen(true)}
                    className="text-xs px-2.5 py-1.5 rounded-xl border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 transition font-medium flex items-center gap-1.5"
                    title="Phân bổ Agent cho từng thành viên trong phòng"
                >
                    <IconUsers className="w-3.5 h-3.5 text-blue-400" />
                    <span className="hidden sm:inline">Phân Bổ Agent</span>
                </button>

                {/* Thêm Agent */}
                <button
                    onClick={() => setAddAgentModalOpen(true)}
                    className="text-xs px-2.5 py-1.5 rounded-xl border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 transition font-medium flex items-center gap-1"
                >
                    <IconPlus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Agent</span>
                </button>

                {/* Map Switcher */}
                <div className="flex items-center p-0.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
                    <button
                        onClick={() => setMapType('office')}
                        className={`px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1.5 ${mapType === 'office' ? 'bg-blue-600 text-white shadow' : 'text-zinc-400 hover:text-white'
                            }`}
                    >
                        <IconBuilding className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Office</span>
                    </button>
                    <button
                        onClick={() => setMapType('outdoor')}
                        className={`px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1.5 ${mapType === 'outdoor' ? 'bg-emerald-600 text-white shadow' : 'text-zinc-400 hover:text-white'
                            }`}
                    >
                        <IconTrees className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Outdoor</span>
                    </button>
                </div>

                {/* View Mode Switcher */}
                <div className="flex items-center p-0.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
                    <button
                        onClick={() => setViewMode('split')}
                        className={`px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1 ${viewMode === 'split' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'
                            }`}
                    >
                        <IconLayers className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Split</span>
                    </button>
                    <button
                        onClick={() => setViewMode('3d')}
                        className={`px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1 ${viewMode === '3d' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'
                            }`}
                    >
                        <IconBuilding className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">3D</span>
                    </button>
                    <button
                        onClick={() => setViewMode('chat')}
                        className={`px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1 ${viewMode === 'chat' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'
                            }`}
                    >
                        <IconMessageSquare className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Chat</span>
                    </button>
                </div>
            </div>
        </div>
    )
}