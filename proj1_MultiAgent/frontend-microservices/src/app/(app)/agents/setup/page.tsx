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

import RobotCanvas, { AgentFormType } from './components/RobotCanvas'
import { IconDuck, IconAmr, IconDrone, IconHumanoid } from '@/components/ui/icons'
import PromptPalette from './components/PromptPalette'
import ToolsPalette from './components/ToolsPalette'
import ModelPalette from './components/ModelPalette'
import AttachedSlots from './components/AttachedSlots'

const COLOR_PRESETS = [
    { label: 'MicroDuck Blue', hex: '#7dd3fc' },
    { label: 'Duck Beak Orange', hex: '#f97316' },
    { label: 'NVIDIA Lime', hex: '#76b900' },
    { label: 'Nova Orange', hex: '#f97316' },
    { label: 'Falcon Cyan', hex: '#06b6d4' },
    { label: 'Cobalt Blue', hex: '#3b82f6' },
    { label: 'Stealth Carbon', hex: '#27272a' },
    { label: 'Titanium White', hex: '#e2e8f0' },
]

const FORM_SIGNATURE_COLORS: Record<AgentFormType, string> = {
    humanoid: '#76b900',
    duck: '#7dd3fc',
    amr: '#f97316',
    drone: '#06b6d4',
}

