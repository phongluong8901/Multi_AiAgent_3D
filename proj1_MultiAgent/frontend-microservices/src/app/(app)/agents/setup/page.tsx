'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    useSensor,
    useSensors,
    PointerSensor,
} from '@dnd-kit/core'
import {
    agentsApi,
    promptsApi,
    toolsApi,
    listModels,
    Prompt,
    Tool,
    AIModel,
} from '@/lib/api'

import RobotCanvas from './components/RobotCanvas'
import PromptPalette from './components/PromptPalette'
import ToolsPalette from './components/ToolsPalette'
import ModelPalette from './components/ModelPalette'
import AttachedSlots from './components/AttachedSlots'

export default function SetupAgentPage() {
    const router = useRouter()

    // Basic info
    const [id, setId] = useState('')
    const [name, setName] = useState('')
    const [color, setColor] = useState('#4299e1')

    // Attached configs
    const [promptId, setPromptId] = useState<string | null>(null)
    const [selectedTools, setSelectedTools] = useState<string[]>([])
    const [modelId, setModelId] = useState<string | null>(null)

    // Data from API
    const [prompts, setPrompts] = useState<Prompt[]>([])
    const [tools, setTools] = useState<Tool[]>([])
    const [models, setModels] = useState<AIModel[]>([])

    // UI state
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [loadingMeta, setLoadingMeta] = useState(true)
    const [activeDrag, setActiveDrag] = useState<any>(null)

    // Load meta data
    useEffect(() => {
        Promise.all([promptsApi.list(), toolsApi.list(), listModels()])
            .then(([p, t, m]) => {
                setPrompts(p ?? [])
                setTools(t ?? [])
                setModels(m ?? [])
            })
            .catch((err) => console.error(err))
            .finally(() => setLoadingMeta(false))
    }, [])

    // DnD sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 6 },
        })
    )

    function handleDragStart(event: any) {
        setActiveDrag(event.active.data.current)
    }

    function handleDragEnd(event: DragEndEvent) {
        setActiveDrag(null)
        const { over, active } = event
        if (!over) return

        const data = active.data.current
        if (!data) return

        // Drop vào slot Prompt
        if (over.id === 'slot-prompt' && data.type === 'prompt') {
            setPromptId(data.item.id)
        }

        // Drop vào slot Tools (có thể gắn nhiều)
        if (over.id === 'slot-tools' && data.type === 'tool') {
            setSelectedTools((prev) =>
                prev.includes(data.item.id) ? prev : [...prev, data.item.id]
            )
        }

        // Drop vào slot Model
        if (over.id === 'slot-model' && data.type === 'model') {
            setModelId(data.item.id)
        }
    }

    // Derived data
    const currentPrompt = prompts.find((p) => p.id === promptId) || null
    const currentTools = tools.filter((t) => selectedTools.includes(t.id))
    const currentModel = models.find((m) => m.id === modelId) || null

    // Submit
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const agentId = (
                id.trim() || name.toLowerCase().replace(/\s+/g, '-')
            ).trim()

            if (!agentId) {
                throw new Error('ID hoặc Name không được để trống')
            }

            await agentsApi.create({
                id: agentId,
                name: name.trim(),
                color,
                status: 'idle',
                speech: null,
                pos_x: 0,
                pos_y: 0,
                pos_z: 0,
                prompt_id: promptId,
                tool_ids: selectedTools,
            })

            // Lưu model preference phía client (BE chưa có field)
            if (typeof window !== 'undefined' && modelId) {
                localStorage.setItem(`agent_model:${agentId}`, modelId)
            }

            router.push('/agents')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Create failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-10">
            {/* Header */}
            <div>
                <h1 className="text-xl font-semibold">Setup Agent</h1>
                <p className="text-sm text-zinc-400 mt-1">
                    Kéo Prompt / Tools / Model vào robot để cấu hình agent
                </p>
            </div>

            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="grid lg:grid-cols-[240px_1fr_240px] gap-5">
                    {/* ===== LEFT: Prompts + Tools ===== */}
                    <div className="space-y-6">
                        <PromptPalette prompts={prompts} loading={loadingMeta} />
                        <ToolsPalette tools={tools} loading={loadingMeta} />
                    </div>

                    {/* ===== CENTER: Robot + Slots + Form ===== */}
                    <div className="space-y-4">
                        {/* 3D Robot */}
                        <RobotCanvas
                            promptId={promptId}
                            toolCount={selectedTools.length}
                            modelId={modelId}
                        />

                        {/* Attached slots (drop zones) */}
                        <AttachedSlots
                            prompt={currentPrompt}
                            tools={currentTools}
                            model={currentModel}
                            onRemovePrompt={() => setPromptId(null)}
                            onRemoveTool={(toolId) =>
                                setSelectedTools((prev) => prev.filter((x) => x !== toolId))
                            }
                            onRemoveModel={() => setModelId(null)}
                        />

                        {/* Basic info form */}
                        <form
                            onSubmit={handleSubmit}
                            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3"
                        >
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-zinc-400 mb-1">
                                        ID (unique)
                                    </label>
                                    <input
                                        value={id}
                                        onChange={(e) => setId(e.target.value)}
                                        placeholder="ben"
                                        className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-400 mb-1">
                                        Name
                                    </label>
                                    <input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        placeholder="Ben"
                                        className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-zinc-400 mb-1">Color</label>
                                <input
                                    type="color"
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    className="h-9 w-16 rounded border border-zinc-700 bg-zinc-800 cursor-pointer"
                                />
                            </div>

                            {error && (
                                <p className="text-red-400 text-xs break-all whitespace-pre-wrap">
                                    {error}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !name.trim()}
                                className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm py-2.5 transition font-medium"
                            >
                                {loading ? 'Creating...' : 'Create Agent'}
                            </button>
                        </form>
                    </div>

                    {/* ===== RIGHT: Models ===== */}
                    <div>
                        <ModelPalette models={models} loading={loadingMeta} />
                    </div>
                </div>

                {/* Drag Overlay */}
                <DragOverlay>
                    {activeDrag ? (
                        <div className="rounded-xl border border-blue-500/80 bg-zinc-800 px-3 py-2.5 text-sm shadow-2xl pointer-events-none">
                            <span className="font-medium">
                                {activeDrag.item?.title || activeDrag.item?.name}
                            </span>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    )
}