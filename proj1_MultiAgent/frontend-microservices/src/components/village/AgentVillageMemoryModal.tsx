'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
    Brain,
    Sparkles,
    Clock,
    BookOpen,
    Wrench,
    Trash2,
    Plus,
    RotateCcw,
    Check,
    CheckCircle2,
    Zap,
    Award,
    TrendingUp,
    Bot,
    Users,
    X,
    Filter,
    HardDrive,
    MessageSquare,
    ChevronRight,
    ArrowUpRight,
    Layers,
    Cpu,
} from 'lucide-react'
import {
    memoryApi,
    MemoryResponse,
    ShortMemoryResponse,
    AgentEvolution,
    MemoryType,
} from '@/lib/api/memory'
import { Agent as AgentType } from '@/lib/api'

interface AgentVillageMemoryModalProps {
    agent: AgentType | null
    isOpen: boolean
    onClose: () => void
    onEvolutionUpdated?: (evo: AgentEvolution) => void
    roomId?: string
}

export default function AgentVillageMemoryModal({
    agent,
    isOpen,
    onClose,
    onEvolutionUpdated,
    roomId,
}: AgentVillageMemoryModalProps) {
    const [activeTab, setActiveTab] = useState<'long' | 'short' | 'skills'>('long')
    const [longMemories, setLongMemories] = useState<MemoryResponse[]>([])
    const [shortMemory, setShortMemory] = useState<ShortMemoryResponse | null>(null)
    const [evolution, setEvolution] = useState<AgentEvolution | null>(null)
    const [loading, setLoading] = useState<boolean>(true)
    const [filterType, setFilterType] = useState<string>('all')

    // Form thêm ký ức mới
    const [isAddingMemory, setIsAddingMemory] = useState<boolean>(false)
    const [newMemoryContent, setNewMemoryContent] = useState<string>('')
    const [newMemoryType, setNewMemoryType] = useState<MemoryType>('skill')
    const [isSavingMemory, setIsSavingMemory] = useState<boolean>(false)

    // Trạng thái phản tư & tự luyện tập
    const [isReflecting, setIsReflecting] = useState<boolean>(false)
    const [isAutoPracticing, setIsAutoPracticing] = useState<boolean>(false)
    const [reflectSuccessMessage, setReflectSuccessMessage] = useState<string | null>(null)

    const agentId = agent?.id || ''

    // ─── TẢI DỮ LIỆU KÝ ỨC VÀ TIẾN HÓA CỦA AGENT ────────────────────────
    const loadMemoryData = useCallback(async () => {
        if (!agentId) return
        setLoading(true)
        try {
            const [longRes, shortRes] = await Promise.allSettled([
                memoryApi.getLongMemories(agentId, roomId),
                memoryApi.getShortMemory(agentId, roomId),
            ])

            if (longRes.status === 'fulfilled') {
                setLongMemories(longRes.value)
            }
            if (shortRes.status === 'fulfilled') {
                setShortMemory(shortRes.value)
            }

            const evo = memoryApi.getAgentEvolution(agentId)
            setEvolution(evo)
            if (onEvolutionUpdated) onEvolutionUpdated(evo)
        } catch (err) {
            console.error('[VILLAGE_MEMORY] Lỗi khi tải dữ liệu ký ức:', err)
        } finally {
            setLoading(false)
        }
    }, [agentId, roomId, onEvolutionUpdated])

    useEffect(() => {
        if (isOpen && agentId) {
            loadMemoryData()
            setReflectSuccessMessage(null)
            setIsAddingMemory(false)
        }
    }, [isOpen, agentId, loadMemoryData])

    // ─── XỬ LÝ LƯU KÝ ỨC MỚI (DẠY KỸ NĂNG CHO AGENT) ───────────────────
    const handleAddMemory = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newMemoryContent.trim() || !agentId) return
        setIsSavingMemory(true)
        try {
            const created = await memoryApi.addLongMemory(agentId, {
                content: newMemoryContent.trim(),
                memory_type: newMemoryType,
                room_id: roomId,
            })
            setLongMemories((prev) => [created, ...prev])
            setNewMemoryContent('')
            setIsAddingMemory(false)

            // Thưởng EXP cho Agent khi học bài học mới
            const updatedEvo = memoryApi.addExp(agentId, 30)
            setEvolution(updatedEvo)
            if (onEvolutionUpdated) onEvolutionUpdated(updatedEvo)
        } catch (err) {
            console.error('[VILLAGE_MEMORY] Lỗi lưu ký ức:', err)
        } finally {
            setIsSavingMemory(false)
        }
    }

    // ─── XỬ LÝ XÓA KÝ ỨC DÀI HẠN ───────────────────────────────────────
    const handleDeleteMemory = async (id: number) => {
        if (!agentId) return
        try {
            await memoryApi.deleteLongMemory(agentId, id)
            setLongMemories((prev) => prev.filter((m) => m.id !== id))
        } catch (err) {
            console.error('[VILLAGE_MEMORY] Lỗi xóa ký ức:', err)
        }
    }

    // ─── XỬ LÝ KÍCH HOẠT TỰ PHẢN TƯ (CONSOLIDATE MEMORY) ────────────────
    const handleConsolidate = async () => {
        if (!agentId || !agent?.name) return
        setIsReflecting(true)
        setReflectSuccessMessage(null)
        try {
            const res = await memoryApi.consolidateMemories(agentId, agent.name, roomId)
            setLongMemories((prev) => [res.reflection, res.skill, ...prev])

            const updatedEvo = memoryApi.getAgentEvolution(agentId)
            setEvolution(updatedEvo)
            if (onEvolutionUpdated) onEvolutionUpdated(updatedEvo)

            setReflectSuccessMessage(`Đã phản tư thành công! +60 EXP. Cấp độ hiện tại: Level ${res.newLevel}.`)
            setTimeout(() => setReflectSuccessMessage(null), 6000)
        } catch (err) {
            console.error('[VILLAGE_MEMORY] Lỗi phản tư:', err)
        } finally {
            setIsReflecting(false)
        }
    }

    // ─── TỰ ĐỘNG GỌI TOOL ĐỂ TỰ HỌC & TRƯỞNG THÀNH ──────────────────────
    const handleAutonomousPractice = async (toolId?: string) => {
        if (!agentId || !agent?.name) return
        setIsAutoPracticing(true)
        setReflectSuccessMessage(null)
        try {
            const res = await memoryApi.autonomousPracticeTool(agentId, agent.name, toolId, roomId)
            setLongMemories((prev) => [res.learnedSkillMemory, ...prev])
            setEvolution(res.evolution)
            if (onEvolutionUpdated) onEvolutionUpdated(res.evolution)

            setReflectSuccessMessage(
                `[TỰ HỌC THÀNH CÔNG] Đã tự gọi [${res.toolName}]: +${res.proficiencyGain}% thành thạo, +${res.expGained} EXP và đúc kết kỹ năng mới vào Bộ nhớ Dài hạn!`
            )
            setTimeout(() => setReflectSuccessMessage(null), 7000)
        } catch (err) {
            console.error('[VILLAGE_MEMORY] Lỗi tự luyện tập tool:', err)
        } finally {
            setIsAutoPracticing(false)
        }
    }

    // ─── XỬ LÝ XÓA CACHE BỘ NHỚ NGẮN HẠN ────────────────────────────────
    const handleClearShortMemory = async () => {
        if (!agentId) return
        try {
            await memoryApi.clearShortMemory(agentId, roomId)
            setShortMemory({ agent_id: agentId, messages: [], total_turns: 0 })
        } catch (err) {
            console.error('[VILLAGE_MEMORY] Lỗi xóa short memory:', err)
        }
    }

    // ─── LUYỆN TẬP CÔNG CỤ TẠI HỌC VIỆN DOJO ────────────────────────────
    const handlePracticeTool = (toolId: string, toolName: string) => {
        if (!agentId) return
        const updatedEvo = memoryApi.recordToolSkillProgress(agentId, toolId, toolName)
        setEvolution(updatedEvo)
        if (onEvolutionUpdated) onEvolutionUpdated(updatedEvo)
    }

    // ─── LỌC DANH SÁCH KÝ ỨC DÀI HẠN ───────────────────────────────────
    const filteredMemories = useMemo(() => {
        if (filterType === 'all') return longMemories
        return longMemories.filter((m) => m.memory_type === filterType)
    }, [longMemories, filterType])

    if (!isOpen || !agent) return null

    const expPercent = evolution ? Math.min(100, Math.round((evolution.exp / evolution.nextLevelExp) * 100)) : 0

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
            <div
                className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-border bg-card text-foreground shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ─── 1. HEADER MODAL: DANH TÍNH & CẤP ĐỘ TRƯỞNG THÀNH ─── */}
                <div className="border-b border-border/80 p-5 bg-gradient-to-r from-secondary/50 via-card to-secondary/30">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3.5 min-w-0">
                            <span
                                className="w-4 h-4 rounded-full shrink-0 shadow-md ring-2 ring-border"
                                style={{ backgroundColor: agent.color || '#3b82f6' }}
                            />
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="text-lg font-bold text-foreground tracking-tight">
                                        {agent.name}
                                    </h2>
                                    <span className="text-xs font-mono text-muted-foreground px-2 py-0.5 rounded-md bg-secondary border border-border">
                                        ID: {agent.id}
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-purple-400 px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 font-semibold">
                                        <Cpu className="w-3 h-3" />
                                        {agent.model || 'gemini-2.5-flash'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                    <span>Hình thái: {agent.form ? agent.form.toUpperCase() : 'HUMANOID'}</span>
                                    <span>•</span>
                                    <span className="text-emerald-400 font-semibold">Cư dân Làng AI</span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-xl border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                            title="Đóng modal"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* THANH TRƯỞNG THÀNH (LEVEL & EXP BAR) */}
                    {evolution && (
                        <div className="mt-4 p-3.5 rounded-2xl border border-border bg-card/70 space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold font-mono text-xs">
                                        <Award className="w-3.5 h-3.5" />
                                        CẤP {evolution.level}: {evolution.title}
                                    </span>
                                    <span className="text-muted-foreground text-[11px]">
                                        Đã hoàn thành {evolution.totalTasksCompleted} bài toán
                                    </span>
                                </div>
                                <div className="font-mono text-xs text-muted-foreground flex items-center gap-2">
                                    <span className="text-foreground font-semibold">{evolution.exp}</span> / {evolution.nextLevelExp} EXP
                                    <span className="text-[11px] text-primary font-bold">({expPercent}%)</span>
                                </div>
                            </div>

                            {/* EXP PROGRESS BAR */}
                            <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-amber-500 via-primary to-emerald-400 rounded-full transition-all duration-500"
                                    style={{ width: `${expPercent}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* ─── 2. THANH TAB ĐIỀU HƯỚNG BỘ NHỚ ──────────────────── */}
                <div className="flex items-center gap-2 border-b border-border px-5 pt-3 bg-muted/20">
                    <button
                        onClick={() => setActiveTab('long')}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition ${activeTab === 'long'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <Brain className="w-3.5 h-3.5" />
                        <span>Ký Ức Dài Hạn (PostgreSQL) ({longMemories.length})</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('short')}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition ${activeTab === 'short'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Bộ Nhớ Ngắn Hạn (Redis) ({shortMemory?.total_turns || 0})</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('skills')}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition ${activeTab === 'skills'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Thành Thạo Công Cụ & Tự Học</span>
                    </button>
                </div>

                {/* ─── 3. THÔNG BÁO PHẢN TƯ THÀNH CÔNG NẾU CÓ ──────────── */}
                {reflectSuccessMessage && (
                    <div className="mx-5 mt-3 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs flex items-center justify-between animate-in slide-in-from-top-2">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>{reflectSuccessMessage}</span>
                        </div>
                        <button onClick={() => setReflectSuccessMessage(null)}>
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {/* ─── 4. NỘI DUNG TỪNG TAB ────────────────────────────── */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* TAB 1: KÝ ỨC DÀI HẠN (LONG-TERM MEMORY) */}
                    {activeTab === 'long' && (
                        <div className="space-y-4">
                            {/* THANH THAO TÁC: LỌC & THÊM KÝ ỨC */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1">
                                        <Filter className="w-3 h-3" />
                                        Lọc:
                                    </span>
                                    {(['all', 'skill', 'fact', 'reflection', 'relationship'] as const).map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => setFilterType(type)}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition ${filterType === type
                                                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                                                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                                                }`}
                                        >
                                            {type === 'all' ? 'TẤT CẢ' : `[${type.toUpperCase()}]`}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleConsolidate}
                                        disabled={isReflecting}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-medium transition disabled:opacity-50"
                                        title="Chuyển đổi trải nghiệm ngắn hạn thành phản tư tri thức dài hạn"
                                    >
                                        <Sparkles className={`w-3.5 h-3.5 ${isReflecting ? 'animate-spin' : ''}`} />
                                        <span>Tự Phản Tư (+60 EXP)</span>
                                    </button>

                                    <button
                                        onClick={() => setIsAddingMemory((prev) => !prev)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition shadow-xs"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Dạy Kỹ Năng / Thêm Ký Ức</span>
                                    </button>
                                </div>
                            </div>

                            {/* FORM THÊM KÝ ỨC MỚI */}
                            {isAddingMemory && (
                                <form
                                    onSubmit={handleAddMemory}
                                    className="p-4 rounded-2xl border border-primary/30 bg-secondary/40 space-y-3 animate-in fade-in"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                            <BookOpen className="w-3.5 h-3.5 text-primary" />
                                            Ghi nhận Ký ức / Dạy Kỹ năng Mới cho {agent.name}
                                        </span>
                                        <select
                                            value={newMemoryType}
                                            onChange={(e) => setNewMemoryType(e.target.value as MemoryType)}
                                            className="px-2.5 py-1 rounded-lg border border-border bg-card text-xs text-foreground focus:outline-hidden"
                                        >
                                            <option value="skill">[SKILL] Kỹ năng công cụ</option>
                                            <option value="fact">[FACT] Tri thức sự thật</option>
                                            <option value="reflection">[REFLECTION] Bài học phản tư</option>
                                            <option value="relationship">[RELATIONSHIP] Quan hệ bạn bè</option>
                                        </select>
                                    </div>

                                    <textarea
                                        rows={3}
                                        value={newMemoryContent}
                                        onChange={(e) => setNewMemoryContent(e.target.value)}
                                        placeholder="Ví dụ: Khi thực hiện truy vấn dữ liệu lớn, cần nhóm dữ liệu theo ngày và chỉ xuất 50 dòng kết quả hàng đầu..."
                                        className="w-full p-2.5 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                                        required
                                    />

                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsAddingMemory(false)}
                                            className="px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-secondary text-xs text-muted-foreground"
                                        >
                                            Hủy
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSavingMemory}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
                                        >
                                            <Check className="w-3.5 h-3.5" />
                                            <span>Lưu Ký Ức (+30 EXP)</span>
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* DANH SÁCH KÝ ỨC DÀI HẠN */}
                            {filteredMemories.length === 0 ? (
                                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-2xl">
                                    Chưa có mục ký ức dài hạn nào trong bộ lọc này. Hãy bấm &quot;Dạy Kỹ Năng / Thêm Ký Ức&quot; hoặc &quot;Tự Phản Tư&quot;.
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {filteredMemories.map((mem) => {
                                        const type = (mem.memory_type || 'fact').toLowerCase()
                                        const badgeStyle =
                                            type === 'skill'
                                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                                : type === 'reflection'
                                                    ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                                                    : type === 'relationship'
                                                        ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                                                        : 'bg-blue-500/15 text-blue-400 border-blue-500/30'

                                        return (
                                            <div
                                                key={mem.id}
                                                className="group flex items-start justify-between gap-3 p-3.5 rounded-2xl border border-border/80 bg-card hover:border-primary/40 transition shadow-xs"
                                            >
                                                <div className="space-y-1.5 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase border ${badgeStyle}`}>
                                                            [{type}]
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground font-mono">
                                                            {new Date(mem.created_at).toLocaleString('vi-VN')}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-foreground leading-relaxed">
                                                        {mem.content}
                                                    </p>
                                                </div>

                                                <button
                                                    onClick={() => handleDeleteMemory(mem.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition shrink-0"
                                                    title="Xóa ký ức này"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 2: BỘ NHỚ NGẮN HẠN (SHORT-TERM MEMORY - REDIS) */}
                    {activeTab === 'short' && (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-2xl border border-border bg-secondary/30 text-xs">
                                <div>
                                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-primary" />
                                        Bộ Đệm Hội Thoại & Ngữ Cảnh Tức Thời (Redis Sliding Window)
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                        Giữ lại các lượt đối thoại gần nhất (tối đa 10 turns) trong làng trước khi được tự động tóm tắt sang bộ nhớ dài hạn.
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={handleClearShortMemory}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-card hover:bg-secondary text-[11px] text-muted-foreground hover:text-rose-400 transition"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        <span>Làm sạch Buffer</span>
                                    </button>
                                </div>
                            </div>

                            {shortMemory?.messages && shortMemory.messages.length > 0 ? (
                                <div className="space-y-2 font-mono text-xs">
                                    {shortMemory.messages.map((msg, idx) => (
                                        <div
                                            key={idx}
                                            className={`p-3 rounded-xl border ${msg.role === 'assistant'
                                                    ? 'border-primary/30 bg-primary/5 text-foreground'
                                                    : 'border-border bg-card text-muted-foreground'
                                                }`}
                                        >
                                            <div className="text-[10px] font-bold uppercase text-primary mb-1">
                                                [{msg.role}]
                                            </div>
                                            <div className="text-xs font-sans whitespace-pre-wrap">{msg.content}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-2xl space-y-1">
                                    <p>Bộ nhớ ngắn hạn hiện đang trống.</p>
                                    <p className="text-[11px]">Khi bạn hoặc các Agent khác tương tác đàm thoại trong làng, các đoạn hội thoại sẽ lập tức xuất hiện tại đây.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 3: THÀNH THẠO CÔNG CỤ & TIẾN TRÌNH TRƯỞNG THÀNH (SKILLS) */}
                    {activeTab === 'skills' && evolution && (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-border bg-secondary/30 text-xs">
                                <div>
                                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                                        Học Viện Kỹ Năng & Thước Đo Thành Thạo Công Cụ
                                    </div>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                                        Agent có thể tự kích hoạt bài toán thực nghiệm, tự gọi công cụ để nâng cao độ thành thạo và tích lũy bài học kỹ năng vào Bộ nhớ Dài hạn.
                                    </p>
                                </div>

                                <button
                                    onClick={() => handleAutonomousPractice()}
                                    disabled={isAutoPracticing}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 via-primary/20 to-emerald-500/20 border border-primary/40 hover:border-primary text-foreground text-xs font-bold shadow-xs transition shrink-0 disabled:opacity-50"
                                >
                                    <Zap className={`w-3.5 h-3.5 text-amber-400 ${isAutoPracticing ? 'animate-spin' : ''}`} />
                                    <span>Tự Động Gọi Tool Luyện Tập (+35 EXP)</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                {Object.values(evolution.toolMastery).map((item) => (
                                    <div
                                        key={item.toolId}
                                        className="p-4 rounded-2xl border border-border bg-card space-y-3 shadow-xs hover:border-primary/40 transition"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="font-semibold text-foreground text-xs">{item.name}</div>
                                                <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                                                    Đã thực thi {item.usageCount} lần
                                                </div>
                                            </div>
                                            <span className="text-xs font-mono font-bold text-emerald-400">
                                                {item.proficiency}%
                                            </span>
                                        </div>

                                        {/* Thanh % thành thạo */}
                                        <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                                                style={{ width: `${item.proficiency}%` }}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between pt-1">
                                            <span className="text-[10px] text-muted-foreground font-mono">
                                                {item.lastLearnedAt
                                                    ? `Học lần cuối: ${new Date(item.lastLearnedAt).toLocaleTimeString('vi-VN')}`
                                                    : 'Đang rèn luyện'}
                                            </span>
                                            <button
                                                onClick={() => handleAutonomousPractice(item.toolId)}
                                                disabled={isAutoPracticing}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-secondary hover:bg-primary hover:text-primary-foreground text-[10px] font-medium transition disabled:opacity-50"
                                            >
                                                <Zap className="w-3 h-3 text-amber-400" />
                                                <span>Tự luyện Tool này (+35 EXP)</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ─── 5. FOOTER THAO TÁC NHANH ───────────────────────── */}
                <div className="border-t border-border p-4 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="text-[11px] text-muted-foreground font-mono">
                        Trạng thái: <span className="text-emerald-400 font-semibold">Tự học & Sinh tồn Tự do trong Làng AI</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={loadMemoryData}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-secondary text-xs text-foreground transition"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Làm mới</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 transition"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

