// src/components/agents/AgentSpeechBubble.tsx
type Props = {
    text: string
}

export default function AgentSpeechBubble({ text }: Props) {
    if (!text) return null

    return (
        <div className="relative bg-white text-zinc-800 text-xs px-3 py-1.5 rounded-lg shadow-lg max-w-[160px] text-center leading-snug mb-1">
            {text}
            <div className="absolute left-1/2 -bottom-1 w-2 h-2 bg-white rotate-45 -translate-x-1/2" />
        </div>
    )
}