'use client'

import { IconBot, IconUser } from '@/components/ui/icons'

interface AgentTeamStripProps {
    roomAgents: any[]
    selected3dAgentId: string
    handleSelectAgent: (agentId: string) => void
    setInput: (val: string | ((prev: string) => string)) => void
}

export function AgentTeamStrip({
    roomAgents,
    selected3dAgentId,
    handleSelectAgent,
    setInput,
}: AgentTeamStripProps) {
    return (
        <div className="h-11 border-b border-zinc-800/80 bg-zinc-950/80 px-4 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none z-10">
            <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-bold shrink-0 flex items-center gap-1">
                <IconBot className="w-3.5 h-3.5 text-zinc-400" />
                <span>Nhóm Agent:</span>
            </span>
            {roomAgents.map((ag) => {
                const status = ag.status || 'idle'
                const isSelected = selected3dAgentId === ag.id

                return (
                    <button
                        key={ag.id}
                        onClick={() => {
                            handleSelectAgent(ag.id)
                            if (!isSelected) {
                                setInput((prev) => (prev.startsWith(`@${ag.id}`) ? prev : `@${ag.id} `))
                            }
                        }}
                        className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${isSelected
                                ? 'bg-blue-600/20 border-blue-500 text-blue-300 ring-1 ring-blue-500/50'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                            }`}
                    >
                        <span
                            className={`w-2 h-2 rounded-full ${status === 'working' || status === 'thinking'
                                    ? 'bg-amber-400 animate-ping'
                                    : status === 'speaking'
                                        ? 'bg-purple-400 animate-pulse'
                                        : 'bg-emerald-400'
                                }`}
                        />
                        <span>{ag.name}</span>
                        {ag.ownerName && (
                            <span className="text-[10px] text-blue-400 bg-blue-950/60 border border-blue-500/30 px-1 rounded flex items-center gap-0.5">
                                <IconUser className="w-2.5 h-2.5" />
                                <span>{ag.ownerName}</span>
                            </span>
                        )}
                        <span className="text-[10px] text-zinc-500 font-normal">({status})</span>
                    </button>
                )
            })}
        </div>
    )
}