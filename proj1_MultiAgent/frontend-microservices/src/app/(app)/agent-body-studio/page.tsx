'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
    Activity,
    ArrowLeft,
    Bone,
    Bot,
    Box,
    Circle,
    CircleDot,
    Cog,
    Cone,
    Shield,
    Radar,
    Scissors,
    ArrowDownUp,
    Triangle,
    Cloud,
    Copy,
    Cpu,
    Cylinder,
    Disc3,
    Download,
    Eye,
    EyeOff,
    FileCode,
    FlipHorizontal2,
    FolderOpen,
    Layers,
    LoaderCircle,
    Magnet,
    MousePointer2,
    Move3d,
    Network,
    Pause,
    Pill,
    Play,
    Plus,
    Redo2,
    Rotate3d,
    RotateCcw,
    Save,
    Settings2,
    SlidersHorizontal,
    Trash2,
    TriangleAlert,
    CircleCheck,
    Undo2,
    Upload,
    X,
} from 'lucide-react'
import { AgentBodyCanvas, GizmoMode, JOINT_COLORS } from '@/components/agentBody/AgentBodyCanvas'
import {
    AgentBodyDesign,
    AgentJoint,
    AgentLink,
    BODY_TEMPLATES,
    DEG,
    JointType,
    LinkShape,
    PART_CATALOG,
    PartKind,
    Vec3,
    computeStats,
    createPart,
    duplicateSubtree,
    generateURDF,
    getDescendantLinkIds,
    getParentJoint,
    jointRange,
    removeSubtree,
    round,
    validateBody,
} from '@/lib/agentBody/agentBodyTypes'
import { agentBodiesApi, CloudAgentBody } from '@/lib/api/agentBodies'
import { getUser } from '@/lib/auth'
import { notify } from '@/lib/toast'
import { useConfirm } from '@/context/ConfirmContext'

const LOCAL_STORAGE_KEY = 'agent_body_studio_design_v1'
const CATEGORIES = ['custom', 'quadruped', 'humanoid', 'manipulator', 'wheeled', 'modular']

function partIcon(kind: PartKind | LinkShape, className = 'w-4 h-4') {
    switch (kind) {
        case 'box':
            return <Box className={`${className} text-zinc-300`} />
        case 'capsule':
            return <Pill className={`${className} text-blue-400`} />
        case 'cylinder':
            return <Cylinder className={`${className} text-amber-400`} />
        case 'sphere':
            return <Circle className={`${className} text-cyan-400`} />
        case 'cone':
            return <Cone className={`${className} text-orange-400`} />
        case 'torus':
            return <CircleDot className={`${className} text-pink-400`} />
        case 'gear':
            return <Cog className={`${className} text-purple-400`} />
        case 'wedge':
            return <Triangle className={`${className} text-teal-400`} />
        case 'spring':
            return <Activity className={`${className} text-yellow-400`} />
        case 'extrusion':
            return <Layers className={`${className} text-indigo-400`} />
        case 'wheel':
            return <Disc3 className={`${className} text-orange-400`} />
        case 'limb':
            return <Bone className={`${className} text-[#76b900]`} />
        case 'gripper':
            return <Scissors className={`${className} text-sky-400`} />
        case 'lidar_turret':
            return <Radar className={`${className} text-cyan-400`} />
        case 'piston':
            return <ArrowDownUp className={`${className} text-amber-400`} />
        case 'armor':
            return <Shield className={`${className} text-slate-300`} />
        default:
            return <Box className={`${className} text-zinc-400`} />
    }
}

// ─── Small form controls ──────────────────────────────────────

function NumField({
    label,
    value,
    onChange,
    step = 0.01,
    min,
    max,
    suffix,
}: {
    label?: string
    value: number
    onChange: (v: number) => void
    step?: number
    min?: number
    max?: number
    suffix?: string
}) {
    return (
        <label className="flex flex-col gap-0.5 min-w-0">
            {label && <span className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</span>}
            <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg focus-within:border-cyan-500/60">
                <input
                    type="number"
                    value={Number.isFinite(value) ? value : 0}
                    step={step}
                    min={min}
                    max={max}
                    onChange={(e) => {
                        const v = parseFloat(e.target.value)
                        if (Number.isFinite(v)) onChange(v)
                    }}
                    className="w-full bg-transparent px-2 py-1 text-xs font-mono text-zinc-100 outline-none"
                />
                {suffix && <span className="pr-2 text-[10px] text-zinc-500">{suffix}</span>}
            </div>
        </label>
    )
}

