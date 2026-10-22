'use client'

import { useDroppable } from '@dnd-kit/core'
import type { Prompt, Tool, AIModel } from '@/lib/api'

type Props = {
    prompt: Prompt | null
    tools: Tool[]
    model: AIModel | null
    onRemovePrompt: () => void
    onRemoveTool: (id: string) => void
    onRemoveModel: () => void
}

function Slot({
    id,
    label,
    color,
    children,
    emptyText,
}: {
    id: string
    label: string
    color: 'blue' | 'pink' | 'emerald'
    children?: React.ReactNode
    emptyText: string
}) {
    const { setNodeRef, isOver } = useDroppable({ id })

    const colorMap = {
        blue: {
            border: isOver ? 'border-blue-500' : 'border-zinc-700',
            bg: isOver ? 'bg-blue-500/10' : 'bg-zinc-900/60',
            label: 'text-blue-400',
        },
        pink: {
            border: isOver ? 'border-pink-500' : 'border-zinc-700',
            bg: isOver ? 'bg-pink-500/10' : 'bg-zinc-900/60',
            label: 'text-pink-400',
        },
        emerald: {
            border: isOver ? 'border-emerald-500' : 'border-zinc-700',
            bg: isOver ? 'bg-emerald-500/10' : 'bg-zinc-900/60',
            label: 'text-emerald-400',
        },
    }

    const c = colorMap[color]

    return (
        <div
            ref={setNodeRef}
            className={`
        rounded-xl border-2 border-dashed p-3.5 min-h-[88px]
        transition-all duration-200
        ${c.border} ${c.bg}
      `}
        >
            <div className={`text-[11px] font-medium uppercase tracking-wider mb-2 ${c.label}`}>
                {label}
            </div>

            {children ? (
                children
            ) : (
                <div className="text-xs text-zinc-600 flex items-center gap-1.5">
                    <span className="opacity-60">↓</span>
                    {emptyText}
                </div>
            )}
        </div>
    )
}

export default function AttachedSlots({
    prompt,
    tools,
    model,
    onRemovePrompt,
    onRemoveTool,
    onRemoveModel,
}: Props) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Prompt Slot */}
            <Slot
                id="slot-prompt"
                label="Prompt · Head"
                color="blue"
                emptyText="Kéo prompt vào đây"
            >
                {prompt && (
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <div className="text-sm font-medium text-blue-300 truncate">
                                {prompt.title}
                            </div>
                            <div className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">
                                {prompt.content}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onRemovePrompt}
                            className="shrink-0 text-zinc-500 hover:text-red-400 transition text-sm leading-none"
                            title="Gỡ prompt"
                        >
                            ✕
                        </button>
                    </div>
                )}
            </Slot>

            {/* Tools Slot */}
            <Slot
                id="slot-tools"
                label="Tools · Arms"
                color="pink"
                emptyText="Kéo tools vào đây"
            >
                {tools.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {tools.map((t) => (
                            <span
                                key={t.id}
                                className="inline-flex items-center gap-1 rounded-lg bg-pink-500/15 text-pink-300 text-xs px-2 py-1 border border-pink-500/20"
                            >
                                <span className="truncate max-w-[90px]">{t.name}</span>
                                <button
                                    type="button"
                                    onClick={() => onRemoveTool(t.id)}
                                    className="hover:text-red-400 transition"
                                    title="Gỡ tool"
                                >
                                    ✕
                                </button>
                            </span>
                        ))}
                    </div>
                )}
            </Slot>

            {/* Model Slot */}
            <Slot
                id="slot-model"
                label="Model · Core"
                color="emerald"
                emptyText="Kéo model vào đây"
            >
                {model && (
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <div className="text-sm font-medium text-emerald-300 truncate">
                                {model.name}
                            </div>
                            <div className="text-[11px] text-zinc-500 mt-0.5">
                                {model.provider}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onRemoveModel}
                            className="shrink-0 text-zinc-500 hover:text-red-400 transition text-sm leading-none"
                            title="Gỡ model"
                        >
                            ✕
                        </button>
                    </div>
                )}
            </Slot>
        </div>
    )
}