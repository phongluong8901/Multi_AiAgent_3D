'use client'

import { IconBot, IconUser, IconDuck, IconAmr, IconDrone, IconHumanoid } from '@/components/ui/icons'

interface AgentTeamStripProps {
    roomAgents: any[]
    selected3dAgentId: string
    handleSelectAgent: (agentId: string) => void
    setInput: (val: string | ((prev: string) => string)) => void
}

function getAgentForm(agent: any): 'humanoid' | 'duck' | 'amr' | 'drone' {
    if (typeof window !== 'undefined' && agent.id) {
        const saved = localStorage.getItem(`agent_form:${agent.id}`)
        if (saved === 'duck' || saved === 'amr' || saved === 'drone' || saved === 'humanoid') return saved
    }
    const lower = ((agent.name || '') + ' ' + (agent.id || '')).toLowerCase()
    if (lower.includes('duck') || lower.includes('vit')) return 'duck'
    if (lower.includes('amr') || lower.includes('agv') || lower.includes('xe') || lower.includes('logistics')) return 'amr'
    if (lower.includes('drone') || lower.includes('fly') || lower.includes('bay')) return 'drone'
    return 'humanoid'
}

export function AgentTeamStrip({
    roomAgents,
    selected3dAgentId,
    handleSelectAgent,
    setInput,
}: AgentTeamStripProps) {
    return (
        <div className="h-11 border-b border-zinc-800/80 bg-zinc-950/80 px-4 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none z-10">
            <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-bold shrink-0 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#76b900]" />
                <span>NVIDIA Fleet:</span>
            </span>
            {roomAgents.map((ag) => {
                const status = ag.status || 'idle'
                const isSelected = selected3dAgentId === ag.id
                const form = getAgentForm(ag)
                const FormIcon = form === 'duck' ? IconDuck : form === 'amr' ? IconAmr : form === 'drone' ? IconDrone : IconHumanoid

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
                                ? 'bg-[#76b900]/15 border-[#76b900] text-zinc-100 ring-1 ring-[#76b900]/40 shadow-[0_0_10px_rgba(118,185,0,0.2)]'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                            }`}
                    >
                        <FormIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-[#76b900]' : 'text-zinc-400'}`} />
                        <span
                            className={`w-1.5 h-1.5 rounded-full ${status === 'working' || status === 'thinking'
                                    ? 'bg-amber-400 animate-ping'
                                    : status === 'speaking'
                                        ? 'bg-purple-400 animate-pulse'
                                        : 'bg-[#76b900]'
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