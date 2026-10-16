'use client'

import Link from 'next/link'
import { useGateway } from '@/hooks/useGateway'

export default function ChatListPage() {
    const { state } = useGateway()
    const agents = state?.agents ?? []

    const rooms = [
        { id: 'general', name: 'General', desc: 'Room chung cho cả team' },
        ...agents.map((a) => ({
            id: a.id,
            name: a.name,
            desc: `Chat riêng với ${a.name}`,
        })),
    ]

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-semibold">Chat</h1>
                <p className="text-sm text-zinc-400 mt-1">Chọn room để trò chuyện</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
                {rooms.map((room) => (
                    <Link
                        key={room.id}
                        href={`/chat/${room.id}`}
                        className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-600 transition"
                    >
                        <h2 className="font-medium">{room.name}</h2>
                        <p className="text-sm text-zinc-400 mt-1">{room.desc}</p>
                    </Link>
                ))}
            </div>
        </div>
    )
}