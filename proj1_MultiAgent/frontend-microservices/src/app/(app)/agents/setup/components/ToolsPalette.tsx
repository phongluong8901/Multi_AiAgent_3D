'use client'

import { useDraggable } from '@dnd-kit/core'
import type { Tool } from '@/lib/api'
import { colorFromId } from '@/lib/colorFormId'

type Props = {
    tools: Tool[]
    loading?: boolean
    selectedToolIds?: string[]
    onSelect?: (tool: Tool) => void
}

function DraggableToolCard({
    tool,
    isSelected,
    onSelect,
}: {
    tool: Tool
    isSelected?: boolean
    onSelect?: (tool: Tool) => void
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `tool-${tool.id}`,
        data: { type: 'tool', item: tool },
    })

    const style = transform
        ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
        : undefined

    const accent = colorFromId(tool.id, 320) // lệch về hồng / tím

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={() => onSelect && onSelect(tool)}
            className={`
        group cursor-grab active:cursor-grabbing
        rounded-xl border ${isSelected ? 'border-pink-500 bg-pink-950/30 ring-1 ring-pink-500' : 'border-zinc-700/80 bg-zinc-800/70'}
        px-3 py-2.5 text-sm transition-all duration-150
        hover:bg-zinc-800 hover:border-zinc-600
        ${isDragging ? 'opacity-40 scale-95 shadow-lg' : ''}
      `}
        >
            <div className="flex items-start gap-2.5">
                <span
                    className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-zinc-900"
                    style={{
                        backgroundColor: accent,
                        ['--tw-ring-color' as string]: accent,
                    }}
                />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                        <span className="font-medium text-zinc-100 truncate">{tool.name}</span>
                        {isSelected && (
                            <span className="text-[10px] bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded-full font-mono">
                                Đã gắn
                            </span>
                        )}
                    </div>
                    {tool.description && (
                        <div className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2 leading-relaxed">
                            {tool.description}
                        </div>
                    )}
                    <div className="text-[10px] text-zinc-600 mt-1 font-mono">{tool.id}</div>
                </div>
            </div>
        </div>
    )
}

export default function ToolsPalette({ tools, loading, selectedToolIds = [], onSelect }: Props) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Tools (Công cụ)
                </h3>
                <span className="text-[10px] text-zinc-600">{tools.length}</span>
            </div>

            {loading ? (
                <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-14 rounded-xl bg-zinc-800/50 animate-pulse" />
                    ))}
                </div>
            ) : tools.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-700 py-6 text-center">
                    <p className="text-xs text-zinc-500">Chưa có công cụ</p>
                    <a href="/tools" className="mt-1 inline-block text-[11px] text-pink-400 hover:underline">
                        Khám phá công cụ →
                    </a>
                </div>
            ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {tools.map((t) => (
                        <DraggableToolCard
                            key={t.id}
                            tool={t}
                            isSelected={selectedToolIds.includes(t.id)}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}