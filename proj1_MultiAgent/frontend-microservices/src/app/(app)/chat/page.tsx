'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { roomsApi, agentsApi, Room, Agent } from '@/lib/api'

export default function ChatListPage() {
    const [rooms, setRooms] = useState<Room[]>([])
    const [agents, setAgents] = useState<Agent[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        Promise.all([
            roomsApi.list().catch(() => []),
            agentsApi.list().catch(() => []),
        ]).then(([r, a]) => {
            setRooms(r)
            setAgents(a)
            setLoading(false)
        })
    }, [])

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-white tracking-tight">Kênh Trò Chuyện & Làm Việc Nhóm</h1>
                    <p className="text-xs text-zinc-400 mt-1">Chọn phòng cộng tác hoặc chat riêng với từng Agent</p>
                </div>
                <Link
                    href="/rooms"
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition shadow"
                >
                    + Tạo Team Room
                </Link>
            </div>

            {/* Team Collaboration Rooms */}
            <div className="space-y-3">
                <h2 className="text-xs uppercase font-bold tracking-wider text-zinc-400">
                    Phòng Làm Việc Nhóm Đa Agent
                </h2>

                {loading ? (
                    <div className="grid sm:grid-cols-2 gap-3">
                        <div className="h-24 rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse" />
                        <div className="h-24 rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse" />
                    </div>
                ) : (
                    <div className="grid sm:grid-cols-2 gap-3">
                        {rooms.map((room) => {
                            const rId = room._id || room.id || 'general'
                            return (
                                <Link
                                    key={rId}
                                    href={`/rooms/${rId}`}
                                    className="group rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 hover:border-blue-500/50 hover:bg-zinc-900 transition flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-semibold text-white group-hover:text-blue-400 text-sm">
                                                🏢 {room.name}
                                            </h3>
                                            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                                                {room.activeAgents?.length || 0} agents
                                            </span>
                                        </div>
                                        <p className="text-xs text-zinc-400 mt-1 line-clamp-1">
                                            {room.description || 'Không gian làm việc chung'}
                                        </p>
                                    </div>
                                    <div className="mt-3 text-[11px] text-blue-400 font-medium">
                                        Vào phòng cộng tác 3D & Chat →
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Direct Agent Chat */}
            <div className="space-y-3 pt-4 border-t border-zinc-800">
                <h2 className="text-xs uppercase font-bold tracking-wider text-zinc-400">
                    Chat Riêng Lẻ Trực Tiếp
                </h2>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {agents.map((ag) => (
                        <Link
                            key={ag.id}
                            href={`/rooms/general?target=${ag.id}`}
                            className="rounded-xl border border-zinc-800/80 bg-zinc-950 p-3 hover:border-zinc-700 hover:bg-zinc-900 transition"
                        >
                            <div className="flex items-center gap-2.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                <div>
                                    <h4 className="text-xs font-semibold text-white">{ag.name}</h4>
                                    <span className="text-[10px] text-zinc-500 font-mono">@{ag.id}</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )
}