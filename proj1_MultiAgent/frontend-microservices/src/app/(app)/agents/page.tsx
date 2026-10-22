'use client'

import Link from 'next/link'
import { useAgents } from '@/hooks/useAgents'
import { agentsApi } from '@/lib/api'

export default function AgentsPage() {
    const { agents, connected, refresh } = useAgents()

    async function handleDelete(id: string, name: string) {
        if (!confirm(`Xóa agent "${name}" (${id})?`)) return
        try {
            await agentsApi.remove(id)
            refresh()
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Delete failed')
        }
    }

    const statusColor: Record<string, string> = {
        idle: 'bg-zinc-500',
        working: 'bg-emerald-500',
        meeting: 'bg-blue-500',
        blocked: 'bg-red-500',
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold">Agents</h1>
                    <p className="text-sm text-zinc-400 mt-1 flex items-center gap-2">
                        <span
                            className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'
                                }`}
                        />
                        {connected ? 'Live from Agents Service' : 'API offline'}
                        <span className="text-zinc-600">·</span>
                        <span>{agents.length} agent{agents.length !== 1 ? 's' : ''}</span>
                    </p>
                </div>

                <Link
                    href="/agents/setup"
                    className="rounded-lg bg-blue-600 hover:bg-blue-500 text-sm px-4 py-2.5 transition font-medium flex items-center gap-1.5"
                >
                    <span className="text-base leading-none">+</span>
                    Create agent
                </Link>
            </div>

            {/* Empty state */}
            {agents.length === 0 && (
                <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 py-16 text-center">
                    <div className="text-4xl mb-3 opacity-40">🤖</div>
                    <p className="text-zinc-400 text-sm">Chưa có agent nào</p>
                    <Link
                        href="/agents/setup"
                        className="mt-3 inline-block text-sm text-blue-400 hover:underline"
                    >
                        Tạo agent đầu tiên →
                    </Link>
                </div>
            )}

            {/* Agents grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {agents.map((agent) => (
                    <div
                        key={agent.id}
                        className="group relative rounded-2xl border border-zinc-800 bg-zinc-900/80 hover:border-zinc-700 hover:bg-zinc-900 transition-all duration-200 overflow-hidden"
                    >
                        {/* Top accent bar theo màu agent */}
                        <div
                            className="h-1 w-full"
                            style={{ backgroundColor: agent.color || '#3b82f6' }}
                        />

                        <div className="p-4">
                            {/* Header card */}
                            <Link href={`/agents/${agent.id}`} className="block">
                                <div className="flex items-start justify-between gap-2 mb-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div
                                            className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-inner"
                                            style={{ backgroundColor: agent.color || '#3b82f6' }}
                                        >
                                            {agent.name?.charAt(0)?.toUpperCase() || 'A'}
                                        </div>
                                        <div className="min-w-0">
                                            <h2 className="font-medium text-zinc-100 truncate group-hover:text-white">
                                                {agent.name}
                                            </h2>
                                            <p className="text-[11px] text-zinc-500 font-mono truncate">
                                                {agent.id}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Status badge */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span
                                            className={`w-1.5 h-1.5 rounded-full ${statusColor[agent.status] || 'bg-zinc-500'
                                                }`}
                                        />
                                        <span className="text-[11px] text-zinc-400 uppercase tracking-wide">
                                            {agent.status}
                                        </span>
                                    </div>
                                </div>

                                {/* Speech / description */}
                                <p className="text-sm text-zinc-400 line-clamp-2 min-h-[40px]">
                                    {agent.speech || (
                                        <span className="italic text-zinc-600">Chưa có lời nói</span>
                                    )}
                                </p>
                            </Link>

                            {/* Footer actions */}
                            <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                                <div className="flex gap-2">
                                    <Link
                                        href={`/agents/${agent.id}`}
                                        className="text-xs text-zinc-400 hover:text-white transition px-2 py-1 rounded-md hover:bg-zinc-800"
                                    >
                                        Edit
                                    </Link>
                                    <Link
                                        href={`/chat/${agent.id}`}
                                        className="text-xs text-zinc-400 hover:text-blue-400 transition px-2 py-1 rounded-md hover:bg-zinc-800"
                                    >
                                        Chat
                                    </Link>
                                    <Link
                                        href="/office"
                                        className="text-xs text-zinc-400 hover:text-emerald-400 transition px-2 py-1 rounded-md hover:bg-zinc-800"
                                    >
                                        Office
                                    </Link>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => handleDelete(agent.id, agent.name)}
                                    className="text-xs text-zinc-500 hover:text-red-400 transition px-2 py-1 rounded-md hover:bg-red-950/40"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}