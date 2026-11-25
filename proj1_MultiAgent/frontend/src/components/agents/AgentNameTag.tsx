// src/components/agents/AgentNameTag.tsx
type Props = {
    name: string
    status?: 'idle' | 'working' | 'meeting' | 'blocked'
}

const STATUS_COLOR = {
    idle: '#a0aec0',
    working: '#48bb78',
    meeting: '#4299e1',
    blocked: '#f56565',
}

export default function AgentNameTag({ name, status = 'idle' }: Props) {
    return (
        <div className="flex items-center gap-1.5 bg-black/75 text-white text-[11px] px-2.5 py-1 rounded-full backdrop-blur-sm">
            <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: STATUS_COLOR[status] }}
            />
            <span className="font-medium">{name}</span>
        </div>
    )
}