'use client'

import Link from 'next/link'
import { useAgents } from '@/hooks/useAgents'
import { agentsApi } from '@/lib/api'

export default function AgentsPage() {
    const { agents, connected, refresh } = useAgents()

    async function handleDelete(id: string) {
        if (!confirm(`Xóa agent "${id}"?`)) return
        try {
            await agentsApi.remove(id)
            refresh()
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Delete failed')
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold">Agents</h1>
                    <p className="text-sm text-zinc-400 mt-1">
                        {connected ? 'Live from Agents Service' : 'API offline'}
                    </p>
                </div>
                <Link
                    href="/agents/setup"
                    className="rounded-lg bg-blue-600 hover:bg-blue-500 text-sm px-4 py-2 transition"
                >
                    + Create agent
                </Link>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {agents.map((agent) => (
                    <div
                        key={agent.id}
                        className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
                    >
                        <Link href={`/agents/${agent.id}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <span
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: agent.color }}
                                />
                                <h2 className="font-medium">{agent.name}</h2>
                            </div>
                            <p className="text-xs text-zinc-400 uppercase mb-1">{agent.status}</p>
                            <p className="text-sm text-zinc-300 line-clamp-2">
                                {agent.speech ?? '—'}
                            </p>
                        </Link>
                        <button
                            type="button"
                            onClick={() => handleDelete(agent.id)}
                            className="mt-3 text-xs text-red-400 hover:underline"
                        >
                            Delete
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}