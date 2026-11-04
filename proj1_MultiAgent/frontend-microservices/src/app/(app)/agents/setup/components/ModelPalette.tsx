'use client'

import { useDraggable } from '@dnd-kit/core'
import Link from 'next/link'
import type { AIModel } from '@/lib/api'
import { colorFromId } from '@/lib/colorFormId'
import { IconCpu, IconServer, IconSparkles, IconExternalLink } from '@/components/ui/icons'

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
    const isRented = model.type === 'rented_p2p' || model.id.startsWith('rented:')

    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `model-${model.id}`,
        data: { type: 'model', item: model },
    })

    const style = transform
        ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
        : undefined

    const accent = isRented ? '#06b6d4' : colorFromId(model.id, 140)

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={() => onSelect && onSelect(model)}
            className={`
        group cursor-grab active:cursor-grabbing
        rounded-xl border transition-all duration-150
        px-3 py-2.5 text-sm
        ${
            isSelected
                ? isRented
                    ? 'border-cyan-400 bg-cyan-950/40 ring-1 ring-cyan-400 shadow-md shadow-cyan-500/10'
                    : 'border-emerald-500 bg-emerald-950/30 ring-1 ring-emerald-500'
                : isRented
                ? 'border-cyan-500/40 bg-cyan-950/15 hover:border-cyan-400 hover:bg-cyan-950/25'
                : 'border-zinc-700/80 bg-zinc-800/70 hover:bg-zinc-800 hover:border-zinc-600'
        }
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
                        {isSelected ? (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-mono shrink-0">
                                Đã chọn
                            </span>
                        ) : isRented ? (
                            <span className="text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider shrink-0">
                                P2P Thuê
                            </span>
                        ) : null}
                    </div>

                    <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1.5">
                        {isRented ? (
                            <span className="text-cyan-400 font-semibold truncate">
                                Trạm {model.nodeName || model.provider}
                            </span>
                        ) : (
                            <span className="text-zinc-500 truncate">{model.provider}</span>
                        )}
                    </div>

                    {model.description && (
                        <div className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                            {model.description}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function ModelPalette({ models, loading, selectedModelId, onSelect }: Props) {
    const rentedModels = models.filter((m) => m.type === 'rented_p2p' || m.id.startsWith('rented:'))
    const standardModels = models.filter((m) => m.type !== 'rented_p2p' && !m.id.startsWith('rented:'))

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
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {/* KHU VỰC 1: MÔ HÌNH ĐÃ THUÊ TỪ MÁY SELLER */}
                    {rentedModels.length > 0 && (
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                    <span>Máy Seller Đã Thuê ({rentedModels.length})</span>
                                </span>
                                <Link
                                    href="/owner"
                                    className="text-[10px] text-zinc-500 hover:text-cyan-400 flex items-center gap-0.5 transition"
                                >
                                    <span>Quản lý thuê</span>
                                    <IconExternalLink className="w-2.5 h-2.5" />
                                </Link>
                            </div>
                            <div className="space-y-2">
                                {rentedModels.map((m) => (
                                    <DraggableModelCard
                                        key={m.id}
                                        model={m}
                                        isSelected={selectedModelId === m.id}
                                        onSelect={onSelect}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* KHU VỰC 2: MÔ HÌNH CLOUD & CỤC BỘ TIÊU CHUẨN */}
                    <div className="space-y-1.5">
                        {rentedModels.length > 0 && (
                            <div className="px-1 pt-1 border-t border-zinc-800">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                    Cloud &amp; Local Tiêu Chuẩn ({standardModels.length})
                                </span>
                            </div>
                        )}
                        <div className="space-y-2">
                            {standardModels.map((m) => (
                                <DraggableModelCard
                                    key={m.id}
                                    model={m}
                                    isSelected={selectedModelId === m.id}
                                    onSelect={onSelect}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Banner gợi ý thuê máy nếu chưa có máy nào */}
                    {rentedModels.length === 0 && (
                        <div className="p-2.5 rounded-xl border border-cyan-500/20 bg-cyan-950/20 text-center space-y-1">
                            <p className="text-[11px] text-cyan-300 font-medium">
                                Cần GPU mạnh hơn cho Agent?
                            </p>
                            <Link
                                href="/owner"
                                className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-bold underline"
                            >
                                <span>Thuê máy trạm Seller P2P</span>
                                <IconExternalLink className="w-3 h-3" />
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}