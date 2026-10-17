// src/components/agents/AgentNameTag.tsx
type Props = {
    name: string
    status?: 'idle' | 'working' | 'meeting' | 'blocked' | 'thinking' | 'speaking'
    ownerName?: string
}

const STATUS_COLOR: Record<string, string> = {
    idle: '#a0aec0',
    working: '#48bb78',
    meeting: '#4299e1',
    blocked: '#f56565',
    thinking: '#ecc94b',
    speaking: '#9f7aea',
}

export default function AgentNameTag({ name, status = 'idle', ownerName }: Props) {
    return (
        <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 bg-black/80 text-white text-[11px] px-2.5 py-1 rounded-full backdrop-blur-sm border border-white/10 shadow-lg">
                <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: STATUS_COLOR[status] }}
                />
                <span className="font-semibold">{name}</span>
            </div>
            {ownerName && (
                <div className="mt-0.5 text-[9px] font-medium bg-blue-600/90 text-white px-2 py-0.5 rounded-full shadow border border-blue-400/30 flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span>{ownerName}</span>
                </div>
            )}
        </div>
    )
}