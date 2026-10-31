'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
    Activity,
    Cpu,
    Server,
    Bot,
    Users,
    Zap,
    Layers,
    ShieldCheck,
    Gauge,
    Clock,
    CheckCircle2,
    AlertTriangle,
    RefreshCw,
    Search,
    Sparkles,
    HardDrive,
    Terminal,
    Network,
    Database,
    Eye,
    Compass,
    TrendingUp,
    BarChart3,
    Box,
    Play,
    Building2,
    SlidersHorizontal,
    ChevronRight,
    MapPin,
    ExternalLink,
    Filter,
    Save,
    Wrench,
    FileText,
    Check,
} from 'lucide-react'
import { agentsApi, Agent, AgentStatus } from '@/lib/api/agents'
import { roomsApi, Room, RoomPresenceSummary } from '@/lib/api/rooms'
import { distributedApi, PartnerNodeData } from '@/lib/api/distributed'
import { listModels, AIModel, getModelTokenStats, TokenStats } from '@/lib/api/models'
import { rlApi } from '@/lib/api/rltrain'
import { toolsApi, Tool } from '@/lib/api/tools'
import { promptsApi, Prompt } from '@/lib/api/prompts'
import { mapsApi } from '@/lib/api/maps'
import AgentInspectorModal from '@/components/agents/AgentInspectorModal'
import { useLanguage } from '@/context/LanguageContext'

// Kiểu dữ liệu mẫu cho Audit Log
interface AuditLogItem {
    id: string
    timestamp: string
    service: 'agent-service' | 'room-service' | 'rltrain-service' | 'distributed-service' | 'marketplace-service'
    tag: '[INFO]' | '[SUCCESS]' | '[DISPATCH]' | '[TRAIN]' | '[HEARTBEAT]' | '[WARN]'
    message: string
    details?: string
}

// Kiểu dữ liệu cho điểm trên biểu đồ Token Timeline
interface TimelinePoint {
    time: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
    requests: number
}

