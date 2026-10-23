'use client'

import { useDraggable } from '@dnd-kit/core'
import type { AIModel } from '@/lib/api'
import { colorFromId } from '@/lib/colorFormId'

type Props = {
    models: AIModel[]
    loading?: boolean
    selectedModelId?: string | null
    onSelect?: (model: AIModel) => void
}

function DraggableModelCard({
    model,
    isSelected,
    onSelect,
}: {
    model: AIModel
    isSelected?: boolean
    onSelect?: (model: AIModel) => void
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `model-${model.id}`,
        data: { type: 'model', item: model },
    })

    const style = transform
        ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
        : undefined

    const accent = colorFromId(model.id, 140) // lệch về xanh lá / teal

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={() => onSelect && onSelect(model)}
            className={`
        group cursor-grab active:cursor-grabbing
        rounded-xl border ${isSelected ? 'border-emerald-500 bg-emerald-950/30 ring-1 ring-emerald-500' : 'border-zinc-700/80 bg-zinc-800/70'}
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
                        <span className="font-medium text-zinc-100 truncate">{model.name}</span>
                        {isSelected && (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-mono">
                                Đã chọn
                            </span>
                        )}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">{model.provider}</div>
                    {model.description && (
                        <div className="text-[11px] text-zinc-600 mt-1 line-clamp-2 leading-relaxed">
                            {model.description}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function ModelPalette({ models, loading, selectedModelId, onSelect }: Props) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    LLM Models
                </h3>
                <span className="text-[10px] text-zinc-600">{models.length}</span>
            </div>

            {loading ? (
                <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-14 rounded-xl bg-zinc-800/50 animate-pulse" />
                    ))}
                </div>
            ) : models.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-700 py-6 text-center">
                    <p className="text-xs text-zinc-500">Không có model</p>
                </div>
            ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {models.map((m) => (
                        <DraggableModelCard
                            key={m.id}
                            model={m}
                            isSelected={selectedModelId === m.id}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}