function Vec3Field({
    label,
    value,
    onChange,
    step = 0.01,
    degrees = false,
}: {
    label: string
    value: Vec3
    onChange: (v: Vec3) => void
    step?: number
    degrees?: boolean
}) {
    const show = (n: number) => (degrees ? round(n / DEG, 2) : round(n, 4))
    const parse = (n: number) => (degrees ? n * DEG : n)
    const axes = degrees ? ['R', 'P', 'Y'] : ['X', 'Y', 'Z']
    return (
        <div className="space-y-1">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wide">
                {label} {degrees ? '(độ)' : '(m)'}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg focus-within:border-cyan-500/60">
                        <span className={`pl-1.5 text-[10px] font-bold ${i === 0 ? 'text-red-400' : i === 1 ? 'text-[#76b900]' : 'text-blue-400'}`}>
                            {axes[i]}
                        </span>
                        <input
                            type="number"
                            step={degrees ? 1 : step}
                            value={show(value[i])}
                            onChange={(e) => {
                                const v = parseFloat(e.target.value)
                                if (!Number.isFinite(v)) return
                                const next: Vec3 = [...value]
                                next[i] = parse(v)
                                onChange(next)
                            }}
                            className="w-full bg-transparent px-1 py-1 text-xs font-mono text-zinc-100 outline-none"
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className="w-full flex items-center justify-between gap-2 py-1 text-left"
            title={hint}
        >
            <span className="text-xs text-zinc-300">{label}</span>
            <span className={`w-8 h-4 rounded-full relative transition ${checked ? 'bg-cyan-600' : 'bg-zinc-700'}`}>
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${checked ? 'left-4.5' : 'left-0.5'}`} style={{ left: checked ? 18 : 2 }} />
            </span>
        </button>
    )
}

function Section({ title, icon, children, right }: { title: string; icon: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) {
    return (
        <div className="border-b border-zinc-800 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    {icon}
                    {title}
                </span>
                {right}
            </div>
            {children}
        </div>
    )
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div
                className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[85vh] flex flex-col rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                    <h3 className="text-sm font-bold text-white">{title}</h3>
                    <button onClick={onClose} className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">{children}</div>
            </div>
        </div>
    )
}

function downloadText(filename: string, text: string, mime: string) {
    const blob = new Blob([text], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}

// ─── Page ─────────────────────────────────────────────────────

export default function AgentBodyStudioPage() {
    const { confirm } = useConfirm()
    const [design, setDesign] = useState<AgentBodyDesign>(() => BODY_TEMPLATES.quadruped.build())
    const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null)
    const [jointPositions, setJointPositions] = useState<Record<string, number>>({})
    const [animate, setAnimate] = useState(false)
    const [showJoints, setShowJoints] = useState(true)
    const [xray, setXray] = useState(false)
    const [gizmoMode, setGizmoMode] = useState<GizmoMode>('translate')
    const [snap, setSnap] = useState(true)
    const [motionPanelOpen, setMotionPanelOpen] = useState(true)

    // History (undo / redo)
    const past = useRef<AgentBodyDesign[]>([])
    const future = useRef<AgentBodyDesign[]>([])
    const lastEdit = useRef<{ tag: string; at: number }>({ tag: '', at: 0 })
    const [, forceHistoryRender] = useState(0)

    // Modals
    const [cloudOpen, setCloudOpen] = useState(false)
    const [cloudBodies, setCloudBodies] = useState<CloudAgentBody[]>([])
    const [cloudLoading, setCloudLoading] = useState(false)
    const [saveOpen, setSaveOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [jsonOpen, setJsonOpen] = useState(false)
    const [jsonText, setJsonText] = useState('')
    const [urdfOpen, setUrdfOpen] = useState(false)

    useEffect(() => {
        try {
            const saved = localStorage.getItem(LOCAL_STORAGE_KEY)
            if (saved) {
                const parsed = JSON.parse(saved) as AgentBodyDesign
                if (Array.isArray(parsed?.links) && Array.isArray(parsed?.joints) && parsed.rootLinkId) setDesign(parsed)
            }
        } catch (e) {
            console.error('[ERROR] Failed to load local agent body', e)
        }
    }, [])

    /** Cập nhật design có ghi lịch sử. Các thay đổi liên tiếp cùng `tag` trong 800ms được gộp. */
    const updateDesign = useCallback((fn: (d: AgentBodyDesign) => AgentBodyDesign, tag = '') => {
        setDesign((prev) => {
            const next = fn(prev)
            if (next === prev) return prev
            const now = performance.now()
            const merge = tag !== '' && lastEdit.current.tag === tag && now - lastEdit.current.at < 800
            if (!merge) {
                past.current.push(prev)
                if (past.current.length > 100) past.current.shift()
            }
            future.current = []
            lastEdit.current = { tag, at: now }
            return next
        })
        forceHistoryRender((n) => n + 1)
    }, [])

    const replaceDesign = useCallback((next: AgentBodyDesign) => {
        setDesign((prev) => {
            past.current.push(prev)
            future.current = []
            return next
        })
        setSelectedLinkId(null)
        setJointPositions({})
        lastEdit.current = { tag: '', at: 0 }
        forceHistoryRender((n) => n + 1)
    }, [])

    const undo = useCallback(() => {
        const prev = past.current.pop()
        if (!prev) return
        setDesign((cur) => {
            future.current.push(cur)
            return prev
        })
        lastEdit.current = { tag: '', at: 0 }
        forceHistoryRender((n) => n + 1)
    }, [])

    const redo = useCallback(() => {
        const next = future.current.pop()
        if (!next) return
        setDesign((cur) => {
            past.current.push(cur)
            return next
        })
        lastEdit.current = { tag: '', at: 0 }
        forceHistoryRender((n) => n + 1)
    }, [])

    // Derived
    const selectedLink = design.links.find((l) => l.id === selectedLinkId) || null
    const parentJoint = selectedLinkId ? getParentJoint(design, selectedLinkId) : undefined
    const stats = useMemo(() => computeStats(design), [design])
    const errors = useMemo(() => validateBody(design), [design])
    const actuatedJoints = design.joints.filter((j) => j.type !== 'fixed')
    const parentCandidates = useMemo(() => {
        if (!selectedLinkId) return []
        const blocked = getDescendantLinkIds(design, selectedLinkId)
        return design.links.filter((l) => !blocked.has(l.id))
    }, [design, selectedLinkId])

    // ─── Mutations ────────────────────────────────────────────

    const updateLink = (id: string, patch: Partial<AgentLink>, tag = 'link') =>
        updateDesign((d) => ({ ...d, links: d.links.map((l) => (l.id === id ? { ...l, ...patch } : l)) }), `${tag}:${id}`)

    const updateJoint = (id: string, patch: Partial<AgentJoint>, tag = 'joint') =>
        updateDesign((d) => ({ ...d, joints: d.joints.map((j) => (j.id === id ? { ...j, ...patch } : j)) }), `${tag}:${id}`)

    const handleAddPart = (kind: PartKind) => {
        const parentId = selectedLinkId ?? design.rootLinkId
        const parent = design.links.find((l) => l.id === parentId)
        if (!parent) return
        const part = createPart(kind, parent, design.links.length)
        updateDesign((d) => ({ ...d, links: [...d.links, ...part.links], joints: [...d.joints, ...part.joints] }))
        setSelectedLinkId(part.selectId)
        notify.success(`[ADD] Đã gắn '${part.links[0].name}' vào '${parent.name}'`)
    }

    const handleDeleteSelected = useCallback(() => {
        if (!selectedLinkId) return
        if (selectedLinkId === design.rootLinkId) {
            notify.error('Không thể xoá root link. Hãy chọn template khác hoặc đổi root.')
            return
        }
        updateDesign((d) => removeSubtree(d, selectedLinkId))
        setSelectedLinkId(null)
    }, [selectedLinkId, design.rootLinkId, updateDesign])

    const handleDuplicate = useCallback(
        (mirror: boolean) => {
            if (!selectedLinkId) return
            const res = duplicateSubtree(design, selectedLinkId, mirror)
            if (!res) {
                notify.error('Không thể nhân bản root link.')
                return
            }
            updateDesign(() => res.design)
            setSelectedLinkId(res.newRootId)
            notify.success(mirror ? '[MIRROR] Đã tạo nhánh đối xứng trái/phải' : '[COPY] Đã nhân bản nhánh')
        },
        [design, selectedLinkId, updateDesign]
    )

    const handleReparent = (newParentId: string) => {
        if (!parentJoint) return
        updateJoint(parentJoint.id, { parentLinkId: newParentId }, 'reparent')
    }

    const handleJointTypeChange = (j: AgentJoint, type: JointType) => {
        let limit = { ...j.limit }
        if (type === 'prismatic' && j.type !== 'prismatic') limit = { ...limit, lower: -0.1, upper: 0.1, velocity: 0.5 }
        if ((type === 'revolute' || type === 'continuous') && j.type === 'prismatic')
            limit = { ...limit, lower: -90 * DEG, upper: 90 * DEG, velocity: 5 }
        updateJoint(j.id, { type, limit, actuated: type === 'fixed' ? false : j.actuated || j.type === 'fixed' })
        setJointPositions((p) => {
            const n = { ...p }
            delete n[j.id]
            return n
        })
    }

    const handleJointTransform = useCallback(
        (jointId: string, origin: Vec3, originRotation: Vec3) => {
            updateDesign(
                (d) => ({ ...d, joints: d.joints.map((j) => (j.id === jointId ? { ...j, origin, originRotation } : j)) }),
                `gizmo:${jointId}`
            )
        },
        [updateDesign]
    )

    // ─── Keyboard shortcuts ───────────────────────────────────

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
            const k = e.key.toLowerCase()
            if ((e.ctrlKey || e.metaKey) && k === 'z') {
                e.preventDefault()
                if (e.shiftKey) redo()
                else undo()
            } else if ((e.ctrlKey || e.metaKey) && k === 'y') {
                e.preventDefault()
                redo()
            } else if ((e.ctrlKey || e.metaKey) && k === 'd') {
                e.preventDefault()
                handleDuplicate(false)
            } else if (k === 'delete' || k === 'backspace') {
                handleDeleteSelected()
            } else if (k === 'q') setGizmoMode('none')
            else if (k === 'w') setGizmoMode('translate')
            else if (k === 'e') setGizmoMode('rotate')
            else if (k === 'm') handleDuplicate(true)
            else if (k === ' ') {
                e.preventDefault()
                setAnimate((a) => !a)
            } else if (k === 'escape') setSelectedLinkId(null)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [undo, redo, handleDeleteSelected, handleDuplicate])

    // ─── Persistence ──────────────────────────────────────────

    const handleSaveLocal = () => {
        const updated = { ...design, updatedAt: new Date().toISOString() }
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated))
        setDesign(updated)
        notify.success('Đã lưu agent body vào Local Storage.')
    }

    const fetchCloud = async () => {
        setCloudLoading(true)
        try {
            const res = await agentBodiesApi.getBodies({ userId: getUser()?.id })
            setCloudBodies(res?.data || [])
        } catch (e) {
            notify.error('Không thể kết nối mapdraw-service: ' + (e as Error).message)
        } finally {
            setCloudLoading(false)
        }
    }

    const handleSaveCloud = async () => {
        if (!design.name.trim()) {
            notify.error('Vui lòng nhập tên agent body.')
            return
        }
        if (errors.length > 0) {
            notify.error(`Cấu trúc chưa hợp lệ: ${errors[0]}`)
            return
        }
        setSaving(true)
        try {
            const user = getUser()
            const res = await agentBodiesApi.saveBody({
                ...design,
                name: design.name.trim(),
                userId: user?.id || 'anonymous',
                userName: user?.name || user?.email || 'Thành viên',
                tags: ['AgentBody', design.category],
            })
            if (res?.success) {
                setDesign((d) => ({ ...d, bodyId: res.data.bodyId, updatedAt: res.data.updatedAt }))
                notify.success(res.message || 'Đã lưu agent body lên Cloud.')
                setSaveOpen(false)
            }
        } catch (e) {
            notify.error('Lỗi lưu Cloud: ' + (e as Error).message)
        } finally {
            setSaving(false)
        }
    }

    const handleLoadCloud = (b: CloudAgentBody) => {
        replaceDesign({
            bodyId: b.bodyId,
            name: b.name,
            description: b.description,
            category: b.category || 'custom',
            rootLinkId: b.rootLinkId,
            spawnHeight: b.spawnHeight ?? 0.5,
            links: b.links || [],
            joints: b.joints || [],
            updatedAt: b.updatedAt,
        })
        setCloudOpen(false)
        notify.success(`Đã nạp '${b.name}' (${b.links.length} links, ${b.joints.length} joints).`)
    }

    const handleDeleteCloud = async (b: CloudAgentBody) => {
        const ok = await confirm({
            title: 'Xoá agent body',
            description: `Xoá '${b.name}' khỏi Cloud? Hành động này không thể hoàn tác.`,
            confirmText: 'Xoá',
            variant: 'danger',
        })
        if (!ok) return
        try {
            await agentBodiesApi.deleteBody(b.bodyId)
            setCloudBodies((list) => list.filter((x) => x.bodyId !== b.bodyId))
            notify.success(`Đã xoá '${b.name}'.`)
        } catch (e) {
            notify.error('Lỗi xoá: ' + (e as Error).message)
        }
    }

    const handleApplyJson = () => {
        try {
            const parsed = JSON.parse(jsonText) as AgentBodyDesign
            if (!Array.isArray(parsed.links) || !Array.isArray(parsed.joints) || !parsed.rootLinkId)
                throw new Error('Cần các trường links[], joints[], rootLinkId.')
            replaceDesign({ ...parsed, category: parsed.category || 'custom', spawnHeight: parsed.spawnHeight ?? 0.5 })
            setJsonOpen(false)
            notify.success('Đã nhập agent body từ JSON.')
        } catch (e) {
            notify.error('JSON không hợp lệ: ' + (e as Error).message)
        }
    }

    const urdfText = useMemo(() => (urdfOpen ? generateURDF(design) : ''), [urdfOpen, design])
    const fileBase = (design.name || 'agent_body').replace(/[^a-zA-Z0-9_-]/g, '_')

    // ─── Tree view ────────────────────────────────────────────

    const renderTree = (linkId: string, depth: number): React.ReactNode => {
        const l = design.links.find((x) => x.id === linkId)
        if (!l) return null
        const pj = getParentJoint(design, linkId)
        const kids = design.joints.filter((j) => j.parentLinkId === linkId)
        const active = selectedLinkId === linkId
        return (
            <div key={linkId}>
                <button
                    onClick={() => setSelectedLinkId(linkId)}
                    className={`w-full flex items-center gap-1.5 py-1 pr-2 rounded-md text-left text-[11px] transition ${
                        active ? 'bg-cyan-950/70 text-white ring-1 ring-cyan-500/50' : 'text-zinc-300 hover:bg-zinc-800/70'
                    }`}
                    style={{ paddingLeft: 6 + depth * 12 }}
                >
                    {pj ? (
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: JOINT_COLORS[pj.type] }} title={`${pj.name} (${pj.type})`} />
                    ) : (
                        <Bot className="w-3 h-3 text-[#76b900] shrink-0" />
                    )}
                    <span className="truncate flex-1 font-medium">{l.name}</span>
                    {pj && <span className="text-[9px] text-zinc-500 font-mono truncate max-w-[80px]">{pj.name}</span>}
                </button>
                {kids.map((j) => renderTree(j.childLinkId, depth + 1))}
            </div>
        )
    }

    const canUndo = past.current.length > 0
    const canRedo = future.current.length > 0

    return (
        <div className="relative flex flex-col h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-zinc-950 text-white font-sans">
            {/* ===== TOP BAR ===== */}
            <header className="h-14 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur px-4 flex items-center justify-between gap-4 shrink-0 z-20">
                <div className="flex items-center gap-3 min-w-0">
                    <Link
                        href="/maps/setup"
                        className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition text-xs font-medium flex items-center gap-1.5"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Map Studio</span>
                    </Link>
                    <div className="h-4 w-px bg-zinc-800" />
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-[#76b900]/15 border border-[#76b900]/40 flex items-center justify-center">
                            <Bot className="w-4 h-4 text-[#76b900]" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="font-bold text-sm tracking-tight flex items-center gap-2">
                                <span>Agent Body Studio</span>
                                <span className="text-[10px] bg-[#76b900]/15 text-[#a3e635] border border-[#76b900]/40 px-1.5 py-0.5 rounded font-mono">
                                    URDF Ready
                                </span>
                            </h1>
                            <p className="text-[11px] text-zinc-400 truncate">Thiết kế thân robot, khớp nối và động cơ để huấn luyện chuyển động (RL)</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs shrink-0">
                    <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-1">
                        <span className="text-zinc-500 text-[11px]">Template:</span>
                        <select
                            value=""
                            onChange={async (e) => {
                                const key = e.target.value
                                if (!key) return
                                const ok = await confirm({
                                    title: 'Nạp template',
                                    description: `Thay thế thiết kế hiện tại bằng '${BODY_TEMPLATES[key].label}'? (Có thể Undo)`,
                                    confirmText: 'Nạp template',
                                })
                                if (ok) replaceDesign(BODY_TEMPLATES[key].build())
                            }}
                            className="bg-transparent text-zinc-200 outline-none cursor-pointer font-medium text-xs"
                        >
                            <option value="" className="bg-zinc-900">
                                Chọn mẫu...
                            </option>
                            {Object.entries(BODY_TEMPLATES).map(([k, t]) => (
                                <option key={k} value={k} className="bg-zinc-900">
                                    {t.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center rounded-xl border border-zinc-800 overflow-hidden">
                        <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" className="p-1.5 px-2 hover:bg-zinc-800 disabled:opacity-30">
                            <Undo2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" className="p-1.5 px-2 hover:bg-zinc-800 disabled:opacity-30 border-l border-zinc-800">
                            <Redo2 className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <button
                        onClick={() => {
                            setCloudOpen(true)
                            fetchCloud()
                        }}
                        className="px-3 py-1.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-500/30 font-medium transition flex items-center gap-1.5"
                    >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Body Cloud</span>
                    </button>
                    <button
                        onClick={() => setSaveOpen(true)}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-medium text-white transition flex items-center gap-1.5 shadow"
                    >
                        <Cloud className="w-3.5 h-3.5" />
                        <span>Lưu Cloud</span>
                    </button>
                    <button
                        onClick={handleSaveLocal}
                        className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 font-medium transition flex items-center gap-1.5"
                    >
                        <Save className="w-3.5 h-3.5" />
                        <span>Local</span>
                    </button>
                    <button
                        onClick={() => {
                            setJsonText(JSON.stringify(design, null, 2))
                            setJsonOpen(true)
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-medium transition flex items-center gap-1.5"
                    >
                        <Upload className="w-3.5 h-3.5" />
                        <span>JSON</span>
                    </button>
                    <button
                        onClick={() => setUrdfOpen(true)}
                        className="px-3 py-1.5 rounded-xl bg-[#76b900]/90 hover:bg-[#76b900] text-black font-semibold transition flex items-center gap-1.5"
                    >
                        <FileCode className="w-3.5 h-3.5" />
                        <span>Xuất URDF</span>
                    </button>
                </div>
            </header>

            <div className="flex flex-1 min-h-0">
                {/* ===== LEFT: PART LIBRARY + HIERARCHY ===== */}
                <aside className="w-72 border-r border-zinc-800 bg-zinc-900/50 backdrop-blur flex flex-col shrink-0 z-10">
                    <div className="p-3 border-b border-zinc-800 space-y-2">
                        <div className="text-xs font-bold uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-cyan-400" />
                            Thư viện bộ phận
                        </div>
                        <p className="text-[10px] text-zinc-500">
                            Gắn vào: <span className="text-cyan-300 font-mono">{selectedLink?.name ?? design.links.find((l) => l.id === design.rootLinkId)?.name ?? '-'}</span>
                        </p>
                        {/* Nhóm Bộ Phận */}
                        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                            <div>
                                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <Box className="w-3 h-3 text-cyan-400" />
                                    1. Khối cơ bản
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {PART_CATALOG.filter((p) => p.category === 'basic').map((p) => (
                                        <button
                                            key={p.kind}
                                            onClick={() => handleAddPart(p.kind)}
                                            title={p.description}
                                            className="p-1.5 rounded-xl border border-zinc-800 bg-zinc-950/60 hover:border-cyan-500/50 hover:bg-cyan-950/30 transition flex items-center gap-2 text-left"
                                        >
                                            <div className="w-6 h-6 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">{partIcon(p.kind, 'w-3.5 h-3.5')}</div>
                                            <div className="min-w-0">
                                                <div className="text-[10px] font-semibold text-zinc-200 truncate">{p.name}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <Cog className="w-3 h-3 text-purple-400" />
                                    2. Cơ khí phức tạp (Three.js 3D)
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {PART_CATALOG.filter((p) => p.category === 'advanced').map((p) => (
                                        <button
                                            key={p.kind}
                                            onClick={() => handleAddPart(p.kind)}
                                            title={p.description}
                                            className="p-1.5 rounded-xl border border-purple-900/40 bg-zinc-950/60 hover:border-purple-500/60 hover:bg-purple-950/30 transition flex items-center gap-2 text-left"
                                        >
                                            <div className="w-6 h-6 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">{partIcon(p.kind, 'w-3.5 h-3.5')}</div>
                                            <div className="min-w-0">
                                                <div className="text-[10px] font-semibold text-purple-200 truncate">{p.name}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <Layers className="w-3 h-3 text-amber-400" />
                                    3. Cụm lắp sẵn (Assemblies)
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {PART_CATALOG.filter((p) => p.category === 'assembly').map((p) => (
                                        <button
                                            key={p.kind}
                                            onClick={() => handleAddPart(p.kind)}
                                            title={p.description}
                                            className="p-1.5 rounded-xl border border-amber-900/40 bg-zinc-950/60 hover:border-amber-500/60 hover:bg-amber-950/30 transition flex items-center gap-2 text-left"
                                        >
                                            <div className="w-6 h-6 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">{partIcon(p.kind, 'w-3.5 h-3.5')}</div>
                                            <div className="min-w-0">
                                                <div className="text-[10px] font-semibold text-amber-200 truncate">{p.name}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="px-3 pt-3 pb-1 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
                            <Network className="w-3.5 h-3.5 text-[#76b900]" />
                            Cây động học
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500">{design.links.length} links</span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-2 pb-2">{renderTree(design.rootLinkId, 0)}</div>

                    <div className="p-3 border-t border-zinc-800 bg-zinc-950/40 text-[10px] text-zinc-500 space-y-0.5 font-mono">
                        <div>
                            <span className="text-zinc-300">Q/W/E</span> chọn / di chuyển / xoay khớp
                        </div>
                        <div>
                            <span className="text-zinc-300">M</span> đối xứng nhánh, <span className="text-zinc-300">Ctrl+D</span> nhân bản
                        </div>
                        <div>
                            <span className="text-zinc-300">Space</span> test chuyển động, <span className="text-zinc-300">Del</span> xoá
                        </div>
                    </div>
                </aside>

                {/* ===== CENTER: 3D CANVAS ===== */}
                <div className="flex-1 relative min-w-0 min-h-0 flex flex-col">
                    {/* Floating toolbar */}
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 p-1 rounded-xl bg-black/80 border border-zinc-800 backdrop-blur shadow-xl">
                        {(
                            [
                                ['none', <MousePointer2 key="n" className="w-3.5 h-3.5" />, 'Chọn (Q)'],
                                ['translate', <Move3d key="t" className="w-3.5 h-3.5" />, 'Di chuyển gốc khớp (W)'],
                                ['rotate', <Rotate3d key="r" className="w-3.5 h-3.5" />, 'Xoay gốc khớp (E)'],
                            ] as [GizmoMode, React.ReactNode, string][]
                        ).map(([mode, icon, title]) => (
                            <button
                                key={mode}
                                onClick={() => setGizmoMode(mode)}
                                title={title}
                                className={`p-1.5 rounded-lg transition ${gizmoMode === mode ? 'bg-cyan-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                            >
                                {icon}
                            </button>
                        ))}
                        <div className="w-px h-5 bg-zinc-800 mx-0.5" />
                        <button
                            onClick={() => setSnap((s) => !s)}
                            title="Snap 1cm / 5 độ"
                            className={`p-1.5 rounded-lg transition ${snap ? 'bg-zinc-700 text-amber-300' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
                        >
                            <Magnet className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => setShowJoints((s) => !s)}
                            title="Hiện/ẩn khớp"
                            className={`p-1.5 rounded-lg transition ${showJoints ? 'bg-zinc-700 text-cyan-300' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
                        >
                            {showJoints ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                        <button
                            onClick={() => setXray((s) => !s)}
                            title="X-ray (xuyên thấu)"
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${xray ? 'bg-zinc-700 text-violet-300' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
                        >
                            X-RAY
                        </button>
                        <div className="w-px h-5 bg-zinc-800 mx-0.5" />
                        <button
                            onClick={() => setAnimate((a) => !a)}
                            title="Test chuyển động toàn bộ khớp (Space)"
                            className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition ${
                                animate ? 'bg-[#76b900] text-black' : 'text-zinc-300 hover:bg-zinc-800'
                            }`}
                        >
                            {animate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            Motion
                        </button>
                        <button
                            onClick={() => {
                                setJointPositions({})
                                setAnimate(false)
                            }}
                            title="Về tư thế mặc định"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="flex-1 min-h-0">
                        <AgentBodyCanvas
                            design={design}
                            selectedLinkId={selectedLinkId}
                            onSelectLink={setSelectedLinkId}
                            jointPositions={jointPositions}
                            animate={animate}
                            showJoints={showJoints}
                            xray={xray}
                            gizmoMode={gizmoMode}
                            snap={snap}
                            onJointTransform={handleJointTransform}
                        />
                    </div>

                    {/* Motion / joint test panel */}
                    <div className="border-t border-zinc-800 bg-zinc-900/90 backdrop-blur shrink-0">
                        <button
                            onClick={() => setMotionPanelOpen((o) => !o)}
                            className="w-full px-3 py-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white"
                        >
                            <span className="flex items-center gap-1.5">
                                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                                Bảng điều khiển khớp ({actuatedJoints.length} DOF)
                            </span>
                            <span className="font-mono text-[10px] normal-case text-zinc-500">{motionPanelOpen ? 'Thu gọn' : 'Mở rộng'}</span>
                        </button>
                        {motionPanelOpen && (
                            <div className="max-h-44 overflow-y-auto px-3 pb-3 grid grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-2">
                                {actuatedJoints.length === 0 && <div className="text-xs text-zinc-500 col-span-full">Chưa có khớp chuyển động. Thêm bộ phận từ thư viện bên trái.</div>}
                                {actuatedJoints.map((j) => {
                                    const [lo, hi] = jointRange(j)
                                    const v = jointPositions[j.id] ?? j.defaultPosition
                                    const isAngle = j.type !== 'prismatic'
                                    const child = design.links.find((l) => l.id === j.childLinkId)
                                    return (
                                        <div
                                            key={j.id}
                                            className={`rounded-lg px-2 py-1 border transition ${
                                                selectedLinkId === j.childLinkId ? 'border-cyan-500/50 bg-cyan-950/30' : 'border-transparent'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between text-[10px]">
                                                <button onClick={() => setSelectedLinkId(child?.id ?? null)} className="flex items-center gap-1.5 font-mono text-zinc-300 hover:text-white truncate">
                                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: JOINT_COLORS[j.type] }} />
                                                    {j.name}
                                                    {!j.actuated && <span className="text-zinc-600">(passive)</span>}
                                                </button>
                                                <span className="font-mono text-zinc-500">{isAngle ? `${round(v / DEG, 1)}°` : `${round(v, 3)} m`}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min={lo}
                                                max={hi}
                                                step={isAngle ? 0.5 * DEG : 0.001}
                                                value={v}
                                                disabled={animate}
                                                onChange={(e) => setJointPositions((p) => ({ ...p, [j.id]: parseFloat(e.target.value) }))}
                                                className="w-full accent-cyan-500 h-1"
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* ===== RIGHT: INSPECTOR ===== */}
                <aside className="w-80 border-l border-zinc-800 bg-zinc-900/50 backdrop-blur flex flex-col shrink-0 z-10 overflow-y-auto">
                    {selectedLink ? (
                        <>
                            <Section
                                title="Link (khối thân)"
                                icon={<Box className="w-3.5 h-3.5 text-cyan-400" />}
                                right={
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => handleDuplicate(false)} title="Nhân bản nhánh (Ctrl+D)" className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800">
                                            <Copy className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => handleDuplicate(true)} title="Đối xứng trái/phải (M)" className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800">
                                            <FlipHorizontal2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={handleDeleteSelected} title="Xoá nhánh (Del)" className="p-1 rounded-md text-rose-400 hover:text-rose-300 hover:bg-rose-950/50">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                }
                            >
                                <label className="flex flex-col gap-0.5">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Tên</span>
                                    <input
                                        value={selectedLink.name}
                                        onChange={(e) => updateLink(selectedLink.id, { name: e.target.value.replace(/\s+/g, '_') }, 'name')}
                                        className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs font-mono outline-none focus:border-cyan-500/60"
                                    />
                                </label>
                                <div className="space-y-1">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Hình Dạng 3D (10 Shapes)</span>
                                    <div className="grid grid-cols-5 gap-1">
                                        {(['box', 'capsule', 'cylinder', 'sphere', 'cone', 'torus', 'gear', 'wedge', 'spring', 'extrusion'] as LinkShape[]).map((s) => (
                                            <button
                                                key={s}
                                                onClick={() => updateLink(selectedLink.id, { shape: s })}
                                                title={s}
                                                className={`py-1 rounded-lg border text-[9px] flex flex-col items-center gap-0.5 transition ${
                                                    selectedLink.shape === s ? 'border-cyan-500 bg-cyan-950/60 text-white ring-1 ring-cyan-500/40' : 'border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                                }`}
                                            >
                                                {partIcon(s, 'w-3 h-3')}
                                                <span className="truncate max-w-[48px]">{s}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Kích thước hình khối linh hoạt theo từng shape */}
                                <div className="space-y-2">
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {(selectedLink.shape === 'box' || selectedLink.shape === 'wedge' || selectedLink.shape === 'extrusion') && (
                                            <>
                                                <NumField label="Rộng X" value={selectedLink.size[0]} min={0.005} onChange={(v) => updateLink(selectedLink.id, { size: [v, selectedLink.size[1], selectedLink.size[2]] }, 'size')} />
                                                <NumField label="Cao Y" value={selectedLink.size[1]} min={0.005} onChange={(v) => updateLink(selectedLink.id, { size: [selectedLink.size[0], v, selectedLink.size[2]] }, 'size')} />
                                                <NumField label="Dài Z" value={selectedLink.size[2]} min={0.005} onChange={(v) => updateLink(selectedLink.id, { size: [selectedLink.size[0], selectedLink.size[1], v] }, 'size')} />
                                            </>
                                        )}
                                        {selectedLink.shape !== 'box' && selectedLink.shape !== 'wedge' && selectedLink.shape !== 'extrusion' && (
                                            <NumField label="Bán kính" value={selectedLink.size[0]} min={0.005} onChange={(v) => updateLink(selectedLink.id, { size: [v, selectedLink.size[1], selectedLink.size[2]] }, 'size')} />
                                        )}
                                        {(selectedLink.shape === 'cylinder' || selectedLink.shape === 'capsule' || selectedLink.shape === 'cone' || selectedLink.shape === 'gear' || selectedLink.shape === 'spring') && (
                                            <NumField label={selectedLink.shape === 'gear' ? 'Độ dày' : 'Chiều dài'} value={selectedLink.size[1]} min={0.001} onChange={(v) => updateLink(selectedLink.id, { size: [selectedLink.size[0], v, selectedLink.size[2]] }, 'size')} />
                                        )}
                                        <NumField label="Khối lượng" value={selectedLink.mass} step={0.1} min={0.001} suffix="kg" onChange={(v) => updateLink(selectedLink.id, { mass: v }, 'mass')} />
                                    </div>

                                    {/* Bổ sung tham số riêng cho các shape phức tạp */}
                                    {selectedLink.shape === 'gear' && (
                                        <div className="grid grid-cols-2 gap-1.5 p-2 rounded-xl bg-purple-950/20 border border-purple-900/40">
                                            <NumField
                                                label="Số răng (Teeth)"
                                                value={selectedLink.shapeParams?.teeth ?? 12}
                                                step={1}
                                                min={6}
                                                max={32}
                                                onChange={(v) => updateLink(selectedLink.id, { shapeParams: { ...selectedLink.shapeParams, teeth: Math.round(v) } }, 'teeth')}
                                            />
                                            <NumField
                                                label="Lỗ trục giữa"
                                                value={selectedLink.shapeParams?.innerRadius ?? round(selectedLink.size[0] * 0.25, 3)}
                                                step={0.005}
                                                min={0.002}
                                                onChange={(v) => updateLink(selectedLink.id, { shapeParams: { ...selectedLink.shapeParams, innerRadius: v } }, 'innerR')}
                                            />
                                        </div>
                                    )}

                                    {selectedLink.shape === 'torus' && (
                                        <div className="p-2 rounded-xl bg-pink-950/20 border border-pink-900/40">
                                            <NumField
                                                label="Bán kính ống lốp (Tube)"
                                                value={selectedLink.shapeParams?.tubeRadius ?? round(selectedLink.size[0] * 0.25, 3)}
                                                step={0.005}
                                                min={0.002}
                                                onChange={(v) => updateLink(selectedLink.id, { shapeParams: { ...selectedLink.shapeParams, tubeRadius: v } }, 'tubeR')}
                                            />
                                        </div>
                                    )}

                                    {selectedLink.shape === 'spring' && (
                                        <div className="grid grid-cols-2 gap-1.5 p-2 rounded-xl bg-yellow-950/20 border border-yellow-900/40">
                                            <NumField
                                                label="Số vòng xoắn (Coils)"
                                                value={selectedLink.shapeParams?.coils ?? 5}
                                                step={1}
                                                min={2}
                                                max={12}
                                                onChange={(v) => updateLink(selectedLink.id, { shapeParams: { ...selectedLink.shapeParams, coils: Math.round(v) } }, 'coils')}
                                            />
                                            <NumField
                                                label="Cỡ dây thép (Wire)"
                                                value={selectedLink.shapeParams?.wireRadius ?? round(selectedLink.size[0] * 0.15, 3)}
                                                step={0.002}
                                                min={0.002}
                                                onChange={(v) => updateLink(selectedLink.id, { shapeParams: { ...selectedLink.shapeParams, wireRadius: v } }, 'wireR')}
                                            />
                                        </div>
                                    )}

                                    {selectedLink.shape === 'extrusion' && (
                                        <div className="p-2 rounded-xl bg-indigo-950/20 border border-indigo-900/40 space-y-1">
                                            <span className="text-[10px] text-zinc-400 uppercase tracking-wide">Kiểu Mặt Cắt Dầm (Profile)</span>
                                            <div className="grid grid-cols-4 gap-1">
                                                {(['i-beam', 'c-channel', 'hex', 'aerofoil'] as const).map((prf) => (
                                                    <button
                                                        key={prf}
                                                        onClick={() => updateLink(selectedLink.id, { shapeParams: { ...selectedLink.shapeParams, profile: prf } })}
                                                        className={`py-1 rounded text-[9px] font-mono uppercase border transition ${
                                                            (selectedLink.shapeParams?.profile ?? 'i-beam') === prf
                                                                ? 'border-indigo-400 bg-indigo-950 text-white'
                                                                : 'border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                                        }`}
                                                    >
                                                        {prf}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <Vec3Field label="Offset hình khối" value={selectedLink.visualOffset} onChange={(v) => updateLink(selectedLink.id, { visualOffset: v }, 'voff')} />
                                <Vec3Field label="Xoay hình khối" degrees value={selectedLink.visualRotation} onChange={(v) => updateLink(selectedLink.id, { visualRotation: v }, 'vrot')} />
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={selectedLink.color}
                                        onChange={(e) => updateLink(selectedLink.id, { color: e.target.value }, 'color')}
                                        className="w-8 h-7 rounded-md bg-transparent border border-zinc-800 cursor-pointer"
                                    />
                                    <span className="font-mono text-[11px] text-zinc-400">{selectedLink.color}</span>
                                </div>
                                <Toggle
                                    label="Cảm biến tiếp xúc (chân / bánh)"
                                    hint="Đưa trạng thái chạm đất vào observation khi train"
                                    checked={!!selectedLink.isContactSensor}
                                    onChange={(v) => updateLink(selectedLink.id, { isContactSensor: v })}
                                />
                            </Section>

                            {parentJoint ? (
                                <Section title="Joint (khớp cha)" icon={<Settings2 className="w-3.5 h-3.5 text-amber-400" />}>
                                    <label className="flex flex-col gap-0.5">
                                        <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Tên khớp</span>
                                        <input
                                            value={parentJoint.name}
                                            onChange={(e) => updateJoint(parentJoint.id, { name: e.target.value.replace(/\s+/g, '_') }, 'jname')}
                                            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs font-mono outline-none focus:border-cyan-500/60"
                                        />
                                    </label>
                                    <label className="flex flex-col gap-0.5">
                                        <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Link cha</span>
                                        <select
                                            value={parentJoint.parentLinkId}
                                            onChange={(e) => handleReparent(e.target.value)}
                                            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs font-mono outline-none"
                                        >
                                            {parentCandidates.map((l) => (
                                                <option key={l.id} value={l.id} className="bg-zinc-900">
                                                    {l.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <div className="grid grid-cols-4 gap-1">
                                        {(['revolute', 'continuous', 'prismatic', 'fixed'] as JointType[]).map((t) => (
                                            <button
                                                key={t}
                                                onClick={() => handleJointTypeChange(parentJoint, t)}
                                                className={`py-1 rounded-lg border text-[9px] font-semibold uppercase transition ${
                                                    parentJoint.type === t ? 'text-black' : 'border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                                }`}
                                                style={parentJoint.type === t ? { background: JOINT_COLORS[t], borderColor: JOINT_COLORS[t] } : undefined}
                                            >
                                                {t === 'continuous' ? 'cont.' : t}
                                            </button>
                                        ))}
                                    </div>

                                    {parentJoint.type !== 'fixed' && (
                                        <div className="space-y-1">
                                            <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Trục {parentJoint.type === 'prismatic' ? 'trượt' : 'quay'}</div>
                                            <div className="flex items-center gap-1">
                                                {(
                                                    [
                                                        ['X', [1, 0, 0], 'text-red-400'],
                                                        ['Y', [0, 1, 0], 'text-[#76b900]'],
                                                        ['Z', [0, 0, 1], 'text-blue-400'],
                                                    ] as [string, Vec3, string][]
                                                ).map(([n, ax, c]) => {
                                                    const active = parentJoint.axis.every((x, i) => Math.abs(x - ax[i]) < 1e-6)
                                                    return (
                                                        <button
                                                            key={n}
                                                            onClick={() => updateJoint(parentJoint.id, { axis: ax })}
                                                            className={`flex-1 py-1 rounded-lg border text-[11px] font-bold transition ${c} ${
                                                                active ? 'border-current bg-zinc-800' : 'border-zinc-800 hover:border-zinc-700'
                                                            }`}
                                                        >
                                                            {n}
                                                        </button>
                                                    )
                                                })}
                                                <button
                                                    onClick={() => updateJoint(parentJoint.id, { axis: parentJoint.axis.map((x) => -x) as Vec3 })}
                                                    title="Đảo chiều trục"
                                                    className="px-2 py-1 rounded-lg border border-zinc-800 text-[11px] text-zinc-300 hover:border-zinc-700"
                                                >
                                                    -/+
                                                </button>
                                            </div>
                                            <Vec3Field label="Vector trục" step={0.1} value={parentJoint.axis} onChange={(v) => updateJoint(parentJoint.id, { axis: v }, 'axis')} />
                                        </div>
                                    )}

                                    <Vec3Field label="Gốc khớp (trong link cha)" value={parentJoint.origin} onChange={(v) => updateJoint(parentJoint.id, { origin: v }, 'origin')} />
                                    <Vec3Field label="Xoay gốc khớp" degrees value={parentJoint.originRotation} onChange={(v) => updateJoint(parentJoint.id, { originRotation: v }, 'orot')} />

                                    {parentJoint.type !== 'fixed' && (
                                        <>
                                            {parentJoint.type !== 'continuous' && (
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    {parentJoint.type === 'prismatic' ? (
                                                        <>
                                                            <NumField label="Min" suffix="m" value={parentJoint.limit.lower} onChange={(v) => updateJoint(parentJoint.id, { limit: { ...parentJoint.limit, lower: v } }, 'lim')} />
                                                            <NumField label="Max" suffix="m" value={parentJoint.limit.upper} onChange={(v) => updateJoint(parentJoint.id, { limit: { ...parentJoint.limit, upper: v } }, 'lim')} />
                                                        </>
                                                    ) : (
                                                        <>
                                                            <NumField label="Min" suffix="°" step={1} value={round(parentJoint.limit.lower / DEG, 1)} onChange={(v) => updateJoint(parentJoint.id, { limit: { ...parentJoint.limit, lower: v * DEG } }, 'lim')} />
                                                            <NumField label="Max" suffix="°" step={1} value={round(parentJoint.limit.upper / DEG, 1)} onChange={(v) => updateJoint(parentJoint.id, { limit: { ...parentJoint.limit, upper: v * DEG } }, 'lim')} />
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 gap-1.5">
                                                <NumField label="Lực / Mô-men max" suffix={parentJoint.type === 'prismatic' ? 'N' : 'Nm'} step={1} value={parentJoint.limit.effort} onChange={(v) => updateJoint(parentJoint.id, { limit: { ...parentJoint.limit, effort: v } }, 'lim')} />
                                                <NumField label="Vận tốc max" suffix={parentJoint.type === 'prismatic' ? 'm/s' : 'rad/s'} step={0.1} value={parentJoint.limit.velocity} onChange={(v) => updateJoint(parentJoint.id, { limit: { ...parentJoint.limit, velocity: v } }, 'lim')} />
                                                <NumField label="Damping" step={0.01} value={parentJoint.damping} onChange={(v) => updateJoint(parentJoint.id, { damping: v }, 'damp')} />
                                                <NumField label="Friction" step={0.01} value={parentJoint.friction} onChange={(v) => updateJoint(parentJoint.id, { friction: v }, 'fric')} />
                                            </div>
                                            <Toggle
                                                label="Có động cơ (actuated)"
                                                hint="Khớp actuated sẽ nằm trong action space khi train RL"
                                                checked={parentJoint.actuated}
                                                onChange={(v) => updateJoint(parentJoint.id, { actuated: v })}
                                            />
                                            <div className="flex items-center justify-between gap-2 text-[11px]">
                                                <span className="text-zinc-500">
                                                    Tư thế mặc định:{' '}
                                                    <span className="font-mono text-zinc-300">
                                                        {parentJoint.type === 'prismatic' ? `${round(parentJoint.defaultPosition, 3)} m` : `${round(parentJoint.defaultPosition / DEG, 1)}°`}
                                                    </span>
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        const cur = jointPositions[parentJoint.id]
                                                        if (cur === undefined) return
                                                        updateJoint(parentJoint.id, { defaultPosition: cur })
                                                        notify.success(`Đã đặt tư thế mặc định cho '${parentJoint.name}'.`)
                                                    }}
                                                    className="px-2 py-0.5 rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                                                    title="Lấy giá trị slider hiện tại làm tư thế nghỉ"
                                                >
                                                    Lấy từ slider
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </Section>
                            ) : (
                                <Section title="Root link" icon={<Bot className="w-3.5 h-3.5 text-[#76b900]" />}>
                                    <p className="text-[11px] text-zinc-400">
                                        Đây là thân gốc (base). Robot sẽ được spawn tại độ cao bên dưới. Chọn một link con để chỉnh khớp.
                                    </p>
                                </Section>
                            )}
                        </>
                    ) : (
                        <Section title="Thông tin Agent Body" icon={<Bot className="w-3.5 h-3.5 text-[#76b900]" />}>
                            <label className="flex flex-col gap-0.5">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Tên</span>
                                <input
                                    value={design.name}
                                    onChange={(e) => updateDesign((d) => ({ ...d, name: e.target.value }), 'bname')}
                                    className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs outline-none focus:border-cyan-500/60"
                                />
                            </label>
                            <label className="flex flex-col gap-0.5">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Mô tả</span>
                                <textarea
                                    value={design.description || ''}
                                    rows={2}
                                    onChange={(e) => updateDesign((d) => ({ ...d, description: e.target.value }), 'bdesc')}
                                    className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs outline-none focus:border-cyan-500/60 resize-none"
                                />
                            </label>
                            <div className="grid grid-cols-2 gap-1.5">
                                <label className="flex flex-col gap-0.5">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Loại</span>
                                    <select
                                        value={design.category}
                                        onChange={(e) => updateDesign((d) => ({ ...d, category: e.target.value }))}
                                        className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs outline-none"
                                    >
                                        {CATEGORIES.map((c) => (
                                            <option key={c} value={c} className="bg-zinc-900">
                                                {c}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <NumField label="Độ cao spawn" suffix="m" value={design.spawnHeight} min={0} onChange={(v) => updateDesign((d) => ({ ...d, spawnHeight: v }), 'spawn')} />
                            </div>
                            {design.bodyId && (
                                <div className="text-[10px] font-mono text-zinc-500 break-all">
                                    bodyId: <span className="text-cyan-400">{design.bodyId}</span>
                                </div>
                            )}
                            <p className="text-[10px] text-zinc-500">Click một bộ phận trong khung 3D hoặc cây động học để chỉnh sửa link và khớp.</p>
                        </Section>
                    )}

                    {/* RL training summary */}
                    <Section title="Training Spec (RL)" icon={<Cpu className="w-3.5 h-3.5 text-violet-400" />}>
                        <div className="grid grid-cols-3 gap-1.5 text-center">
                            {[
                                ['Action', stats.actionDim],
                                ['Obs', stats.observationDim],
                                ['DOF', stats.dof],
                                ['Links', stats.linkCount],
                                ['Joints', stats.jointCount],
                                ['Mass kg', stats.totalMass],
                            ].map(([k, v]) => (
                                <div key={k as string} className="rounded-lg bg-zinc-950 border border-zinc-800 py-1.5">
                                    <div className="text-sm font-bold font-mono text-white">{v}</div>
                                    <div className="text-[9px] uppercase text-zinc-500">{k}</div>
                                </div>
                            ))}
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-relaxed">
                            Observation = vị trí + vận tốc mỗi khớp actuated, trạng thái base (13), cảm biến tiếp xúc. Action = mô-men / vị trí mục tiêu cho từng khớp actuated.
                        </p>
                        {errors.length === 0 ? (
                            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                                <CircleCheck className="w-3.5 h-3.5" />
                                Cấu trúc hợp lệ, sẵn sàng xuất URDF / train.
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {errors.slice(0, 5).map((err, i) => (
                                    <div key={i} className="flex items-start gap-1.5 text-[11px] text-amber-400">
                                        <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                        <span>{err}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {design.bodyId && (
                            <div className="text-[10px] font-mono text-zinc-500 bg-zinc-950 border border-zinc-800 rounded-lg p-2 break-all">
                                GET /api/v1/agent-bodies/{design.bodyId}/urdf
                                <br />
                                GET /api/v1/agent-bodies/{design.bodyId}/training-spec
                            </div>
                        )}
                    </Section>

                    <Section title="Gợi ý" icon={<Activity className="w-3.5 h-3.5 text-cyan-400" />}>
                        <ul className="text-[10px] text-zinc-500 space-y-1 list-disc pl-4">
                            <li>Hướng tiến của robot là trục +X (vạch đỏ trên sàn).</li>
                            <li>Chân nên dùng trục Z để vung trước/sau khi đi về +X.</li>
                            <li>Bật cảm biến tiếp xúc cho bàn chân / bánh xe để tính reward.</li>
                            <li>Dùng Motion để kiểm tra giới hạn khớp có va chạm thân hay không.</li>
                        </ul>
                    </Section>
                </aside>
            </div>

            {/* ===== MODALS ===== */}
            {cloudOpen && (
                <Modal title="Agent Body Cloud (mapdraw-service)" onClose={() => setCloudOpen(false)} wide>
                    {cloudLoading ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-zinc-400 text-sm">
                            <LoaderCircle className="w-4 h-4 animate-spin" />
                            Đang tải...
                        </div>
                    ) : cloudBodies.length === 0 ? (
                        <div className="text-center py-10 text-sm text-zinc-500">Chưa có agent body nào trên Cloud.</div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {cloudBodies.map((b) => (
                                <div key={b.bodyId} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="text-sm font-bold text-white truncate">{b.name}</div>
                                            <div className="text-[10px] text-zinc-500 truncate">
                                                {b.category} / {b.userName} / {new Date(b.updatedAt).toLocaleString()}
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 shrink-0">
                                            {b.joints.filter((j) => j.type !== 'fixed' && j.actuated).length} act
                                        </span>
                                    </div>
                                    {b.description && <p className="text-[11px] text-zinc-400 line-clamp-2">{b.description}</p>}
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => handleLoadCloud(b)}
                                            className="flex-1 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-medium flex items-center justify-center gap-1"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            Nạp
                                        </button>
                                        <button
                                            onClick={() => handleDeleteCloud(b)}
                                            className="px-2 py-1.5 rounded-lg border border-rose-900 text-rose-400 hover:bg-rose-950/50 text-xs"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Modal>
            )}

            {saveOpen && (
                <Modal title="Lưu Agent Body lên Cloud" onClose={() => setSaveOpen(false)}>
                    <div className="space-y-3">
                        <label className="flex flex-col gap-1">
                            <span className="text-[11px] text-zinc-400">Tên agent body</span>
                            <input
                                value={design.name}
                                onChange={(e) => setDesign((d) => ({ ...d, name: e.target.value }))}
                                className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-500/60"
                            />
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-[11px] text-zinc-400">Mô tả</span>
                            <textarea
                                value={design.description || ''}
                                rows={3}
                                onChange={(e) => setDesign((d) => ({ ...d, description: e.target.value }))}
                                className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-500/60 resize-none"
                            />
                        </label>
                        <div className="text-[11px] text-zinc-500 font-mono">
                            {stats.linkCount} links / {stats.jointCount} joints / action dim {stats.actionDim}
                            {design.bodyId ? ` / cập nhật ${design.bodyId}` : ' / tạo mới'}
                        </div>
                        {errors.length > 0 && (
                            <div className="flex items-start gap-1.5 text-[11px] text-amber-400">
                                <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                {errors[0]}
                            </div>
                        )}
                        <div className="flex justify-end gap-2">
                            {design.bodyId && (
                                <button
                                    onClick={() => setDesign((d) => ({ ...d, bodyId: undefined }))}
                                    className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 text-xs hover:bg-zinc-800 flex items-center gap-1"
                                    title="Lưu thành bản mới thay vì ghi đè"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Lưu thành bản mới
                                </button>
                            )}
                            <button
                                onClick={handleSaveCloud}
                                disabled={saving}
                                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {saving ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
                                Lưu
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {jsonOpen && (
                <Modal title="JSON Agent Body (Import / Export)" onClose={() => setJsonOpen(false)} wide>
                    <textarea
                        value={jsonText}
                        onChange={(e) => setJsonText(e.target.value)}
                        spellCheck={false}
                        className="w-full h-[50vh] bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-[11px] font-mono text-zinc-200 outline-none focus:border-cyan-500/60"
                    />
                    <div className="flex justify-end gap-2 mt-3">
                        <button
                            onClick={() => downloadText(`${fileBase}.json`, jsonText, 'application/json')}
                            className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 text-xs hover:bg-zinc-800 flex items-center gap-1"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Tải file
                        </button>
                        <button onClick={handleApplyJson} className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1">
                            <Upload className="w-3.5 h-3.5" />
                            Áp dụng JSON
                        </button>
                    </div>
                </Modal>
            )}

            {urdfOpen && (
                <Modal title="URDF Export (PyBullet / MuJoCo / Isaac Sim / Gazebo)" onClose={() => setUrdfOpen(false)} wide>
                    {errors.length > 0 && (
                        <div className="mb-2 flex items-start gap-1.5 text-[11px] text-amber-400">
                            <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            Cảnh báo: {errors[0]}
                        </div>
                    )}
                    <pre className="w-full h-[50vh] overflow-auto bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-[11px] font-mono text-zinc-300 whitespace-pre">{urdfText}</pre>
                    <div className="flex justify-end gap-2 mt-3">
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(urdfText)
                                notify.success('Đã copy URDF.')
                            }}
                            className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 text-xs hover:bg-zinc-800 flex items-center gap-1"
                        >
                            <Copy className="w-3.5 h-3.5" />
                            Copy
                        </button>
                        <button
                            onClick={() => downloadText(`${fileBase}.urdf`, urdfText, 'application/xml')}
                            className="px-4 py-1.5 rounded-lg bg-[#76b900] hover:bg-[#8bd400] text-black text-xs font-semibold flex items-center gap-1"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Tải .urdf
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    )
}