export default function SetupAgentPage() {
    const router = useRouter()

    // Basic info
    const [id, setId] = useState('')
    const [name, setName] = useState('')
    const [color, setColor] = useState('#76b900')
    const [agentForm, setAgentForm] = useState<AgentFormType>('humanoid')

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

            const chosenModel = modelId || 'gemini-2.5-flash-lite'

            await agentsApi.create({
                id: agentId,
                name: name.trim(),
                color,
                status: 'idle',
                speech: null,
                pos_x: 0,
                pos_y: 0,
                pos_z: 0,
                model: chosenModel,
                prompt_id: promptId,
                tool_ids: selectedTools,
            })

            // Lưu model & form preference phía client để backup
            if (typeof window !== 'undefined') {
                localStorage.setItem(`agent_model:${agentId}`, chosenModel)
                localStorage.setItem(`agent_form:${agentId}`, agentForm)
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
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#76b900] shadow-[0_0_8px_#76b900]" />
                        <h1 className="text-xl font-bold tracking-tight text-white">NVIDIA Isaac Robotics Studio · Agent Setup</h1>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                        Cấu hình phần cứng Robot (Project GR00T, MicroDuck Orin, Nova Carter AMR, Cyber Falcon) tích hợp Tensor Core Model, Prompt & Tools.
                    </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-zinc-500">
                    <span className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[#76b900]">ISAAC LAB v2.4</span>
                    <span className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">PHYSX 5.3</span>
                </div>
            </div>

            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="grid lg:grid-cols-[240px_1fr_240px] gap-5">
                    {/* ===== LEFT: Prompts + Tools ===== */}
                    <div className="space-y-6">
                        <PromptPalette
                            prompts={prompts}
                            loading={loadingMeta}
                            selectedPromptId={promptId}
                            onSelect={(p) => setPromptId(p.id)}
                        />
                        <ToolsPalette
                            tools={tools}
                            loading={loadingMeta}
                            selectedToolIds={selectedTools}
                            onSelect={(t) =>
                                setSelectedTools((prev) =>
                                    prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id]
                                )
                            }
                        />
                    </div>

                    {/* ===== CENTER: Robot + Slots + Form ===== */}
                    <div className="space-y-4">
                        {/* 3D Robot */}
                        <RobotCanvas
                            promptId={promptId}
                            toolCount={selectedTools.length}
                            modelId={modelId}
                            customColor={color}
                            label={name || id || 'AGENT CORE'}
                            agentForm={agentForm}
                            onFormChange={setAgentForm}
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
                            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-4"
                        >
                            {/* Chọn Hình Thái Avatar 3D (Form Selection) */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-semibold text-zinc-300">
                                        Hình thái Robot 3D (NVIDIA Robotics Fleet)
                                    </label>
                                    <span className="text-[10px] font-mono text-[#76b900] bg-[#76b900]/10 px-1.5 py-0.5 rounded border border-[#76b900]/30">
                                        ISAAC SIM ENGINE
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {[
                                        { id: 'humanoid', label: 'Project GR00T', desc: 'Biped Robot 2 chân', icon: IconHumanoid, glow: 'hover:border-[#76b900] text-[#76b900]' },
                                        { id: 'duck', label: 'MicroDuck Bipedal', desc: 'Vịt 2 chân Servo AI', icon: IconDuck, glow: 'hover:border-sky-400 text-sky-400' },
                                        { id: 'amr', label: 'Nova Carter AMR', desc: 'Tự hành 360° LiDAR', icon: IconAmr, glow: 'hover:border-orange-500 text-orange-400' },
                                        { id: 'drone', label: 'Cyber Falcon', desc: 'Drone tuần tra RTK', icon: IconDrone, glow: 'hover:border-cyan-400 text-cyan-400' },
                                    ].map((f) => {
                                        const active = agentForm === f.id
                                        const FormIcon = f.icon
                                        return (
                                            <button
                                                key={f.id}
                                                type="button"
                                                onClick={() => {
                                                    const nextForm = f.id as AgentFormType
                                                    setAgentForm(nextForm)
                                                    // Cập nhật màu signature nếu chưa đổi màu custom
                                                    if (Object.values(FORM_SIGNATURE_COLORS).includes(color) || color === '#4299e1') {
                                                        setColor(FORM_SIGNATURE_COLORS[nextForm])
                                                    }
                                                }}
                                                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                                                    active
                                                        ? 'bg-zinc-800/90 border-[#76b900] text-white shadow-[0_0_15px_rgba(118,185,0,0.2)]'
                                                        : 'bg-zinc-800/40 border-zinc-700/60 text-zinc-400 hover:text-white hover:bg-zinc-800 ' + f.glow
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className={`p-1.5 rounded-lg ${active ? 'bg-[#76b900]/20 text-[#76b900]' : 'bg-zinc-700/40 text-zinc-400'}`}>
                                                        <FormIcon className="w-5 h-5" />
                                                    </div>
                                                    {active && (
                                                        <span className="w-2 h-2 rounded-full bg-[#76b900] shadow-[0_0_6px_#76b900]" />
                                                    )}
                                                </div>
                                                <div className="mt-2">
                                                    <div className="text-xs font-semibold truncate">{f.label}</div>
                                                    <div className="text-[10px] text-zinc-500 truncate">{f.desc}</div>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-zinc-400 mb-1">
                                        ID Robot (unique identifier)
                                    </label>
                                    <input
                                        value={id}
                                        onChange={(e) => setId(e.target.value)}
                                        placeholder="orin-robot-01"
                                        className="w-full rounded-lg bg-zinc-800/90 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-[#76b900] font-mono text-zinc-200"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-400 mb-1">
                                        Tên Robot (Display Name)
                                    </label>
                                    <input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        placeholder="Carter AMR"
                                        className="w-full rounded-lg bg-zinc-800/90 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-[#76b900] text-zinc-100"
                                    />
                                </div>
                            </div>

                            {/* Color Theme & Swatches */}
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1.5">Color Theme (Màu sơn ngoại thất & Led)</label>
                                <div className="flex items-center flex-wrap gap-2">
                                    <div className="flex items-center gap-2 pr-2 border-r border-zinc-800">
                                        <input
                                            type="color"
                                            value={color}
                                            onChange={(e) => setColor(e.target.value)}
                                            className="h-8 w-10 rounded border border-zinc-700 bg-zinc-800 cursor-pointer p-0.5"
                                        />
                                        <span className="text-xs font-mono text-zinc-300 uppercase">{color}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {COLOR_PRESETS.map((p) => {
                                            const isSelectedColor = color.toLowerCase() === p.hex.toLowerCase()
                                            return (
                                                <button
                                                    key={p.hex}
                                                    type="button"
                                                    title={p.label}
                                                    onClick={() => setColor(p.hex)}
                                                    className={`w-6 h-6 rounded-full border transition flex items-center justify-center ${
                                                        isSelectedColor
                                                            ? 'border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.4)]'
                                                            : 'border-zinc-700 hover:scale-105'
                                                    }`}
                                                    style={{ backgroundColor: p.hex }}
                                                >
                                                    {isSelectedColor && (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-black/80" />
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <p className="text-red-400 text-xs break-all whitespace-pre-wrap">
                                    {error}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !name.trim()}
                                className="w-full rounded-xl bg-gradient-to-r from-emerald-600 via-[#76b900] to-teal-600 hover:brightness-110 text-black font-semibold text-sm py-2.5 transition shadow-lg shadow-[#76b900]/25 disabled:opacity-50"
                            >
                                {loading ? 'Đang nạp Firmware...' : 'Deploy Agent Core'}
                            </button>
                        </form>
                    </div>

                    {/* ===== RIGHT: Models ===== */}
                    <div>
                        <ModelPalette
                            models={models}
                            loading={loadingMeta}
                            selectedModelId={modelId}
                            onSelect={(m) => setModelId(m.id)}
                        />
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