'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
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
    Agent,
    Prompt,
    Tool,
    AIModel,
    AgentUpdate,
} from '@/lib/api'

import RobotCanvas, { AgentFormType } from '../setup/components/RobotCanvas'
import PromptPalette from '../setup/components/PromptPalette'
import ToolsPalette from '../setup/components/ToolsPalette'
import ModelPalette from '../setup/components/ModelPalette'
import AttachedSlots from '../setup/components/AttachedSlots'
import {
    IconArrowLeft,
    IconMessageSquare,
    IconBuilding,
    IconTrash,
    IconSparkles,
    IconAlertCircle,
    IconX,
    IconSave,
    IconDuck,
    IconAmr,
    IconDrone,
    IconHumanoid,
} from '@/components/ui/icons'

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

import { toast } from 'sonner'
import { useConfirm } from '@/context/ConfirmContext'

export default function AgentDetailPage() {
    const { confirm } = useConfirm()
    const params = useParams()
    const router = useRouter()
    const id = String(params.id)

    const [agent, setAgent] = useState<Agent | null>(null)
    const [name, setName] = useState('')
    const [color, setColor] = useState('#76b900')
    const [agentForm, setAgentForm] = useState<AgentFormType>('humanoid')
    const [status, setStatus] = useState('idle')
    const [speech, setSpeech] = useState('')

    // Attached configs
    const [promptId, setPromptId] = useState<string | null>(null)
    const [selectedTools, setSelectedTools] = useState<string[]>([])
    const [modelId, setModelId] = useState<string | null>(null)

    // Data from API
    const [prompts, setPrompts] = useState<Prompt[]>([])
    const [tools, setTools] = useState<Tool[]>([])
    const [models, setModels] = useState<AIModel[]>([])

    // UI state
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [successMessage, setSuccessMessage] = useState('')
    const [activeDrag, setActiveDrag] = useState<any>(null)

    // Load initial data
    useEffect(() => {
        setLoading(true)
        Promise.all([
            agentsApi.get(id),
            promptsApi.list(),
            toolsApi.list(),
            listModels(),
        ])
            .then(([ag, p, t, m]) => {
                setAgent(ag)
                setName(ag.name || '')
                setColor(ag.color || '#4299e1')
                setStatus(ag.status || 'idle')
                setSpeech(ag.speech || '')

                setPromptId(ag.prompt_id || null)
                // Tools có thể là mảng string ID hoặc mảng Tool object
                if (Array.isArray(ag.tools)) {
                    setSelectedTools(
                        ag.tools.map((item: any) =>
                            typeof item === 'string' ? item : item.id
                        )
                    )
                }

                // Nhận diện chassis robot từ localStorage hoặc keyword
                const savedForm =
                    typeof window !== 'undefined'
                        ? localStorage.getItem(`agent_form:${ag.id}`)
                        : null
                if (savedForm === 'duck' || savedForm === 'amr' || savedForm === 'drone' || savedForm === 'humanoid') {
                    setAgentForm(savedForm as AgentFormType)
                } else {
                    const lower = ((ag.name || '') + ' ' + ag.id).toLowerCase()
                    if (lower.includes('duck') || lower.includes('vit')) setAgentForm('duck')
                    else if (lower.includes('amr') || lower.includes('agv') || lower.includes('xe') || lower.includes('carter')) setAgentForm('amr')
                    else if (lower.includes('drone') || lower.includes('fly') || lower.includes('falcon')) setAgentForm('drone')
                    else setAgentForm('humanoid')
                }

                // Model priority: backend agent.model -> localStorage -> default
                const savedLocalModel =
                    typeof window !== 'undefined'
                        ? localStorage.getItem(`agent_model:${ag.id}`)
                        : null
                const effectiveModel = ag.model || savedLocalModel || 'gemini-2.5-flash-lite'
                setModelId(effectiveModel)

                setPrompts(p ?? [])
                setTools(t ?? [])
                setModels(m ?? [])
            })
            .catch((err) => {
                setError(err instanceof Error ? err.message : 'Không thể tải thông tin Agent')
            })
            .finally(() => setLoading(false))
    }, [id])

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

    // Derived items for AttachedSlots
    const currentPrompt = prompts.find((p) => p.id === promptId) || null
    const currentTools = tools.filter((t) => selectedTools.includes(t.id))
    const currentModel = models.find((m) => m.id === modelId) || null

    // Lưu cập nhật Agent
    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setSuccessMessage('')
        setSaving(true)

        try {
            const chosenModel = modelId || 'gemini-2.5-flash-lite'
            const updatePayload: AgentUpdate = {
                name: name.trim(),
                color,
                status,
                speech: speech.trim() || null,
                model: chosenModel,
                prompt_id: promptId,
                tool_ids: selectedTools,
            }

            const updated = await agentsApi.update(id, updatePayload)
            setAgent(updated)

            // Lưu model preference & form chassis phía client
            if (typeof window !== 'undefined') {
                localStorage.setItem(`agent_form:${id}`, agentForm)
                localStorage.setItem(`agent_model:${id}`, chosenModel)
            }

            setSuccessMessage('Đã lưu cấu hình Agent thành công!')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Lỗi khi lưu thay đổi')
        } finally {
            setSaving(false)
        }
    }

    // Xóa Agent
    async function handleDelete() {
        const isConfirmed = await confirm({
            title: 'Xóa vĩnh viễn Agent',
            description: `Bạn có chắc muốn xóa vĩnh viễn Agent "${name}" (${id}) không? Hành động này không thể hoàn tác.`,
            confirmText: 'Xóa vĩnh viễn',
            variant: 'danger',
        })
        if (!isConfirmed) return
        try {
            await agentsApi.remove(id)
            if (typeof window !== 'undefined') {
                localStorage.removeItem(`agent_model:${id}`)
            }
            toast.success(`Đã xóa vĩnh viễn Agent "${name}"`)
            router.push('/agents')
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Xóa thất bại')
        }
    }

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto py-16 text-center space-y-4">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-zinc-400 font-mono">Đang tải không gian 3D Studio của Agent...</p>
            </div>
        )
    }

    if (!agent && !loading) {
        return (
            <div className="max-w-md mx-auto py-16 text-center space-y-4">
                <p className="text-zinc-400">Không tìm thấy agent với ID: <code className="text-red-400 font-mono">{id}</code></p>
                <Link
                    href="/agents"
                    className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:underline"
                >
                    <IconArrowLeft className="w-4 h-4" />
                    <span>Quay lại danh sách agents</span>
                </Link>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
            {/* Header thanh điều hướng & Thao tác */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-3">
                    <Link
                        href="/agents"
                        className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:text-white hover:border-zinc-700 transition"
                        title="Quay lại danh sách"
                    >
                        <IconArrowLeft className="w-4 h-4" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold text-white">Agent 3D Studio</h1>
                            <span
                                className="w-3 h-3 rounded-full ring-2 ring-white/10"
                                style={{ backgroundColor: color }}
                            />
                            <span className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono px-2 py-0.5 rounded-md">
                                @{id}
                            </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            Xem và tinh chỉnh trực tiếp Prompt, Tools và LLM Model trên robot 3D
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    <Link
                        href={`/chat/${id}`}
                        className="px-3.5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold transition flex items-center gap-1.5"
                    >
                        <IconMessageSquare className="w-3.5 h-3.5" />
                        <span>Chat với Agent</span>
                    </Link>
                    <Link
                        href="/office"
                        className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition flex items-center gap-1.5"
                    >
                        <IconBuilding className="w-3.5 h-3.5" />
                        <span>Xem 3D Office</span>
                    </Link>
                    <button
                        type="button"
                        onClick={handleDelete}
                        className="px-3 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/50 text-red-400 border border-red-500/30 text-xs font-semibold transition flex items-center gap-1.5"
                    >
                        <IconTrash className="w-3.5 h-3.5" />
                        <span>Xóa Agent</span>
                    </button>
                </div>
            </div>

            {/* Thông báo thành công hoặc lỗi */}
            {successMessage && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-xs text-emerald-300 flex items-center justify-between animate-in fade-in">
                    <span className="flex items-center gap-1.5">
                        <IconSparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{successMessage}</span>
                    </span>
                    <button onClick={() => setSuccessMessage('')} className="text-zinc-400 hover:text-white">
                        <IconX className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}
            {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-xs text-red-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                        <IconAlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <span>{error}</span>
                    </span>
                    <button onClick={() => setError('')} className="text-zinc-400 hover:text-white">
                        <IconX className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Khung Drag & Drop đồng nhất với Setup Page */}
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
                            loading={false}
                            selectedPromptId={promptId}
                            onSelect={(p) => setPromptId(p.id)}
                        />
                        <ToolsPalette
                            tools={tools}
                            loading={false}
                            selectedToolIds={selectedTools}
                            onSelect={(t) =>
                                setSelectedTools((prev) =>
                                    prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id]
                                )
                            }
                        />
                    </div>

                    {/* ===== CENTER: Robot 3D + Slots + Form ===== */}
                    <div className="space-y-4">
                        {/* 3D Robot Canvas với màu sắc và tên thực tế của Agent */}
                        <RobotCanvas
                            promptId={promptId}
                            toolCount={selectedTools.length}
                            modelId={modelId}
                            customColor={color}
                            label={name || id}
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

                        {/* Form thông tin Agent */}
                        <form
                            onSubmit={handleSave}
                            className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 space-y-4 shadow-xl"
                        >
                            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
                                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                                    Thông tin định danh & Tính cách
                                </h3>
                                <span className="text-[11px] text-zinc-500 font-mono">ID: {id}</span>
                            </div>

                            {/* CHỌN HÌNH THÁI CHASSIS ROBOT (NVIDIA ROBOTICS FLEET) */}
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

                            <div className="grid sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="block text-xs text-zinc-400 mb-1 font-medium">
                                        Tên Agent
                                    </label>
                                    <input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        placeholder="Ví dụ: Chuyên gia Phân tích..."
                                        className="w-full rounded-xl bg-zinc-800/80 border border-zinc-700/80 px-3.5 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs text-zinc-400 mb-1 font-medium">
                                        Trạng thái hoạt động
                                    </label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                        className="w-full rounded-xl bg-zinc-800/80 border border-zinc-700/80 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition cursor-pointer"
                                    >
                                        <option value="idle">Sẵn sàng (Idle)</option>
                                        <option value="working">Đang xử lý (Working)</option>
                                        <option value="meeting">Hội ý nhóm (Meeting)</option>
                                        <option value="blocked">Tạm ngưng (Blocked)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Bảng màu và Preset Swatches */}
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                                    Màu sơn ngoại thất & Đèn LED
                                </label>
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

                            <div>
                                <label className="block text-xs text-zinc-400 mb-1 font-medium">
                                    Lời chào mặc định / Speech
                                </label>
                                <input
                                    value={speech}
                                    onChange={(e) => setSpeech(e.target.value)}
                                    placeholder="Xin chào! Tôi là trợ lý AI sẵn sàng hỗ trợ..."
                                    className="w-full rounded-xl bg-zinc-800/80 border border-zinc-700/80 px-3.5 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={saving || !name.trim()}
                                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm py-3 transition shadow-lg shadow-blue-500/20 disabled:opacity-50 active:scale-[0.99] flex items-center justify-center gap-2"
                            >
                                <IconSave className="w-4 h-4" />
                                <span>{saving ? 'Đang lưu thay đổi...' : 'Lưu Cập Nhật Agent'}</span>
                            </button>
                        </form>
                    </div>

                    {/* ===== RIGHT: Models ===== */}
                    <div>
                        <ModelPalette
                            models={models}
                            loading={false}
                            selectedModelId={modelId}
                            onSelect={(m) => setModelId(m.id)}
                        />
                    </div>
                </div>

                {/* Drag Overlay */}
                <DragOverlay>
                    {activeDrag ? (
                        <div className="rounded-xl border border-blue-500/80 bg-zinc-800 px-3.5 py-2.5 text-sm shadow-2xl pointer-events-none text-white font-medium">
                            {activeDrag.item?.title || activeDrag.item?.name}
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    )
}