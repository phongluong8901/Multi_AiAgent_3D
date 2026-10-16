'use client'

import Scene from '@/components/Scene'
import TaskPanel from '@/components/ui/TaskPanel'
import { useAgents } from '@/hooks/useAgents'

export default function OfficePage() {
    const { agents, connected, error } = useAgents()

    return (
        <div className="relative w-full h-[calc(100vh-3.5rem)]">
            <Scene agents={agents} />
            <TaskPanel />

            <div className="absolute top-4 left-4 bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg z-10">
                API: {connected ? 'Connected' : 'Disconnected'}
                {error ? ` — ${error}` : ''}
            </div>
        </div>
    )
}