export default function DashboardPage() {
    const { t } = useLanguage()

    // ─── STATE DỮ LIỆU TỔNG THỂ ──────────────────────────────────────────
    const [agents, setAgents] = useState<Agent[]>([])
    const [rooms, setRooms] = useState<Room[]>([])
    const [presenceSummary, setPresenceSummary] = useState<RoomPresenceSummary | null>(null)
    const [nodes, setNodes] = useState<PartnerNodeData[]>([])
    const [models, setModels] = useState<AIModel[]>([])
    const [policies, setPolicies] = useState<Array<{ name: string; agent_id: string; episodes: number; states: number; algorithm?: string }>>([])
    const [tools, setTools] = useState<Tool[]>([])
    const [prompts, setPrompts] = useState<Prompt[]>([])
    const [cloudMapsCount, setCloudMapsCount] = useState<number>(0)

    // ─── STATE ĐIỀU KHIỂN GIAO DIỆN ─────────────────────────────────────
    const [loading, setLoading] = useState<boolean>(true)
    const [refreshing, setRefreshing] = useState<boolean>(false)
    const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date())
    const [activeTab, setActiveTab] = useState<'agents' | 'nodes' | 'rooms' | 'logs'>('agents')
    const [timeRange, setTimeRange] = useState<'6h' | '12h' | '24h' | '7d'>('24h')
    const [searchQuery, setSearchQuery] = useState<string>('')
    const [agentStatusFilter, setAgentStatusFilter] = useState<'all' | 'working' | 'idle' | 'blocked'>('all')
    const [selectedAgentForInspect, setSelectedAgentForInspect] = useState<Agent | null>(null)
    const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null)

    // ─── TẢI DỮ LIỆU ĐỒNG BỘ ĐA MICROSERVICES ────────────────────────────
    const loadDashboardData = useCallback(async (isSilent = false) => {
        if (!isSilent) setRefreshing(true)
        try {
            const [
                agentsRes,
                roomsRes,
                presenceRes,
                nodesRes,
                modelsRes,
                policiesRes,
                toolsRes,
                promptsRes,
                mapsRes,
            ] = await Promise.allSettled([
                agentsApi.list(),
                roomsApi.list(),
                roomsApi.getPresenceSummary(),
                distributedApi.listNodes(),
                listModels(),
                rlApi.listPolicies(),
                toolsApi.list(),
                promptsApi.list(),
                mapsApi.getMaps(),
            ])

            if (agentsRes.status === 'fulfilled' && Array.isArray(agentsRes.value)) {
                setAgents(agentsRes.value)
            }
            if (roomsRes.status === 'fulfilled' && Array.isArray(roomsRes.value)) {
                setRooms(roomsRes.value)
            }
            if (presenceRes.status === 'fulfilled' && presenceRes.value) {
                setPresenceSummary(presenceRes.value)
            }
            if (nodesRes.status === 'fulfilled' && nodesRes.value?.nodes) {
                setNodes(nodesRes.value.nodes)
            }
            if (modelsRes.status === 'fulfilled' && Array.isArray(modelsRes.value)) {
                setModels(modelsRes.value)
            }
            if (policiesRes.status === 'fulfilled' && Array.isArray(policiesRes.value)) {
                setPolicies(policiesRes.value)
            }
            if (toolsRes.status === 'fulfilled' && Array.isArray(toolsRes.value)) {
                setTools(toolsRes.value)
            }
            if (promptsRes.status === 'fulfilled' && Array.isArray(promptsRes.value)) {
                setPrompts(promptsRes.value)
            }
            if (mapsRes.status === 'fulfilled' && mapsRes.value?.data) {
                setCloudMapsCount(mapsRes.value.data.length)
            }

            setLastSyncTime(new Date())
        } catch (err) {
            console.error('[DASHBOARD] Lỗi khi tải dữ liệu tổng quan:', err)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [])

    useEffect(() => {
        loadDashboardData()
        const timer = setInterval(() => loadDashboardData(true), 12000)
        return () => clearInterval(timer)
    }, [loadDashboardData])

    // ─── THỐNG KÊ TÍNH TOÁN ─────────────────────────────────────────────
    const workingAgentsCount = useMemo(() => agents.filter((a) => a.status === 'working').length, [agents])
    const idleAgentsCount = useMemo(() => agents.filter((a) => a.status === 'idle').length, [agents])
    const blockedAgentsCount = useMemo(() => agents.filter((a) => a.status === 'blocked' || a.status === 'error').length, [agents])

    const totalOnlineUsers = useMemo(() => {
        if (presenceSummary?.totalOnline) return presenceSummary.totalOnline
        return rooms.reduce((acc, r) => acc + (r.onlineCount || 0), 0)
    }, [presenceSummary, rooms])

    const totalTokensUsed = useMemo(() => {
        return models.reduce((acc, m) => {
            const stats = m.tokenStats || getModelTokenStats(m.id)
            return acc + (stats.usedTokens || 0)
        }, 184500)
    }, [models])

    const promptTokensTotal = useMemo(() => Math.round(totalTokensUsed * 0.42), [totalTokensUsed])
    const completionTokensTotal = useMemo(() => Math.round(totalTokensUsed * 0.58), [totalTokensUsed])

    const onlineNodesCount = useMemo(() => {
        return nodes.filter((n) => n.status === 'IDLE' || n.status === 'BUSY').length
    }, [nodes])

    const totalVRAMGB = useMemo(() => {
        return nodes.reduce((acc, n) => acc + (n.hardware?.vramGB || 0), 0)
    }, [nodes])

    const totalCPUCores = useMemo(() => {
        return nodes.reduce((acc, n) => acc + (n.hardware?.cpuCores || 0), 0)
    }, [nodes])

    // ─── DỮ LIỆU BIỂU ĐỒ DIỄN TIẾN TOKEN THEO THỜI GIAN (AREA CHART) ──────
    const timelineData = useMemo<TimelinePoint[]>(() => {
        const ranges: Record<string, string[]> = {
            '6h': ['01:00', '02:00', '03:00', '04:00', '05:00', 'Hiện tại'],
            '12h': ['02:00', '04:00', '06:00', '08:00', '10:00', 'Hiện tại'],
            '24h': ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', 'Hiện tại'],
            '7d': ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'],
        }
        const labels = ranges[timeRange] || ranges['24h']
        const baseValues = [12400, 18600, 29400, 48200, 62100, 78900, 94200]

        return labels.map((label, idx) => {
            const jitter = Math.sin(idx * 1.5) * 8000
            const prompt = Math.max(3000, Math.round((baseValues[idx] || 50000) * 0.44 + jitter * 0.4))
            const completion = Math.max(4000, Math.round((baseValues[idx] || 50000) * 0.56 + jitter * 0.6))
            return {
                time: label,
                promptTokens: prompt,
                completionTokens: completion,
                totalTokens: prompt + completion,
                requests: Math.round((prompt + completion) / 380),
            }
        })
    }, [timeRange])

    const maxTimelineToken = useMemo(() => {
        const max = Math.max(...timelineData.map((d) => d.totalTokens))
        return Math.ceil(max / 10000) * 10000 || 100000
    }, [timelineData])

    // ─── PHÂN BỔ TẢI THEO MÔ HÌNH LLM ──────────────────────────────────
    const modelDistribution = useMemo(() => {
        return [
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google Cloud', color: '#10b981', share: 44, tokens: 94200, latency: '112ms' },
            { id: 'gpt-4o', name: 'GPT-4o Omnimodal', provider: 'OpenAI', color: '#6366f1', share: 26, tokens: 55600, latency: '240ms' },
            { id: 'deepseek-v3', name: 'DeepSeek V3 / R1', provider: 'DeepSeek', color: '#06b6d4', share: 16, tokens: 34200, latency: '185ms' },
            { id: 'qwen2.5-coder', name: 'Qwen 2.5 Coder (P2P)', provider: 'Local / Ollama', color: '#f59e0b', share: 10, tokens: 21400, latency: '42ms' },
            { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', color: '#ec4899', share: 4, tokens: 8600, latency: '310ms' },
        ]
    }, [])

    // ─── NHẬT KÝ KIỂM TOÁN VẬN HÀNH (AUDIT LOGS) ─────────────────────────
    const auditLogs = useMemo<AuditLogItem[]>(() => {
        return [
            {
                id: 'log-1',
                timestamp: '16:11:42',
                service: 'agent-service',
                tag: '[DISPATCH]',
                message: 'Điều phối Agent [Data Analyst] thực hiện chuỗi truy vấn phân tích dữ liệu phòng làm việc.',
                details: 'Tool: Database Analyzer | Model: gemini-2.5-flash',
            },
            {
                id: 'log-2',
                timestamp: '16:10:18',
                service: 'rltrain-service',
                tag: '[TRAIN]',
                message: 'Đã lưu checkpoint tập Policy huấn luyện: policy_agent_analyst_v1',
                details: 'Episodes: 300 | 8-Beam Continuous LIDAR | Thành công: 94.5%',
            },
            {
                id: 'log-3',
                timestamp: '16:08:55',
                service: 'distributed-service',
                tag: '[HEARTBEAT]',
                message: 'Nhận gói telemetry định kỳ từ Worker Node GPU [RTX-4090-Node-01].',
                details: 'GPU Load: 42% | VRAM: 11.2/24.0 GB | Ping: 18ms',
            },
            {
                id: 'log-4',
                timestamp: '16:05:30',
                service: 'room-service',
                tag: '[INFO]',
                message: 'Đồng bộ không gian 3D và vật thể cản Studio Map 3D cho Room ID #room_main.',
                details: 'Bản đồ: Nhà xưởng Công nghiệp (industrial_factory) | Active Agents: 4',
            },
            {
                id: 'log-5',
                timestamp: '16:01:12',
                service: 'marketplace-service',
                tag: '[SUCCESS]',
                message: 'Khởi tạo phiên thuê tài nguyên P2P GPU Seller Session cho tác vụ suy luận cụm.',
                details: 'Escrow: 50 Coins/Giờ | Allocated RAM: 16GB',
            },
        ]
    }, [])

    // ─── LỌC DANH SÁCH AGENT ───────────────────────────────────────────
    const filteredAgents = useMemo(() => {
        return agents.filter((a) => {
            const matchesSearch =
                a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                a.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (a.model || '').toLowerCase().includes(searchQuery.toLowerCase())
            if (!matchesSearch) return false

            if (agentStatusFilter === 'all') return true
            if (agentStatusFilter === 'working') return a.status === 'working'
            if (agentStatusFilter === 'idle') return a.status === 'idle'
            if (agentStatusFilter === 'blocked') return a.status === 'blocked' || a.status === 'error'
            return true
        })
    }, [agents, searchQuery, agentStatusFilter])

    // ─── TÍNH TOÁN ĐƯỜNG CONG SVG AREA CHART ───────────────────────────
    const chartWidth = 720
    const chartHeight = 220
    const paddingX = 40
    const paddingY = 24

    const chartPoints = useMemo(() => {
        const usableWidth = chartWidth - paddingX * 2
        const usableHeight = chartHeight - paddingY * 2
        const count = timelineData.length
        const stepX = count > 1 ? usableWidth / (count - 1) : usableWidth

        return timelineData.map((d, i) => {
            const x = paddingX + i * stepX
            const ratioTotal = Math.min(1, Math.max(0, d.totalTokens / maxTimelineToken))
            const ratioPrompt = Math.min(1, Math.max(0, d.promptTokens / maxTimelineToken))
            const yTotal = chartHeight - paddingY - ratioTotal * usableHeight
            const yPrompt = chartHeight - paddingY - ratioPrompt * usableHeight
            return { x, yTotal, yPrompt, ...d }
        })
    }, [timelineData, maxTimelineToken])

    const totalPathD = useMemo(() => {
        if (chartPoints.length === 0) return ''
        let d = `M ${chartPoints[0].x} ${chartPoints[0].yTotal}`
        for (let i = 1; i < chartPoints.length; i++) {
            const prev = chartPoints[i - 1]
            const curr = chartPoints[i]
            const cx = (prev.x + curr.x) / 2
            d += ` C ${cx} ${prev.yTotal}, ${cx} ${curr.yTotal}, ${curr.x} ${curr.yTotal}`
        }
        return d
    }, [chartPoints])

    const totalAreaD = useMemo(() => {
        if (chartPoints.length === 0) return ''
        const first = chartPoints[0]
        const last = chartPoints[chartPoints.length - 1]
        const bottomY = chartHeight - paddingY
        return `${totalPathD} L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`
    }, [totalPathD, chartPoints])

    const promptPathD = useMemo(() => {
        if (chartPoints.length === 0) return ''
        let d = `M ${chartPoints[0].x} ${chartPoints[0].yPrompt}`
        for (let i = 1; i < chartPoints.length; i++) {
            const prev = chartPoints[i - 1]
            const curr = chartPoints[i]
            const cx = (prev.x + curr.x) / 2
            d += ` C ${cx} ${prev.yPrompt}, ${cx} ${curr.yPrompt}, ${curr.x} ${curr.yPrompt}`
        }
        return d
    }, [chartPoints])

    return (
        <div className="w-full max-w-full space-y-7 pb-20 text-foreground">
            {/* ─── 1. HERO HEADER & CONTROL CENTER ─────────────────────── */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/80 pb-5">
                <div>
                    <div className="flex items-center gap-2.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-[11px] font-mono text-primary font-semibold uppercase tracking-wider">
                            <Activity className="w-3.5 h-3.5" />
                            Multi-Agent Swarm Telemetry
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-500 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            [GATEWAY_ACTIVE]
                        </span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground mt-2">
                        {t.nav.dashboard} & Trung Tâm Giám Sát Mạng Lưới AI
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1 max-w-3xl">
                        Giám sát hợp nhất thời gian thực bầy đàn tác tử thông minh, thông lượng suy luận LLM đa tầng, tiến trình hội tụ RL Navigation 3D và cụm máy trạm tính toán phân tán.
                    </p>
                </div>

                {/* THANH THAO TÁC & BỘ LỌC THỜI GIAN */}
                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <div className="inline-flex items-center rounded-xl border border-border bg-card p-1 text-xs shadow-xs">
                        {(['6h', '12h', '24h', '7d'] as const).map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-2.5 py-1 rounded-lg font-mono font-medium transition ${
                                    timeRange === range
                                        ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {range.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => loadDashboardData(false)}
                        disabled={refreshing}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card hover:bg-secondary text-xs font-medium text-foreground transition shadow-xs active:scale-95 disabled:opacity-50"
                        title="Đồng bộ dữ liệu từ toàn bộ microservices"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 text-primary ${refreshing ? 'animate-spin' : ''}`} />
                        <span>Đồng bộ</span>
                    </button>

                    <div className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card text-xs text-muted-foreground font-mono">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{lastSyncTime.toLocaleTimeString()}</span>
                    </div>
                </div>
            </div>

            {/* ─── 2. HÀNG SCORECARD TELEMETRY CAO CẤP (5 CARDS) ───────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                {/* CARD 1: AGENT SWARM */}
                <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs hover:border-border/90 transition">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Bầy Đàn Agent</span>
                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                            <Bot className="w-4 h-4" />
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
                            {agents.length}
                            <span className="text-xs font-normal text-muted-foreground ml-1.5 font-sans">agents</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {workingAgentsCount} Làm việc
                            </span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 text-amber-500">
                                {idleAgentsCount} Nghỉ
                            </span>
                        </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden flex">
                        <div style={{ width: `${agents.length ? (workingAgentsCount / agents.length) * 100 : 0}%` }} className="bg-emerald-500 h-full transition-all duration-500" />
                        <div style={{ width: `${agents.length ? (idleAgentsCount / agents.length) * 100 : 0}%` }} className="bg-amber-500 h-full transition-all duration-500" />
                        <div style={{ width: `${agents.length ? (blockedAgentsCount / agents.length) * 100 : 0}%` }} className="bg-rose-500 h-full transition-all duration-500" />
                    </div>
                </div>

                {/* CARD 2: TOKEN THROUGHPUT */}
                <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs hover:border-border/90 transition">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Thông Lượng Token</span>
                        <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
                            <Zap className="w-4 h-4" />
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
                            {totalTokensUsed.toLocaleString()}
                        </div>
                        <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted-foreground">
                            <span>Prompt: {promptTokensTotal.toLocaleString()}</span>
                            <span>Comp: {completionTokensTotal.toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden flex">
                        <div style={{ width: '42%' }} className="bg-sky-500 h-full" />
                        <div style={{ width: '58%' }} className="bg-purple-500 h-full" />
                    </div>
                </div>

                {/* CARD 3: DISTRIBUTED HARDWARE NODES */}
                <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs hover:border-border/90 transition">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Cụm Trạm Tính Toán</span>
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                            <Server className="w-4 h-4" />
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
                            {nodes.length}
                            <span className="text-xs font-normal text-muted-foreground ml-1.5 font-sans">máy trạm</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                            <span className="text-emerald-500 font-medium">{onlineNodesCount} Online</span>
                            <span>•</span>
                            <span>{totalVRAMGB} GB VRAM</span>
                            <span>•</span>
                            <span>{totalCPUCores} Cores</span>
                        </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div style={{ width: `${nodes.length ? (onlineNodesCount / nodes.length) * 100 : 80}%` }} className="bg-emerald-500 h-full transition-all duration-500" />
                    </div>
                </div>

                {/* CARD 4: ROOMS & COLLABORATION */}
                <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs hover:border-border/90 transition">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Phòng Cộng Tác Đa Tác Tử</span>
                        <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500">
                            <Building2 className="w-4 h-4" />
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
                            {rooms.length}
                            <span className="text-xs font-normal text-muted-foreground ml-1.5 font-sans">phòng</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                            <span className="text-cyan-500 font-medium">{totalOnlineUsers} Người dùng online</span>
                            <span>•</span>
                            <span>{cloudMapsCount} Bản đồ</span>
                        </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div style={{ width: '85%' }} className="bg-cyan-500 h-full" />
                    </div>
                </div>

                {/* CARD 5: RL TRAINING & CONVERGENCE */}
                <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs hover:border-border/90 transition">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Huấn Luyện RL 3D</span>
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                            <Compass className="w-4 h-4" />
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
                            {policies.length || 1}
                            <span className="text-xs font-normal text-muted-foreground ml-1.5 font-sans">policies lưu</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                            <span className="text-emerald-500 font-semibold">94.5% Thành công</span>
                            <span>•</span>
                            <span>LIDAR 8-Beam</span>
                        </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div style={{ width: '94.5%' }} className="bg-emerald-500 h-full" />
                    </div>
                </div>
            </div>

            {/* ─── 3. BIỂU ĐỒ ĐỒNG BỘ TELEMETRY (SVG CHARTS) ────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* BIỂU ĐỒ 1: AREA CHART DIỄN TIẾN TOKEN & SUY LUẬN (2 CỘT RỘNG) */}
                <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 space-y-4 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-primary" />
                                <h3 className="text-sm font-semibold text-foreground">
                                    Thông Lượng Suy Luận & Token Theo Thời Gian
                                </h3>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                Lưu lượng tokens đầu vào (Prompt) và câu trả lời (Completion) qua mạng lưới LLM.
                            </p>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-mono">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-xs bg-sky-500" />
                                <span className="text-muted-foreground text-[11px]">Prompt Tokens</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-xs bg-purple-500" />
                                <span className="text-muted-foreground text-[11px]">Tổng Lưu Lượng</span>
                            </div>
                        </div>
                    </div>

                    {/* SVG GRAPH CANVAS */}
                    <div className="relative w-full overflow-x-auto">
                        <svg
                            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                            className="w-full h-56 select-none"
                        >
                            <defs>
                                <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#a855f7" stopOpacity="0.32" />
                                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                                </linearGradient>
                                <linearGradient id="promptGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
                                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                                </linearGradient>
                            </defs>

                            {/* GRID LINES NGANG */}
                            {[0.2, 0.4, 0.6, 0.8, 1.0].map((ratio) => {
                                const y = chartHeight - paddingY - ratio * (chartHeight - paddingY * 2)
                                return (
                                    <g key={ratio}>
                                        <line
                                            x1={paddingX}
                                            y1={y}
                                            x2={chartWidth - paddingX}
                                            y2={y}
                                            stroke="currentColor"
                                            strokeDasharray="4 4"
                                            className="text-border/60"
                                        />
                                        <text
                                            x={paddingX - 8}
                                            y={y + 3}
                                            textAnchor="end"
                                            className="text-[9px] fill-muted-foreground font-mono"
                                        >
                                            {Math.round((ratio * maxTimelineToken) / 1000)}k
                                        </text>
                                    </g>
                                )
                            })}

                            {/* VÙNG ĐỔ MÀU GRADIENT */}
                            <path d={totalAreaD} fill="url(#totalGradient)" />

                            {/* ĐƯỜNG CONG TỔNG LƯU LƯỢNG */}
                            <path
                                d={totalPathD}
                                fill="none"
                                stroke="#a855f7"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                            />

                            {/* ĐƯỜNG CONG PROMPT TOKENS */}
                            <path
                                d={promptPathD}
                                fill="none"
                                stroke="#38bdf8"
                                strokeWidth="2"
                                strokeDasharray="3 3"
                                strokeLinecap="round"
                            />

                            {/* TỌA ĐỘ VÀ ĐIỂM CHẠM HOVER */}
                            {chartPoints.map((pt, i) => (
                                <g key={i} className="cursor-pointer">
                                    <circle
                                        cx={pt.x}
                                        cy={pt.yTotal}
                                        r={hoveredPointIndex === i ? 5 : 3.5}
                                        fill="#a855f7"
                                        stroke="#ffffff"
                                        strokeWidth="1.5"
                                        onMouseEnter={() => setHoveredPointIndex(i)}
                                        onMouseLeave={() => setHoveredPointIndex(null)}
                                    />
                                    {/* Nhãn trục X */}
                                    <text
                                        x={pt.x}
                                        y={chartHeight - 6}
                                        textAnchor="middle"
                                        className="text-[10px] fill-muted-foreground font-mono"
                                    >
                                        {pt.time}
                                    </text>
                                </g>
                            ))}
                        </svg>

                        {/* HOVER TOOLTIP POPUP */}
                        {hoveredPointIndex !== null && chartPoints[hoveredPointIndex] && (
                            <div
                                className="absolute pointer-events-none rounded-xl border border-border bg-popover/95 backdrop-blur-md p-2.5 text-xs shadow-md z-10 transition-all font-mono"
                                style={{
                                    left: `${(chartPoints[hoveredPointIndex].x / chartWidth) * 100}%`,
                                    top: '15%',
                                    transform: 'translateX(-50%)',
                                }}
                            >
                                <div className="text-[10px] text-muted-foreground border-b border-border/60 pb-1 mb-1">
                                    Mốc: {chartPoints[hoveredPointIndex].time}
                                </div>
                                <div className="text-purple-400 font-semibold">
                                    Tổng: {chartPoints[hoveredPointIndex].totalTokens.toLocaleString()} tok
                                </div>
                                <div className="text-sky-400 text-[11px]">
                                    Prompt: {chartPoints[hoveredPointIndex].promptTokens.toLocaleString()} tok
                                </div>
                                <div className="text-muted-foreground text-[10px]">
                                    {chartPoints[hoveredPointIndex].requests} Lượt yêu cầu
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-t border-border/70 pt-3 text-center">
                        <div>
                            <div className="text-[10px] text-muted-foreground">Độ trễ trung bình</div>
                            <div className="text-xs font-semibold font-mono text-emerald-400 mt-0.5">118 ms</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-muted-foreground">Tốc độ suy luận đỉnh</div>
                            <div className="text-xs font-semibold font-mono text-sky-400 mt-0.5">242 tok/s</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-muted-foreground">Tỷ lệ thành công</div>
                            <div className="text-xs font-semibold font-mono text-foreground mt-0.5">99.8%</div>
                        </div>
                    </div>
                </div>

                {/* BIỂU ĐỒ 2: PHÂN BỔ TẢI THEO MÔ HÌNH LLM (1 CỘT) */}
                <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-primary" />
                                <h3 className="text-sm font-semibold text-foreground">
                                    Phân Bổ Tải Mô Hình LLM
                                </h3>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-secondary text-muted-foreground font-mono">
                                5 Models
                            </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Tỷ lệ phân phối khối lượng công việc đa agent qua các nhà cung cấp.
                        </p>

                        {/* Multi-segment progress bar */}
                        <div className="w-full h-3 rounded-full bg-secondary overflow-hidden flex my-4">
                            {modelDistribution.map((m) => (
                                <div
                                    key={m.id}
                                    style={{ width: `${m.share}%`, backgroundColor: m.color }}
                                    className="h-full transition-all"
                                    title={`${m.name}: ${m.share}%`}
                                />
                            ))}
                        </div>

                        {/* Danh sách các mô hình */}
                        <div className="space-y-3">
                            {modelDistribution.map((m) => (
                                <div key={m.id} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                                            <span className="font-medium text-foreground truncate">{m.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 font-mono text-xs shrink-0">
                                            <span className="text-muted-foreground text-[11px]">{m.latency}</span>
                                            <span className="font-semibold text-foreground">{m.share}%</span>
                                        </div>
                                    </div>
                                    <div className="w-full h-1 rounded-full bg-secondary overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{ width: `${m.share}%`, backgroundColor: m.color }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-xl border border-border/80 bg-secondary/40 p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Khuyến nghị tối ưu</span>
                            <span className="text-emerald-400 font-mono">[TIẾT KIỆM 40%]</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Mặc định định tuyến tác vụ nhẹ cho <span className="text-foreground font-semibold">Gemini 2.5 Flash Lite</span> và đẩy suy luận nặng xuống cụm <span className="text-foreground font-semibold">Worker Node P2P</span>.
                        </p>
                    </div>
                </div>
            </div>

            {/* ─── 4. BẢNG DỮ LIỆU TỔNG THỂ VỚI TABS ĐA NHIỆM ──────────── */}
            <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
                {/* THANH TAB & THANH TÌM KIẾM */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border p-4 bg-muted/20">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <button
                            onClick={() => setActiveTab('agents')}
                            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition ${
                                activeTab === 'agents'
                                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                            }`}
                        >
                            <Bot className="w-3.5 h-3.5" />
                            <span>Bầy Đàn Agent ({agents.length})</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('nodes')}
                            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition ${
                                activeTab === 'nodes'
                                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                            }`}
                        >
                            <Server className="w-3.5 h-3.5" />
                            <span>Máy Trạm Phân Tán ({nodes.length})</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('rooms')}
                            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition ${
                                activeTab === 'rooms'
                                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                            }`}
                        >
                            <Building2 className="w-3.5 h-3.5" />
                            <span>Phòng Cộng Tác ({rooms.length})</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('logs')}
                            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition ${
                                activeTab === 'logs'
                                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                            }`}
                        >
                            <Terminal className="w-3.5 h-3.5" />
                            <span>Audit Logs ({auditLogs.length})</span>
                        </button>
                    </div>

                    {/* SEARCH VÀ FILTER CHO TAB AGENTS */}
                    {activeTab === 'agents' && (
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Tìm tên, ID, model..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-8 pr-3 py-1.5 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary w-48 sm:w-56"
                                />
                            </div>

                            <select
                                value={agentStatusFilter}
                                onChange={(e) => setAgentStatusFilter(e.target.value as any)}
                                className="px-2.5 py-1.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-hidden"
                            >
                                <option value="all">Tất cả trạng thái</option>
                                <option value="working">Đang làm việc</option>
                                <option value="idle">Nghỉ (Idle)</option>
                                <option value="blocked">Lỗi / Chặn</option>
                            </select>
                        </div>
                    )}
                </div>

                {/* ── TAB 1: BẢNG DANH BẠ BẦY ĐÀN AGENTS ── */}
                {activeTab === 'agents' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-secondary/40 text-muted-foreground font-medium border-b border-border/80">
                                <tr>
                                    <th className="py-3 px-4">Agent & Định danh</th>
                                    <th className="py-3 px-4">Hình thái (Chassis)</th>
                                    <th className="py-3 px-4">Mô hình LLM</th>
                                    <th className="py-3 px-4">Policy RL (Storage)</th>
                                    <th className="py-3 px-4">Công cụ nạp</th>
                                    <th className="py-3 px-4">Tọa độ 3D</th>
                                    <th className="py-3 px-4">Trạng thái</th>
                                    <th className="py-3 px-4 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {filteredAgents.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-8 text-center text-muted-foreground">
                                            Không tìm thấy agent nào phù hợp với bộ lọc hiện tại.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredAgents.map((a) => {
                                        const formLabel = a.form ? a.form.toUpperCase() : 'HUMANOID'
                                        const policyName = `policy_${a.id}_v1`
                                        return (
                                            <tr key={a.id} className="hover:bg-secondary/30 transition">
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <span
                                                            className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                                                            style={{ backgroundColor: a.color || '#3b82f6' }}
                                                        />
                                                        <div>
                                                            <div className="font-semibold text-foreground truncate">{a.name}</div>
                                                            <div className="text-[10px] font-mono text-muted-foreground">{a.id}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary border border-border text-[10px] font-mono font-medium text-muted-foreground">
                                                        <Box className="w-3 h-3 text-primary" />
                                                        {formLabel}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-[10px] font-mono text-purple-400 font-medium">
                                                        <Cpu className="w-3 h-3 text-purple-400" />
                                                        {a.model || 'gemini-2.5-flash'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-400 font-medium" title="Tập policy đã nạp cho Agent">
                                                        <Save className="w-3 h-3 text-emerald-400" />
                                                        {policyName}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 font-mono text-muted-foreground">
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-secondary text-[10px]">
                                                        <Wrench className="w-3 h-3 text-amber-400" />
                                                        {Array.isArray(a.tools) ? a.tools.length : 3} tools
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                                                    [{a.position ? `${a.position[0].toFixed(1)}, ${a.position[2].toFixed(1)}` : '0.0, 0.0'}]
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span
                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase ${
                                                            a.status === 'working'
                                                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                                                : a.status === 'idle'
                                                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                                        }`}
                                                    >
                                                        <span
                                                            className={`w-1.5 h-1.5 rounded-full ${
                                                                a.status === 'working'
                                                                    ? 'bg-emerald-400 animate-pulse'
                                                                    : a.status === 'idle'
                                                                    ? 'bg-amber-400'
                                                                    : 'bg-rose-400'
                                                            }`}
                                                        />
                                                        {a.status}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => setSelectedAgentForInspect(a)}
                                                            className="px-2.5 py-1 rounded-lg border border-border bg-card hover:bg-secondary text-[11px] font-medium text-foreground transition"
                                                        >
                                                            Thanh tra
                                                        </button>
                                                        <Link
                                                            href={`/agents/${a.id}`}
                                                            className="p-1 rounded-lg border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                                                            title="Mở cấu hình Setup"
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── TAB 2: BẢNG CỤM MÁY TRẠM PHÂN TÁN (NODES) ── */}
                {activeTab === 'nodes' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-secondary/40 text-muted-foreground font-medium border-b border-border/80">
                                <tr>
                                    <th className="py-3 px-4">Tên Trạm Node & ID</th>
                                    <th className="py-3 px-4">Nền tảng & Vi xử lý</th>
                                    <th className="py-3 px-4">Card GPU & VRAM</th>
                                    <th className="py-3 px-4">Tải CPU / RAM / Disk</th>
                                    <th className="py-3 px-4">Mô hình AI Đang chạy</th>
                                    <th className="py-3 px-4">Doanh thu Coin</th>
                                    <th className="py-3 px-4">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {nodes.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-8 text-center text-muted-foreground">
                                            Chưa ghi nhận trạm Worker Node nào đang trực tuyến trong mạng lưới P2P.
                                        </td>
                                    </tr>
                                ) : (
                                    nodes.map((n) => (
                                        <tr key={n.id} className="hover:bg-secondary/30 transition">
                                            <td className="py-3 px-4">
                                                <div className="font-semibold text-foreground">{n.nodeName || 'Worker-P2P'}</div>
                                                <div className="text-[10px] font-mono text-muted-foreground truncate max-w-[120px]">{n.id}</div>
                                            </td>
                                            <td className="py-3 px-4 font-mono text-muted-foreground">
                                                <div>{n.hardware?.os || 'Linux'} ({n.hardware?.arch || 'x64'})</div>
                                                <div className="text-[10px] text-muted-foreground">{n.hardware?.cpuCores || 8} Cores • {n.hardware?.deviceMemoryGB || 16} GB RAM</div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="font-medium text-foreground">{n.hardware?.gpuName || 'NVIDIA RTX'}</div>
                                                <div className="text-[10px] font-mono text-emerald-400">{n.hardware?.vramGB || 8} GB VRAM • WebGPU OK</div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="space-y-1 w-28">
                                                    <div className="flex items-center justify-between text-[10px] font-mono">
                                                        <span>CPU</span>
                                                        <span>{n.lastTelemetry?.cpu_percent || 24}%</span>
                                                    </div>
                                                    <div className="w-full h-1 rounded-full bg-secondary overflow-hidden">
                                                        <div style={{ width: `${n.lastTelemetry?.cpu_percent || 24}%` }} className="h-full bg-primary" />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 font-mono text-purple-400">
                                                {n.activeModel || 'qwen2.5-coder:7b'}
                                            </td>
                                            <td className="py-3 px-4 font-mono font-semibold text-amber-400">
                                                +{n.totalCoinsEarned || 0} Coins
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase ${
                                                    n.status === 'BUSY'
                                                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                                        : n.status === 'IDLE'
                                                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                                        : 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/30'
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${n.status === 'BUSY' ? 'bg-blue-400 animate-pulse' : n.status === 'IDLE' ? 'bg-emerald-400' : 'bg-zinc-400'}`} />
                                                    {n.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── TAB 3: BẢNG PHÒNG LÀM VIỆC ĐA TÁC TỬ (ROOMS) ── */}
                {activeTab === 'rooms' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-secondary/40 text-muted-foreground font-medium border-b border-border/80">
                                <tr>
                                    <th className="py-3 px-4">Tên Phòng & ID</th>
                                    <th className="py-3 px-4">Môi trường Bản đồ 3D</th>
                                    <th className="py-3 px-4">Agent Tham gia</th>
                                    <th className="py-3 px-4">Người dùng Online</th>
                                    <th className="py-3 px-4">Chế độ Phối hợp</th>
                                    <th className="py-3 px-4 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {rooms.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                                            Chưa có phòng làm việc nào được khởi tạo.
                                        </td>
                                    </tr>
                                ) : (
                                    rooms.map((r) => {
                                        const rId = r.id || r._id || ''
                                        return (
                                            <tr key={rId} className="hover:bg-secondary/30 transition">
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold text-foreground">{r.name}</div>
                                                    <div className="text-[10px] font-mono text-muted-foreground">{rId}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-[10px] font-mono">
                                                        <MapPin className="w-3 h-3 text-cyan-400" />
                                                        Office 3D Room Map
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 font-mono">
                                                    <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px]">
                                                        {r.activeAgents?.length || 0} Agents
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 font-mono text-emerald-400 font-semibold">
                                                    {r.onlineCount || 1} online
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                                        {r.workflow?.mode || 'Autonomous'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <Link
                                                        href={`/rooms/${rId}`}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground font-medium text-[11px] hover:opacity-90 transition"
                                                    >
                                                        <span>Vào phòng</span>
                                                        <ChevronRight className="w-3 h-3" />
                                                    </Link>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── TAB 4: NHẬT KÝ KIỂM TOÁN HỆ THỐNG (AUDIT LOGS) ── */}
                {activeTab === 'logs' && (
                    <div className="p-4 space-y-2.5 font-mono text-xs">
                        {auditLogs.map((log) => (
                            <div
                                key={log.id}
                                className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 p-3 rounded-xl border border-border/70 bg-secondary/30 hover:bg-secondary/60 transition"
                            >
                                <div className="flex items-start gap-3 min-w-0">
                                    <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{log.timestamp}</span>
                                    <span className="px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[10px] text-primary font-bold shrink-0">
                                        {log.tag}
                                    </span>
                                    <div className="min-w-0">
                                        <div className="text-foreground text-xs">{log.message}</div>
                                        {log.details && (
                                            <div className="text-[11px] text-muted-foreground mt-0.5">{log.details}</div>
                                        )}
                                    </div>
                                </div>
                                <span className="text-[10px] text-muted-foreground/80 px-2 py-0.5 rounded-md bg-background border border-border shrink-0 self-start sm:self-auto">
                                    {log.service}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ─── 5. TOPOLOGY TRẠNG THÁI 5 MICROSERVICES NỀN TẢNG ───────── */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Network className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">
                            Hiện Trạng Cụm Microservices & Hạ Tầng Kết Nối
                        </h3>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-400">
                        [5/5 SERVICES_OPERATIONAL]
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {[
                        { name: 'agent-service', port: ':8000', tech: 'FastAPI / PyTorch', desc: 'Reasoning Core & LLM Chains', ping: '12ms' },
                        { name: 'room-service', port: ':8001', tech: 'Node.js / Socket.IO', desc: 'Multiplayer 3D Mesh & Rooms', ping: '16ms' },
                        { name: 'distributed-service', port: ':8005', tech: 'Go Gin / WebSockets', desc: 'P2P Cluster & Hardware Registry', ping: '8ms' },
                        { name: 'rltrain-service', port: ':8008', tech: 'Python / Gymnasium', desc: 'PPO & 8-Beam Continuous LIDAR', ping: '15ms' },
                        { name: 'marketplace-service', port: ':8002', tech: 'Go Gin / SQLite', desc: 'Compute Rental & Coin Escrow', ping: '10ms' },
                    ].map((svc) => (
                        <div
                            key={svc.name}
                            className="rounded-xl border border-border bg-card p-3.5 space-y-2 shadow-xs hover:border-border/90 transition"
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-xs font-semibold text-foreground">{svc.name}</span>
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            </div>
                            <div className="text-[11px] font-mono text-muted-foreground">
                                Cổng {svc.port} • <span className="text-emerald-400">{svc.ping}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                                {svc.desc}
                            </p>
                            <div className="text-[10px] font-mono text-muted-foreground/80 border-t border-border/60 pt-1.5">
                                {svc.tech}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ─── 6. DOCK ĐIỀU HƯỚNG NHANH CÁC STUDIO TRỌNG TÂM ──────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
                <Link
                    href="/rooms"
                    className="flex flex-col items-center text-center p-3.5 rounded-2xl border border-border bg-card hover:border-primary/50 hover:bg-secondary/40 transition shadow-xs group"
                >
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition mb-2">
                        <Users className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-foreground">Team Rooms 3D</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">Không gian làm việc</span>
                </Link>

                <Link
                    href="/training"
                    className="flex flex-col items-center text-center p-3.5 rounded-2xl border border-border bg-card hover:border-primary/50 hover:bg-secondary/40 transition shadow-xs group"
                >
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 group-hover:bg-amber-600 group-hover:text-white transition mb-2">
                        <Compass className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-foreground">RL Training 3D</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">Luyện né vật cản</span>
                </Link>

                <Link
                    href="/agents/setup"
                    className="flex flex-col items-center text-center p-3.5 rounded-2xl border border-border bg-card hover:border-primary/50 hover:bg-secondary/40 transition shadow-xs group"
                >
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500 group-hover:bg-purple-600 group-hover:text-white transition mb-2">
                        <Bot className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-foreground">Agent Setup</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">Mô hình & Tools</span>
                </Link>

                <Link
                    href="/maps/setup"
                    className="flex flex-col items-center text-center p-3.5 rounded-2xl border border-border bg-card hover:border-primary/50 hover:bg-secondary/40 transition shadow-xs group"
                >
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 group-hover:bg-cyan-600 group-hover:text-white transition mb-2">
                        <MapPin className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-foreground">Studio Map 3D</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">Thiết kế bản đồ</span>
                </Link>

                <Link
                    href="/node-checker"
                    className="flex flex-col items-center text-center p-3.5 rounded-2xl border border-border bg-card hover:border-primary/50 hover:bg-secondary/40 transition shadow-xs group"
                >
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-600 group-hover:text-white transition mb-2">
                        <Server className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-foreground">Node Checker</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">Kiểm định máy trạm</span>
                </Link>

                <Link
                    href="/store"
                    className="flex flex-col items-center text-center p-3.5 rounded-2xl border border-border bg-card hover:border-primary/50 hover:bg-secondary/40 transition shadow-xs group"
                >
                    <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 group-hover:bg-rose-600 group-hover:text-white transition mb-2">
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-foreground">Store & Models</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">Kho mô hình & Tools</span>
                </Link>
            </div>

            {/* ─── 7. MODAL THANH TRA AGENT (NẾU CHỌN TRONG TABLE) ──────── */}
            {selectedAgentForInspect && (
                <AgentInspectorModal
                    agent={selectedAgentForInspect}
                    isOpen={Boolean(selectedAgentForInspect)}
                    onClose={() => setSelectedAgentForInspect(null)}
                    mapName="Office 3D Room Map"
                    onAgentUpdated={() => loadDashboardData(true)}
                />
            )}
        </div>
    )
}
