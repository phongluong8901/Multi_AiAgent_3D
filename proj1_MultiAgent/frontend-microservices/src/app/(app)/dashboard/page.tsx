'use client'

import Link from 'next/link'
import { useAgents } from '@/hooks/useAgents'

export default function DashboardPage() {
    const { agents, connected } = useAgents()

    const working = agents.filter((a) => a.status === 'working').length
    const idle = agents.filter((a) => a.status === 'idle').length
    const blocked = agents.filter((a) => a.status === 'blocked').length

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-semibold">Dashboard</h1>
                <p className="text-sm text-zinc-400 mt-1">
                    API: {connected ? 'Connected' : 'Disconnected'}
                </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card label="Agents" value={agents.length} />
                <Card label="Working" value={working} />
                <Card label="Idle" value={idle} />
                <Card label="Blocked" value={blocked} />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                <Link
                    href="/office"
                    className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 hover:border-zinc-600 transition"
                >
                    <h2 className="font-medium">Office 3D</h2>
                    <p className="text-sm text-zinc-400 mt-1">Xem agents trong văn phòng</p>
                </Link>
                <Link
                    href="/agents/setup"
                    className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 hover:border-zinc-600 transition"
                >
                    <h2 className="font-medium">Setup Agent</h2>
                    <p className="text-sm text-zinc-400 mt-1">Tạo agent mới</p>
                </Link>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <h2 className="text-sm font-medium text-zinc-300 mb-3">Agents</h2>
                <div className="space-y-2">
                    {agents.length === 0 && (
                        <p className="text-sm text-zinc-500">Chưa có agent — kiểm tra API / seed</p>
                    )}
                    {agents.map((a) => (
                        <Link
                            key={a.id}
                            href={`/agents/${a.id}`}
                            className="flex items-center justify-between rounded-lg bg-zinc-800/60 px-3 py-2 hover:bg-zinc-800 transition"
                        >
                            <div className="flex items-center gap-2">
                                <span
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: a.color }}
                                />
                                <span className="text-sm">{a.name}</span>
                            </div>
                            <span className="text-xs text-zinc-400 uppercase">{a.status}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )
}

function Card({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-400">{label}</p>
            <p className="text-2xl font-semibold mt-1">{value}</p>
        </div>
    )
}