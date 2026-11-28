'use client'

import React from 'react'

type Props = {
    text: string
}

export default function AgentSpeechBubble({ text }: Props) {
    if (!text) return null

    // Cắt ngắn nếu quá dài trên đầu 3D model để không che camera
    const displayText = text.length > 140 ? text.slice(0, 140) + '...' : text

    return (
        <div className="relative mb-2 select-none pointer-events-auto transition-all animate-in fade-in zoom-in-95 duration-200">
            <div className="relative max-w-[230px] rounded-xl border border-zinc-700/90 bg-zinc-950/95 p-2.5 text-zinc-100 shadow-2xl backdrop-blur-md">
                <div className="flex items-center gap-1.5 pb-1 border-b border-zinc-800 text-[10px] text-zinc-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Hội thoại gần nhất</span>
                </div>
                <div className="mt-1 text-[11px] leading-relaxed break-words whitespace-pre-wrap font-normal text-zinc-200">
                    {displayText}
                </div>
            </div>
            {/* Arrow pointer */}
            <div className="absolute left-1/2 -bottom-1.5 w-2.5 h-2.5 bg-zinc-950 border-r border-b border-zinc-700/90 rotate-45 -translate-x-1/2" />
        </div>
    )
}