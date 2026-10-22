'use client'

import { useDraggable } from '@dnd-kit/core'
import type { Prompt } from '@/lib/api'
import { colorFromId } from '@/lib/colorFormId' // hoặc copy hàm vào đây

type Props = {
    prompts: Prompt[]
    loading?: boolean
}

function DraggablePromptCard({ prompt }: { prompt: Prompt }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `prompt-${prompt.id}`,
        data: { type: 'prompt', item: prompt },
    })

    const style = transform
        ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
        : undefined

    const accent = colorFromId(prompt.id, 200) // lệch về xanh

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`
        group cursor-grab active:cursor-grabbing
        rounded-xl border border-zinc-700/80 bg-zinc-800/70
        px-3 py-2.5 text-sm transition-all duration-150
        hover:bg-zinc-800
        ${isDragging ? 'opacity-40 scale-95 shadow-lg' : ''}
      `}
        >
            <div className="flex items-start gap-2.5">
                {/* Color dot */}
                <span
                    className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-zinc-900"
                    style={{
                        backgroundColor: accent,
                        ['--tw-ring-color' as string]: accent,
                    }}
                />
                <div className="min-w-0 flex-1">
                    <div className="font-medium text-zinc-100 truncate">{prompt.title}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2 leading-relaxed">
                        {prompt.content || 'No content'}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function PromptPalette({ prompts, loading }: Props) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Prompts
                </h3>
                <span className="text-[10px] text-zinc-600">{prompts.length}</span>
            </div>

            {loading ? (
                <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-14 rounded-xl bg-zinc-800/50 animate-pulse" />
                    ))}
                </div>
            ) : prompts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-700 py-6 text-center">
                    <p className="text-xs text-zinc-500">Chưa có prompt</p>
                    <a href="/prompts" className="mt-1 inline-block text-[11px] text-blue-400 hover:underline">
                        Tạo prompt →
                    </a>
                </div>
            ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {prompts.map((p) => (
                        <DraggablePromptCard key={p.id} prompt={p} />
                    ))}
                </div>
            )}
        </div>
    )
}