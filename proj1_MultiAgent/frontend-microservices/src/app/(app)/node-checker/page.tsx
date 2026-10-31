'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { notify } from '@/lib/toast'
import { useUser } from '@/hooks/useUser'
import { distributedApi } from '@/lib/api/distributed'
import { useWorkerNetwork } from '@/hooks/useWorkerNetwork'
import PartnerOnboardingModal from '@/components/distributed/PartnerOnboardingModal'
import {
    Cpu,
    HardDrive,
    Zap,
    Server,
    ShieldCheck,
    ArrowRight,
    Radio,
    Download,
    Play,
    Pause,
    Terminal,
    ChevronRight,
    ExternalLink,
    MapPin,
    CheckCircle2,
    Send,
    Sparkles,
    Bot,
    RefreshCw,
    MessageSquare,
    Sliders,
    Key,
    Copy,
    Check,
    Settings2,
    FileDown,
    Layers,
    Laptop,
} from 'lucide-react'

export default function NodeCheckerPage() {
    const { profile } = useUser()
    const {
        myNode: desktopNode,
        myNodes,
        onlineNodes,
        wsConnected,
        pingLatency,
        toggleNodeStatus,
        upsertRegisteredNode,
    } = useWorkerNetwork({
        id: profile?.id,
        name: profile?.name,
        email: profile?.email,
    })

    const [togglingStatus, setTogglingStatus] = useState(false)
    const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false)
    const [selectedNodeId, setSelectedNodeId] = useState<string>('')
    const [generatedNodeId, setGeneratedNodeId] = useState<string>('')
    const [generatedAuthToken, setGeneratedAuthToken] = useState<string>('')

    // Chọn node cụ thể nếu có nhiều node, mặc định là desktopNode
    const targetNode = React.useMemo(() => {
        if (selectedNodeId && myNodes && myNodes.length > 0) {
            const found = myNodes.find((n) => n.id === selectedNodeId)
            if (found) return found
        }
        return desktopNode
    }, [selectedNodeId, myNodes, desktopNode])

    // State cho cấu hình setup Core, RAM, GPU và Token kết nối Web - Local
    const [allocatedCores, setAllocatedCores] = useState<number>(4)
    const [allocatedRAMGB, setAllocatedRAMGB] = useState<number>(8)
    const [enableGPU, setEnableGPU] = useState<boolean>(true)
    const [gpuSharePercent, setGpuSharePercent] = useState<number>(75)
    const [minPricePerHourCoin, setMinPricePerHourCoin] = useState<number>(50)
    const [maxTokens, setMaxTokens] = useState<number>(2048)
    const [contextLength, setContextLength] = useState<number>(4096)
    const [temperature, setTemperature] = useState<number>(0.7)
    const [defaultModel, setDefaultModel] = useState<string>('qwen2.5-coder:1.5b')
    const [maxConcurrentTasks, setMaxConcurrentTasks] = useState<number>(2)
    const [copiedToken, setCopiedToken] = useState(false)
    const [isSavingConfig, setIsSavingConfig] = useState(false)

    // Xác định xem máy Seller có GPU rời thực tế hay không
    const hasDetectedGPU = targetNode
        ? Boolean(
              (targetNode as any).hasGPU ||
              (targetNode.hardware && targetNode.hardware.hasWebGPU) ||
              (targetNode.hardware?.gpuName && targetNode.hardware.gpuName !== 'CPU Mode')
          )
        : true

    // Đồng bộ cấu hình đã lưu khi targetNode tải xong
    React.useEffect(() => {
        if (targetNode) {
            if (targetNode.rentConfig) {
                if (targetNode.rentConfig.allocatedCores) setAllocatedCores(targetNode.rentConfig.allocatedCores)
                if (targetNode.rentConfig.allocatedRAMGB) setAllocatedRAMGB(targetNode.rentConfig.allocatedRAMGB)
                if (targetNode.rentConfig.enableGPU !== undefined) setEnableGPU(targetNode.rentConfig.enableGPU)
                if (targetNode.rentConfig.gpuSharePercent) setGpuSharePercent(targetNode.rentConfig.gpuSharePercent)
                if (targetNode.rentConfig.minPricePerHourCoin) setMinPricePerHourCoin(targetNode.rentConfig.minPricePerHourCoin)
                if (targetNode.rentConfig.maxTokens) setMaxTokens(targetNode.rentConfig.maxTokens)
                if (targetNode.rentConfig.contextLength) setContextLength(targetNode.rentConfig.contextLength)
                if (targetNode.rentConfig.temperature !== undefined) setTemperature(targetNode.rentConfig.temperature)
                if (targetNode.rentConfig.defaultModel) {
                    setDefaultModel(targetNode.rentConfig.defaultModel)
                    setTestModel(targetNode.rentConfig.defaultModel)
                }
                if (targetNode.rentConfig.maxConcurrentTasks) setMaxConcurrentTasks(targetNode.rentConfig.maxConcurrentTasks)
            } else if (targetNode.hardware) {
                if (targetNode.hardware.cpuCores) setAllocatedCores(Math.max(1, Math.round(targetNode.hardware.cpuCores / 2)))
                if (targetNode.hardware.deviceMemoryGB) setAllocatedRAMGB(Math.max(2, Math.round(targetNode.hardware.deviceMemoryGB / 2)))
            }
        }
    }, [targetNode])

    // State cho tính năng Test Stream LLM xuống máy Seller
    const [testModel, setTestModel] = useState<string>('qwen2.5-coder:1.5b')
    const [testPrompt, setTestPrompt] = useState<string>(
        'Xin chào! Hãy giới thiệu ngắn về bạn và kiểm tra xem kết nối LLM cục bộ trên máy Seller có ổn định không.'
    )
    const [isTesting, setIsTesting] = useState(false)
    const [streamOutput, setStreamOutput] = useState<string>('')
    const [testStats, setTestStats] = useState<{
        latencyMs?: number
        tokensCount?: number
        error?: string
        modelUsed?: string
    } | null>(null)

    // Node chỉ được coi là Đang Trực Tuyến khi Electron Worker thực sự đang kết nối và truyền Telemetry
    const isDesktopConnected =
        targetNode !== null &&
        (targetNode.status === 'IDLE' || targetNode.status === 'BUSY') &&
        Boolean(targetNode.lastTelemetry)

    const isRegisteredWaitingOrPaused = targetNode !== null && !isDesktopConnected

    const handleToggleConnection = async () => {
        if (!targetNode) return
        setTogglingStatus(true)
        try {
            const isCurrentlyActive = isDesktopConnected
            const nextAction = isCurrentlyActive ? 'OFFLINE' : 'IDLE'
            const res = await toggleNodeStatus(targetNode.id, nextAction)
            if (res.success) {
                notify.success(
                    isCurrentlyActive
                        ? 'Đã tạm dừng chia sẻ tài nguyên (ngắt khỏi mạng lưới 3D).'
                        : 'Đã mở sẵn sàng kết nối! Hãy chạy ứng dụng Electron Worker trên máy để truyền luồng dữ liệu.'
                )
            } else {
                notify.error('Lỗi cập nhật trạng thái: ' + res.message)
            }
        } catch (err: any) {
            notify.error('Không thể đổi trạng thái kết nối: ' + err.message)
        } finally {
            setTogglingStatus(false)
        }
    }

    const handleRunTestLLM = async () => {
        if (!testPrompt.trim()) {
            notify.error('Vui lòng nhập nội dung câu hỏi test.')
            return
        }
        setIsTesting(true)
        setStreamOutput('')
        setTestStats(null)

        try {
            const res = await distributedApi.testInferenceStream(
                {
                    nodeId: targetNode?.id,
                    model: testModel,
                    prompt: testPrompt,
                    temperature,
                    maxTokens,
                },
                (chunk) => {
                    setStreamOutput((prev) => prev + chunk)
                }
            )

            if (res.success) {
                // Ước lượng tokens theo từ
                const tokenEstimate = Math.max(1, Math.round(res.output.length / 3.5))
                setTestStats({
                    latencyMs: res.latencyMs,
                    tokensCount: tokenEstimate,
                    modelUsed: res.model || testModel,
                })
                notify.success(`Stream thành công từ máy Seller (${res.latencyMs}ms)!`)
            } else {
                setTestStats({
                    error: res.error || 'Worker không phản hồi',
                    latencyMs: res.latencyMs,
                })
                notify.error('Thất bại: ' + (res.error || 'Lỗi gọi Ollama'))
            }
        } catch (err: any) {
            setTestStats({
                error: err.message || 'Lỗi kết nối tới Distributed Service',
            })
            notify.error('Lỗi kiểm tra LLM: ' + err.message)
        } finally {
            setIsTesting(false)
        }
    }

    // Tên máy trạm thực tế nhận từ Electron Worker (ưu tiên nodeName, username, hoặc ID định danh)
    const effectiveNodeName =
        targetNode?.nodeName ||
        (targetNode?.username && targetNode.username !== 'Seller Node' && targetNode.username !== 'Seller_PC' ? targetNode.username : '') ||
        (targetNode?.id && !targetNode.id.startsWith('node_seller_') && !targetNode.id.startsWith('worker_') && !targetNode.id.startsWith('guest_') ? targetNode.id : '')

    const activeNodeName = effectiveNodeName || 'Chờ Electron Worker kết nối'

    const handleGenerateNewCredentials = () => {
        const randHex1 = Math.random().toString(36).substring(2, 7)
        const randHex2 = Math.random().toString(36).substring(2, 7)
        const timestamp = Date.now().toString(36).slice(-4)
        const newAuthToken = `dist_${randHex1}${randHex2}${timestamp}`
        setGeneratedAuthToken(newAuthToken)
        notify.success(`[SUCCESS] Đã sinh Auth Token mới! Hãy cấu hình Tên Máy Trạm trên Electron Worker để kết nối.`)
    }

    const activeAuthToken =
        generatedAuthToken ||
        targetNode?.authToken ||
        (profile?.id ? `dist_seller_${profile.id.slice(0, 8)}` : 'dist_seller_quickstart')

    const activeNodeId = effectiveNodeName || targetNode?.id || (profile?.id ? `node_${profile.id.slice(0, 8)}` : 'node_seller')

    const handleCopyToken = () => {
        navigator.clipboard.writeText(activeAuthToken)
        setCopiedToken(true)
        notify.success('Đã sao chép Auth Token vào bộ nhớ tạm!')
        setTimeout(() => setCopiedToken(false), 2500)
    }

    const handleDownloadConfigFile = () => {
        const nodeNameToSave = effectiveNodeName || 'phong 01'
        const configData = {
            serverWsUrl: 'ws://localhost:4000/api/v1/distributed/ws',
            authToken: activeAuthToken,
            nodeName: nodeNameToSave,
            localEndpoint: 'http://localhost:11434',
            allocatedCores,
            allocatedRAMGB,
            enableGPU,
            gpuSharePercent,
            maxTokens,
            contextLength,
            temperature,
            defaultModel,
            maxConcurrentTasks,
        }
        const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'worker-config.json'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        notify.success('[SUCCESS] Đã tải xuống file worker-config.json! Tên máy sẽ tự động map lên Web khi Worker chạy.')
    }

    const handleSaveRentConfig = async () => {
        setIsSavingConfig(true)
        try {
            const payload = {
                id: activeNodeId,
                nodeName: effectiveNodeName || 'phong 01',
                userId: profile?.id || targetNode?.userId || 'usr_seller_' + Date.now().toString(36),
                username: effectiveNodeName || profile?.name || 'Seller Node',
                email: profile?.email || targetNode?.email || 'seller@network.ai',
                hardware: targetNode?.hardware || {
                    cpuCores: navigator.hardwareConcurrency || 8,
                    deviceMemoryGB: 16,
                    hasWebGPU: false,
                    gpuName: 'NVIDIA GeForce RTX (hoặc CPU)',
                    vramGB: 8,
                    os: 'Windows 64-bit',
                    arch: 'x64',
                },
                rentConfig: {
                    allocatedCores,
                    allocatedRAMGB,
                    enableGPU,
                    gpuSharePercent,
                    availabilitySchedule: '24/7',
                    minPricePerHourCoin,
                    autoStartWithOS: true,
                    maxTokens,
                    contextLength,
                    temperature,
                    defaultModel,
                    maxConcurrentTasks,
                },
            }

            const res = await distributedApi.registerPartnerNode(payload)
            if (res.success && res.node) {
                upsertRegisteredNode(res.node)
                notify.success('[SUCCESS] Đã lưu cấu hình tài nguyên cấp phát & Token kết nối thành công!')
            } else {
                notify.error('Không thể lưu cấu hình: ' + (res.message || 'Lỗi không xác định'))
            }
        } catch (err: any) {
            notify.error('Lỗi khi lưu cấu hình: ' + err.message)
        } finally {
            setIsSavingConfig(false)
        }
    }

    const displayCores = targetNode?.hardware?.cpuCores || 0
    const displayRAM = targetNode?.hardware?.deviceMemoryGB || 0
    const displayGPU =
        targetNode?.hardware?.gpuName && targetNode.hardware.gpuName !== 'Đang kiểm tra...'
            ? targetNode.hardware.gpuName
            : 'Chờ ứng dụng Electron Worker quét driver GPU...'
    const detectedModels =
        targetNode?.compatibleModels && targetNode.compatibleModels.length > 0
            ? targetNode.compatibleModels
            : ['qwen2.5-coder:1.5b']

    return (
        <div className="mx-auto my-4 sm:my-6 max-w-7xl px-3 sm:px-6 space-y-6 transition-colors duration-200">
            {/* 1. HEADER TRANG & NÚT GIA NHẬP ĐỐI TÁC */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                        <Server className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-sm font-bold text-foreground tracking-wide">
                                Kiểm Tra Node AI & Kết Nối Electron Worker
                            </h1>
                            <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    wsConnected
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                        : 'bg-muted text-muted-foreground border-border'
                                }`}
                            >
                                {wsConnected ? 'WS Bridge Live' : 'WS Connecting...'}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Đồng bộ trực tiếp với trang <strong>Đối tác Mô hình</strong>: Khi chạy Electron Worker trên máy Seller, Node mới chính thức vào mạng lưới.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    <button
                        onClick={() => setIsOnboardingModalOpen(true)}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition flex items-center gap-1.5"
                    >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>Cấu Hình Đối Tác</span>
                    </button>

                    <a
                        href={distributedApi.getDownloadAppUrl()}
                        className="px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border border-border text-xs font-semibold transition flex items-center gap-1.5"
                        title="Tải trực tiếp bộ cài đặt Desktop Client"
                    >
                        <Download className="w-3.5 h-3.5 text-primary" />
                        <span>Tải Worker (.exe)</span>
                    </a>
                </div>
            </div>

            {/* 2. KHỐI GIÁM SÁT KẾT NỐI REAL-TIME TỪ ELECTRON DESKTOP WORKER */}
            <div
                className={`rounded-2xl border p-5 space-y-4 transition-all duration-300 ${
                    isDesktopConnected
                        ? 'bg-card border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                        : isRegisteredWaitingOrPaused
                        ? 'bg-card border-amber-500/30'
                        : 'bg-card border-border'
                }`}
            >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-3">
                    <div className="flex items-center gap-2.5">
                        <span
                            className={`w-3 h-3 rounded-full ${
                                isDesktopConnected
                                    ? 'bg-emerald-400 animate-pulse'
                                    : isRegisteredWaitingOrPaused
                                    ? 'bg-amber-400'
                                    : 'bg-muted-foreground'
                            }`}
                        />
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                                    {isDesktopConnected
                                        ? `Electron Worker Đang Kết Nối: ${activeNodeName}`
                                        : isRegisteredWaitingOrPaused
                                        ? `Đã Đăng Ký (${activeNodeName}) — Chờ Chạy Electron Worker`
                                        : 'Chưa Kết Nối Electron Desktop Worker'}
                                </h3>
                                {effectiveNodeName && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                        Tên máy: {effectiveNodeName}
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                {isDesktopConnected
                                    ? `Máy [${activeNodeName}] đã gia nhập mạng lưới Đối tác Mô hình 3D và sẵn sàng nhận lệnh suy luận AI.`
                                    : isRegisteredWaitingOrPaused
                                    ? 'Cấu hình đã lưu nhưng chưa nhận được luồng WebSocket từ worker.exe (hoặc đang tạm dừng).'
                                    : 'Hãy chạy ứng dụng Go-Python Worker (.exe) trên máy tính Seller để kết nối vào mạng lưới.'}
                            </p>
                        </div>
                    </div>

                    {/* Công tắc BẬT / TẮT kết nối vào mạng lưới khi có node */}
                    {targetNode && (
                        <button
                            onClick={handleToggleConnection}
                            disabled={togglingStatus}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-sm shrink-0 ${
                                isDesktopConnected
                                    ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 dark:text-amber-300 border-amber-500/30'
                                    : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
                            }`}
                        >
                            {isDesktopConnected ? (
                                <>
                                    <Pause className="w-3.5 h-3.5" />
                                    <span>{togglingStatus ? 'Đang dừng...' : 'Tạm Dừng Chia Sẻ'}</span>
                                </>
                            ) : (
                                <>
                                    <Play className="w-3.5 h-3.5 fill-current" />
                                    <span>{togglingStatus ? 'Đang bật...' : 'Bật Kết Nối Lại'}</span>
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* Chi tiết Ping và Tải thời gian thực từ Desktop App */}
                {isDesktopConnected ? (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div className="bg-secondary/40 p-3 rounded-xl border border-border space-y-1">
                                <span className="text-[10px] text-muted-foreground block">Độ Trễ WebSocket</span>
                                <div className="flex items-baseline gap-1">
                                    <strong className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                        {pingLatency ?? 8}
                                    </strong>
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">ms</span>
                                </div>
                                <span className="text-[9px] text-muted-foreground block">Stream trực tiếp P2P</span>
                            </div>

                            <div className="bg-secondary/40 p-3 rounded-xl border border-border space-y-1">
                                <span className="text-[10px] text-muted-foreground block">Tải CPU Máy Seller</span>
                                <div className="flex items-baseline gap-1">
                                    <strong className="text-lg font-black text-blue-600 dark:text-blue-400 font-mono">
                                        {targetNode?.lastTelemetry?.cpu_percent !== undefined
                                            ? targetNode.lastTelemetry.cpu_percent.toFixed(1)
                                            : '0.0'}
                                        %
                                    </strong>
                                </div>
                                <span className="text-[9px] text-muted-foreground block">Đo thực tế từ psutil</span>
                            </div>

                            <div className="bg-secondary/40 p-3 rounded-xl border border-border space-y-1">
                                <span className="text-[10px] text-muted-foreground block">Tải RAM Máy Seller</span>
                                <div className="flex items-baseline gap-1">
                                    <strong className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                        {targetNode?.lastTelemetry?.ram_percent !== undefined
                                            ? targetNode.lastTelemetry.ram_percent.toFixed(1)
                                            : '0.0'}
                                        %
                                    </strong>
                                </div>
                                <span className="text-[9px] text-muted-foreground block">Bộ nhớ vật lý thực</span>
                            </div>

                            <div className="bg-secondary/40 p-3 rounded-xl border border-border space-y-1">
                                <span className="text-[10px] text-muted-foreground block">SaveCoins Tích Lũy</span>
                                <div className="flex items-baseline gap-1">
                                    <strong className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
                                        {Number(targetNode?.totalCoinsEarned || 0).toFixed(2)}
                                    </strong>
                                    <span className="text-[10px] text-amber-600 dark:text-amber-400">Coins</span>
                                </div>
                                <span className="text-[9px] text-muted-foreground block">Cộng tự động khi Online</span>
                            </div>
                        </div>

                        {/* Card Giám Sát Trạng Thái Hoạt Động & Token Của Local LLM */}
                        <div className="bg-card/90 rounded-xl border border-border p-3.5 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-2.5">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                                        Trạng Thái Hoạt Động Của Local LLM (Ollama P2P)
                                    </span>
                                    <span className="text-[11px] text-muted-foreground font-mono">
                                        [{targetNode?.llmStats?.current_model || targetNode?.activeModel || defaultModel}]
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    {targetNode?.llmStats?.is_busy || targetNode?.status === 'BUSY' ? (
                                        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-[11px] font-bold animate-pulse">
                                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                                            <span>ĐANG SINH TOKEN (BUSY)</span>
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                            <span>SẴN SÀNG NHẬN LỆNH (IDLE)</span>
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                                <div className="bg-secondary/40 p-2.5 rounded-lg border border-border space-y-1">
                                    <span className="text-[10px] text-muted-foreground block">Tổng Token Xử Lý</span>
                                    <div className="flex items-baseline gap-1">
                                        <strong className="text-base font-black text-amber-600 dark:text-amber-400 font-mono">
                                            {(targetNode?.llmStats?.total_tokens ?? 0).toLocaleString()}
                                        </strong>
                                        <span className="text-[10px] text-muted-foreground font-mono">tokens</span>
                                    </div>
                                    <span className="text-[9px] text-muted-foreground block">
                                        Prompt: {(targetNode?.llmStats?.prompt_tokens ?? 0).toLocaleString()} | Sinh: {(targetNode?.llmStats?.completion_tokens ?? 0).toLocaleString()}
                                    </span>
                                </div>

                                <div className="bg-secondary/40 p-2.5 rounded-lg border border-border space-y-1">
                                    <span className="text-[10px] text-muted-foreground block">Số Lần Gọi LLM</span>
                                    <div className="flex items-baseline gap-1">
                                        <strong className="text-base font-black text-blue-600 dark:text-blue-400 font-mono">
                                            {targetNode?.llmStats?.total_requests ?? 0}
                                        </strong>
                                        <span className="text-[10px] text-muted-foreground font-mono">calls</span>
                                    </div>
                                    <span className="text-[9px] text-muted-foreground block">
                                        Đang chạy: {targetNode?.llmStats?.active_requests ?? 0} tác vụ
                                    </span>
                                </div>

                                <div className="bg-secondary/40 p-2.5 rounded-lg border border-border space-y-1">
                                    <span className="text-[10px] text-muted-foreground block">Tốc Độ Sinh Token</span>
                                    <div className="flex items-baseline gap-1">
                                        <strong className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                            {(targetNode?.llmStats?.tokens_per_sec ?? 0).toFixed(1)}
                                        </strong>
                                        <span className="text-[10px] text-muted-foreground font-mono">tok/s</span>
                                    </div>
                                    <span className="text-[9px] text-muted-foreground block">Đo đạc lần chạy gần nhất</span>
                                </div>

                                <div className="bg-secondary/40 p-2.5 rounded-lg border border-border space-y-1">
                                    <span className="text-[10px] text-muted-foreground block">Độ Trễ Phản Hồi</span>
                                    <div className="flex items-baseline gap-1">
                                        <strong className="text-base font-black text-purple-600 dark:text-purple-400 font-mono">
                                            {(targetNode?.llmStats?.last_latency_ms ?? 0).toFixed(0)}
                                        </strong>
                                        <span className="text-[10px] text-muted-foreground font-mono">ms</span>
                                    </div>
                                    <span className="text-[9px] text-muted-foreground block">Thời gian xử lý trọn vẹn</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-secondary/30 border border-dashed border-border rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                        <div className="space-y-1 text-center sm:text-left">
                            <span className="text-foreground font-bold flex items-center justify-center sm:justify-start gap-1.5">
                                <Radio className="w-4 h-4 text-blue-500 animate-spin" />
                                <span>Đang lắng nghe kết nối WebSocket từ ứng dụng Electron Worker...</span>
                            </span>
                            <p className="text-muted-foreground text-[11px] max-w-md">
                                Mở <strong>Go-Python Worker Monitor (.exe)</strong> trên máy tính Seller. Ngay khi ứng dụng chạy, thông số CPU/RAM/GPU/Ollama sẽ tự động đẩy lên đây và đưa máy vào <strong>Cụm 3D Đối Tác Mô Hình</strong>.
                            </p>
                        </div>

                        <a
                            href={distributedApi.getDownloadAppUrl()}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 shrink-0"
                        >
                            <Download className="w-4 h-4" />
                            <span>Tải Bộ Cài Worker</span>
                        </a>
                    </div>
                )}
            </div>

            {/* 2.5 CỤM MÁY TRẠM WORKER CỦA BẠN (MULTI-NODE CLUSTER) */}
            <div className="rounded-2xl border border-border bg-card/85 backdrop-blur-md p-5 space-y-4 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                            <Layers className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                                    Cụm Máy Trạm Của Bạn ({myNodes?.length || 0} Máy)
                                </h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                    Hỗ trợ 1 user gắn nhiều máy
                                </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                Quản lý danh sách các worker đang chạy. Tên máy (Node Name) do bạn đặt trong file cấu hình Electron Worker.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleGenerateNewCredentials}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition flex items-center gap-1.5 shadow-sm self-start sm:self-auto shrink-0"
                        title="Sinh ngẫu nhiên cặp Node ID và Auth Token mới để gắn thêm máy trạm tiếp theo"
                    >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Sinh Token Cho Máy Mới</span>
                    </button>
                </div>

                {myNodes && myNodes.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {myNodes.map((node) => {
                            const isLive = (node.status === 'IDLE' || node.status === 'BUSY') && Boolean(node.lastTelemetry)
                            const isSelected = targetNode?.id === node.id

                            return (
                                <div
                                    key={node.id}
                                    onClick={() => setSelectedNodeId(node.id)}
                                    className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-3 relative ${
                                        isSelected
                                            ? 'bg-blue-950/20 border-blue-500 shadow-md shadow-blue-500/10 ring-1 ring-blue-500/50'
                                            : 'bg-secondary/30 border-border hover:border-zinc-600 hover:bg-secondary/50'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-1.5">
                                                <Laptop className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                                <strong className="text-xs font-bold text-foreground truncate max-w-[170px]">
                                                    {node.nodeName || node.username || 'Máy Trạm Worker'}
                                                </strong>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground font-mono block">
                                                Thiết bị: {node.id}
                                            </span>
                                        </div>

                                        <span
                                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold border flex items-center gap-1 shrink-0 ${
                                                isLive
                                                    ? node.status === 'BUSY'
                                                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                                        : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                            }`}
                                        >
                                            <span
                                                className={`w-1.5 h-1.5 rounded-full ${
                                                    isLive
                                                        ? node.status === 'BUSY'
                                                            ? 'bg-amber-400 animate-ping'
                                                            : 'bg-emerald-400 animate-pulse'
                                                        : 'bg-zinc-500'
                                                }`}
                                            />
                                            <span>{isLive ? node.status : 'OFFLINE'}</span>
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-1.5 py-1 text-[10px] border-y border-border/60">
                                        <div>
                                            <span className="text-muted-foreground block">CPU</span>
                                            <span className="font-mono font-semibold text-foreground">
                                                {node.hardware?.cpuCores || 8}C
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block">RAM</span>
                                            <span className="font-mono font-semibold text-foreground">
                                                {node.hardware?.deviceMemoryGB || 16}GB
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block">GPU</span>
                                            <span className="font-mono font-semibold text-foreground truncate block">
                                                {node.hardware?.gpuName?.replace('NVIDIA GeForce ', '') || 'CPU'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-[10px] pt-0.5">
                                        <span className="text-muted-foreground font-mono truncate max-w-[130px]">
                                            {node.activeModel || node.compatibleModels?.[0] || 'qwen2.5-coder:1.5b'}
                                        </span>
                                        {isSelected ? (
                                            <span className="text-blue-400 font-bold flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" />
                                                <span>Đang Xem</span>
                                            </span>
                                        ) : (
                                            <span className="text-zinc-500 hover:text-foreground">Click để chọn</span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="p-4 rounded-xl border border-dashed border-border bg-secondary/20 text-center space-y-2 text-xs text-muted-foreground">
                        <p>Chưa có máy trạm nào được kết nối với tài khoản này.</p>
                        <p className="text-[11px]">
                            Bấm nút <strong>Sinh Token Cho Máy Mới</strong> bên trên, sau đó tải file <code>worker-config.json</code> và khởi chạy Electron Worker trên các máy để bắt đầu chia sẻ.
                        </p>
                    </div>
                )}
            </div>

            {/* 3. BỐ CỤC ĐA THIẾT BỊ (RESPONSIVE 12-COLUMN GRID TRÊN DESKTOP, STACK TRÊN MOBILE) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* CỘT TRÁI (7 COLS TRÊN DESKTOP): THIẾT LẬP TÀI NGUYÊN, TOKEN & THÔNG SỐ */}
                <div className="lg:col-span-7 space-y-6">
            {/* 4.5 CẤU HÌNH ĐIỀU CHỈNH TÀI NGUYÊN (CORE, RAM, GPU) & TOKEN KẾT NỐI LOCAL */}
            <div className="rounded-2xl border border-border bg-card/75 backdrop-blur-md p-5 space-y-5 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                            <Sliders className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                                <span>Cấu Hình Setup Tài Nguyên & Token Kết Nối Local Worker</span>
                            </h3>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                                Điều chỉnh giới hạn CPU, RAM, GPU cho phép Worker khai thác và lấy Token liên kết trực tiếp ứng dụng Electron/Python.
                            </p>
                        </div>
                    </div>

                    <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border self-start sm:self-auto flex items-center gap-1 ${
                            isDesktopConnected
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-zinc-800 text-zinc-400 border-border'
                        }`}
                    >
                        <Key className="w-3 h-3" />
                        <span>{isDesktopConnected ? 'Worker Live & Áp Dụng' : 'Sẵn Sàng Cấu Hình'}</span>
                    </span>
                </div>

                {/* KHỐI AUTH TOKEN & TẢI FILE CONFIG */}
                <div className="bg-zinc-950/80 border border-border rounded-xl p-3.5 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <label className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
                            <Key className="w-3.5 h-3.5 text-amber-400" />
                            <span>Mã Auth Token Kết Nối Máy Local:</span>
                        </label>
                        <div className="flex items-center gap-2 flex-wrap text-[10px]">
                            <span className="px-2.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300 font-mono">
                                Tên Máy (Node Name): <strong className="text-white">{activeNodeName}</strong>
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="flex-1 bg-zinc-900 border border-border rounded-lg px-3 py-2 text-xs font-mono text-amber-300 select-all truncate">
                            {activeAuthToken}
                        </div>

                        <button
                            type="button"
                            onClick={handleCopyToken}
                            className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 border border-border shrink-0"
                            title="Sao chép Token để dán vào Tab Config của Electron Worker"
                        >
                            {copiedToken ? (
                                <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-emerald-400">Đã Sao Chép</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                                    <span>Sao Chép Token</span>
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={handleGenerateNewCredentials}
                            className="px-3 py-2 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition flex items-center justify-center gap-1.5 shrink-0"
                            title="Sinh ngẫu nhiên cặp Node ID và Token mới để gắn thêm máy trạm mới cho tài khoản"
                        >
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>Sinh Token Mới (Generate)</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleDownloadConfigFile}
                            className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 shrink-0"
                            title="Tải trực tiếp file worker-config.json đặt vào thư mục chạy worker"
                        >
                            <FileDown className="w-3.5 h-3.5" />
                            <span>Tải worker-config.json</span>
                        </button>
                    </div>

                    <p className="text-[10px] text-zinc-400 leading-relaxed">
                        <strong className="text-zinc-300">Hướng dẫn kết nối & lắp nhiều máy:</strong> Bạn có thể bấm <em>Sinh Token Mới (Generate)</em> để tạo cặp Node ID và Token riêng cho từng máy tính Seller. Cấu hình tên máy (<code>nodeName</code>) trong ứng dụng Electron Worker hoặc file <code>worker-config.json</code>, hệ thống sẽ tự động hiển thị tên máy lên trang kiểm tra này.
                    </p>
                </div>

                {/* ĐIỀU CHỈNH SETUP TÀI NGUYÊN (CPU, RAM, GPU) */}
                <div className="space-y-4 pt-1">
                    <h4 className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Settings2 className="w-3.5 h-3.5 text-blue-400" />
                        <span>Giới Hạn Tài Nguyên Cấp Phát Cho Mạng Lưới</span>
                    </h4>

                    {/* CPU Cores Slider */}
                    <div className="space-y-1.5 bg-zinc-950/50 border border-border/80 p-3 rounded-xl">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-300 flex items-center gap-1.5">
                                <Cpu className="w-3.5 h-3.5 text-blue-400" />
                                <span>Số Luồng CPU Cho Phép:</span>
                            </span>
                            <strong className="text-blue-400 font-mono text-sm">
                                {allocatedCores} Cores{' '}
                                <span className="text-[10px] text-zinc-500">
                                    / {displayCores > 0 ? displayCores : 16} Cores máy
                                </span>
                            </strong>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max={Math.max(16, displayCores || 8)}
                            value={allocatedCores}
                            onChange={(e) => setAllocatedCores(parseInt(e.target.value))}
                            className="w-full accent-blue-500 cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                            <span>1 Core (Tối thiểu)</span>
                            <span>{Math.max(16, displayCores || 8)} Cores (Toàn bộ)</span>
                        </div>
                    </div>

                    {/* RAM Slider */}
                    <div className="space-y-1.5 bg-zinc-950/50 border border-border/80 p-3 rounded-xl">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-300 flex items-center gap-1.5">
                                <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                                <span>Dung Lượng RAM Cho Phép:</span>
                            </span>
                            <strong className="text-indigo-400 font-mono text-sm">
                                {allocatedRAMGB} GB{' '}
                                <span className="text-[10px] text-zinc-500">
                                    / {displayRAM > 0 ? displayRAM : 32} GB máy
                                </span>
                            </strong>
                        </div>
                        <input
                            type="range"
                            min="2"
                            max={Math.max(32, displayRAM || 16)}
                            step="1"
                            value={allocatedRAMGB}
                            onChange={(e) => setAllocatedRAMGB(parseInt(e.target.value))}
                            className="w-full accent-indigo-500 cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                            <span>2 GB</span>
                            <span>{Math.max(32, displayRAM || 16)} GB</span>
                        </div>
                    </div>

                    {/* GPU Switch & Share % */}
                    <div className="bg-zinc-950/50 border border-border/80 p-3 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5 cursor-pointer">
                                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Bật Tăng Tốc Phần Cứng GPU (Card Đồ Họa)</span>
                                </label>
                                <p className="text-[10px] text-zinc-400">
                                    Cho phép Worker offload layer và KV cache sang GPU để tăng tốc sinh token LLM.
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                disabled={!hasDetectedGPU}
                                checked={hasDetectedGPU && enableGPU}
                                onChange={(e) => setEnableGPU(e.target.checked)}
                                className={`w-4 h-4 rounded ${hasDetectedGPU ? 'accent-amber-500 cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
                            />
                        </div>

                        {!hasDetectedGPU && (
                            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-xs text-amber-300 flex items-center gap-2">
                                <span className="font-mono font-bold text-[10px] bg-amber-950/80 text-amber-400 px-2 py-0.5 rounded border border-amber-800 shrink-0">
                                    [Chế độ CPU Only]
                                </span>
                                <span className="text-[11px] text-zinc-400">
                                    Không phát hiện GPU rời NVIDIA trên máy đối tác. Tùy chọn chia sẻ GPU đã được khóa để chỉ chia sẻ CPU và RAM.
                                </span>
                            </div>
                        )}

                        {enableGPU && (
                            <div className="pt-2.5 border-t border-border space-y-1.5 pl-2 border-l-2 border-amber-500/50">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-zinc-300">Tỷ Lệ VRAM GPU Cho Phép Dùng:</span>
                                    <strong className="text-amber-400 font-mono text-sm">{gpuSharePercent}%</strong>
                                </div>
                                <input
                                    type="range"
                                    min="10"
                                    max="100"
                                    step="5"
                                    value={gpuSharePercent}
                                    onChange={(e) => setGpuSharePercent(parseInt(e.target.value))}
                                    className="w-full accent-amber-500 cursor-pointer"
                                />
                                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                                    <span>10% (Chạy nhẹ)</span>
                                    <span>100% (Toàn lực)</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* LLM Local Serving Configuration */}
                    <div className="bg-zinc-950/50 border border-border/80 p-3.5 rounded-xl space-y-3">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                            <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                <span>Cấu Hình Tham Số Mô Hình AI (Ollama Local LLM)</span>
                            </label>
                            <span className="text-[10px] text-zinc-500 font-mono">P2P Serving Engine</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div className="space-y-1">
                                <label className="text-zinc-400 text-[11px] block">Model Mặc Định Phục Vụ P2P:</label>
                                {detectedModels.length > 0 ? (
                                    <select
                                        value={defaultModel}
                                        onChange={(e) => setDefaultModel(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                                    >
                                        {detectedModels.map((m) => (
                                            <option key={m} value={m}>
                                                {m}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={defaultModel}
                                        onChange={(e) => setDefaultModel(e.target.value.trim())}
                                        placeholder="qwen2.5-coder:1.5b"
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                                    />
                                )}
                            </div>

                            <div className="space-y-1">
                                <label className="text-zinc-400 text-[11px] block">Tác Vụ Đồng Thời (Concurrent Tasks):</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="4"
                                    value={maxConcurrentTasks}
                                    onChange={(e) => setMaxConcurrentTasks(Math.max(1, Math.min(4, parseInt(e.target.value) || 1)))}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                                />
                            </div>
                        </div>

                        {/* Max Tokens Slider */}
                        <div className="space-y-1 pt-1">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-zinc-300">Max Tokens Tối Đa Mỗi Request:</span>
                                <strong className="text-amber-400 font-mono text-xs">{maxTokens} tokens</strong>
                            </div>
                            <input
                                type="range"
                                min="256"
                                max="8192"
                                step="256"
                                value={maxTokens}
                                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                                className="w-full accent-amber-500 cursor-pointer"
                            />
                            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                                <span>256 tokens</span>
                                <span>8,192 tokens</span>
                            </div>
                        </div>

                        {/* Context Length Slider */}
                        <div className="space-y-1 pt-1">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-zinc-300">Độ Dài Ngữ Cảnh (Context Window):</span>
                                <strong className="text-emerald-400 font-mono text-xs">{contextLength} tokens</strong>
                            </div>
                            <input
                                type="range"
                                min="1024"
                                max="16384"
                                step="1024"
                                value={contextLength}
                                onChange={(e) => setContextLength(parseInt(e.target.value))}
                                className="w-full accent-emerald-500 cursor-pointer"
                            />
                            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                                <span>1,024 tokens</span>
                                <span>16,384 tokens</span>
                            </div>
                        </div>

                        {/* Temperature Slider */}
                        <div className="space-y-1 pt-1">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-zinc-300">Độ Ngẫu Nhiên / Sáng Tạo (Temperature):</span>
                                <strong className="text-purple-400 font-mono text-xs">{temperature.toFixed(2)}</strong>
                            </div>
                            <input
                                type="range"
                                min="0.0"
                                max="1.0"
                                step="0.05"
                                value={temperature}
                                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                className="w-full accent-purple-500 cursor-pointer"
                            />
                            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                                <span>0.0 (Chính xác / Code)</span>
                                <span>1.0 (Sáng tạo)</span>
                            </div>
                        </div>
                    </div>

                    {/* Đơn Giá & Nút Lưu */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-zinc-400">Đơn giá cho thuê:</span>
                            <div className="flex items-center gap-1 bg-zinc-950 border border-border px-2.5 py-1.5 rounded-lg">
                                <input
                                    type="number"
                                    min="1"
                                    value={minPricePerHourCoin}
                                    onChange={(e) => setMinPricePerHourCoin(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-16 bg-transparent text-white font-mono font-bold text-xs focus:outline-none"
                                />
                                <span className="text-[10px] text-amber-400 font-semibold">Coins/giờ</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleSaveRentConfig}
                            disabled={isSavingConfig}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md ${
                                isSavingConfig
                                    ? 'bg-amber-600/50 text-amber-200 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-amber-600/20'
                            }`}
                        >
                            {isSavingConfig ? (
                                <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Đang Lưu Cấu Hình...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Lưu & Cập Nhật Thiết Lập Tài Nguyên</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* 3. THÔNG SỐ PHẦN CỨNG ĐỒNG BỘ TỪ ELECTRON WORKER */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-border bg-card/70 backdrop-blur-md p-5 text-xs">
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-zinc-400">
                        <Cpu className="w-4 h-4 text-blue-400" />
                        <span>Số Luồng CPU Máy Seller:</span>
                    </div>
                    <span className="text-sm font-semibold text-zinc-200 block font-mono">
                        {isDesktopConnected
                            ? `${displayCores} Cores (Từ Electron Worker)`
                            : displayCores > 0
                            ? `${displayCores} Cores (Cấu hình đã lưu - Offline)`
                            : 'Chưa kết nối Worker'}
                    </span>
                </div>

                <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-zinc-400">
                        <HardDrive className="w-4 h-4 text-indigo-400" />
                        <span>Dung Lượng RAM Hệ Thống:</span>
                    </div>
                    <span className="text-sm font-semibold text-zinc-200 block font-mono">
                        {isDesktopConnected
                            ? `${displayRAM} GB (Từ Electron Worker)`
                            : displayRAM > 0
                            ? `${displayRAM} GB (Cấu hình đã lưu - Offline)`
                            : 'Chưa kết nối Worker'}
                    </span>
                </div>

                <div className="sm:col-span-2 pt-3 border-t border-border/60 space-y-1">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-zinc-400">
                            <Zap className="w-4 h-4 text-amber-400" />
                            <span>Card Đồ Họa (GPU) & Vị Trí Node:</span>
                        </div>
                        {isDesktopConnected && (
                            <span className="text-[10px] text-emerald-400 font-semibold font-mono flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Đã đồng bộ sang Đối tác Mô hình</span>
                            </span>
                        )}
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                        <span
                            className={`text-xs font-medium ${
                                isDesktopConnected ? 'text-emerald-400' : 'text-zinc-400'
                            }`}
                        >
                            {isDesktopConnected ? displayGPU : 'Chờ ứng dụng Electron Worker kết nối...'}
                        </span>
                        {targetNode?.location && isDesktopConnected && (
                            <span className="text-[11px] text-cyan-400 flex items-center gap-1 font-mono">
                                <MapPin className="w-3.5 h-3.5" />
                                <span>
                                    {targetNode.location.city}, {targetNode.location.country}
                                </span>
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* 4. DANH SÁCH MODEL OLLAMA QUÉT TỪ MÁY SELLER */}
            <div className="rounded-2xl border border-border bg-card/70 backdrop-blur-md p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>Mô hình Local LLM trên máy Seller (quét từ cổng 11434):</span>
                    </h3>
                    <span className="text-[10px] text-zinc-500 font-mono">
                        {isDesktopConnected ? `${detectedModels.length} model sẵn sàng` : 'Chờ Worker quét Ollama'}
                    </span>
                </div>

                <div className="flex flex-wrap gap-2">
                    {detectedModels.map((model) => (
                        <span
                            key={model}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-medium font-mono ${
                                isDesktopConnected
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-sm'
                                    : 'bg-zinc-800/60 text-zinc-500 border-border'
                            }`}
                        >
                            {model}
                        </span>
                    ))}
                </div>
            </div>

                </div>

                {/* CỘT PHẢI (5 COLS TRÊN DESKTOP): PLAYGROUND TEST LLM, ENGINES & LINK 3D */}
                <div className="lg:col-span-5 space-y-6">
            {/* 5. KHU VỰC THỬ NGHIỆM TEST SUY LUẬN & STREAM LLM XUỐNG MÁY SELLER */}
            <div className="rounded-2xl border border-border bg-card/75 backdrop-blur-md p-5 space-y-4 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                            <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                                <span>Thử Nghiệm Gửi Lệnh & Stream LLM Xuống Máy Seller</span>
                            </h3>
                            <p className="text-[11px] text-zinc-400">
                                Bắn một câu hỏi qua WebSocket vào engine Ollama cục bộ để kiểm tra tốc độ stream token thời gian thực.
                            </p>
                        </div>
                    </div>
                    <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border self-start sm:self-auto ${
                            isDesktopConnected
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                : 'bg-zinc-800 text-zinc-400 border-border'
                        }`}
                    >
                        {isDesktopConnected ? 'Worker Ready to Stream' : 'Chờ Worker kết nối'}
                    </span>
                </div>

                {/* Chọn Model và Gợi ý Prompt */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-zinc-300 block">
                            Model Đích Trên Máy Seller:
                        </label>
                        <select
                            value={testModel}
                            onChange={(e) => setTestModel(e.target.value)}
                            className="w-full bg-zinc-950 border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                        >
                            {detectedModels.map((m) => (
                                <option key={m} value={m}>
                                    {m}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                        <label className="text-[11px] font-semibold text-zinc-300 block">
                            Gợi Ý Câu Hỏi Mẫu:
                        </label>
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                            {[
                                'Xin chào, giới thiệu bạn và test kết nối nhé!',
                                'Viết hàm Python đệ quy Fibonacci có memoization.',
                                'Kể 3 ưu điểm khi chạy Local LLM thay vì Cloud.',
                            ].map((sample, sIdx) => (
                                <button
                                    key={sIdx}
                                    type="button"
                                    onClick={() => setTestPrompt(sample)}
                                    className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[10px] text-zinc-300 hover:text-white transition shrink-0 truncate max-w-[220px]"
                                >
                                    {sample}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Input Prompt */}
                <div className="space-y-2">
                    <div className="relative">
                        <textarea
                            rows={3}
                            value={testPrompt}
                            onChange={(e) => setTestPrompt(e.target.value)}
                            placeholder="Nhập câu hỏi bạn muốn gửi xuống mô hình local của Seller..."
                            className="w-full bg-zinc-950 border border-border rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 transition resize-none placeholder-zinc-500 font-sans"
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                            <Bot className="w-3.5 h-3.5 text-zinc-500" />
                            <span>
                                Đích đến: <strong className="text-zinc-200 font-mono">{activeNodeName}</strong> (:11434)
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={handleRunTestLLM}
                            disabled={isTesting || !isDesktopConnected}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md ${
                                isTesting
                                    ? 'bg-indigo-600/50 text-indigo-200 cursor-not-allowed'
                                    : !isDesktopConnected
                                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                            }`}
                        >
                            {isTesting ? (
                                <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Đang Stream Tokens...</span>
                                </>
                            ) : (
                                <>
                                    <Send className="w-3.5 h-3.5" />
                                    <span>Bắn Lệnh Test LLM Stream</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Hộp hiển thị kết quả Streaming thời gian thực */}
                {(streamOutput || isTesting || testStats) && (
                    <div className="rounded-xl border border-border bg-zinc-950 p-4 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-border pb-2 text-xs">
                            <div className="flex items-center gap-2">
                                <span
                                    className={`w-2 h-2 rounded-full ${
                                        isTesting
                                            ? 'bg-amber-400 animate-ping'
                                            : testStats?.error
                                            ? 'bg-red-400'
                                            : 'bg-emerald-400'
                                    }`}
                                />
                                <span className="font-semibold text-white">
                                    {isTesting
                                        ? 'Đang nhận luồng token từ Worker...'
                                        : testStats?.error
                                        ? 'Lỗi kết nối Local Engine'
                                        : 'Hoàn tất phản hồi từ mô hình Seller'}
                                </span>
                            </div>

                            {testStats && !testStats.error && (
                                <div className="flex items-center gap-3 text-[11px] font-mono">
                                    <span className="text-zinc-400">
                                        Độ trễ: <strong className="text-emerald-400">{testStats.latencyMs}ms</strong>
                                    </span>
                                    <span className="text-zinc-400">
                                        Ước tính: <strong className="text-cyan-400">{testStats.tokensCount} tokens</strong>
                                    </span>
                                </div>
                            )}
                        </div>

                        {testStats?.error ? (
                            <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-lg text-xs text-red-300 space-y-1">
                                <div className="font-bold flex items-center gap-1.5">
                                    <span>Không thể kích hoạt suy luận từ máy Seller</span>
                                </div>
                                <p className="text-[11px] text-zinc-400">{testStats.error}</p>
                                <p className="text-[10px] text-zinc-500 pt-1 border-t border-red-500/20">
                                    Mẹo: Hãy đảm bảo bạn đã cài đặt Ollama trên máy tính và đã tải model bằng lệnh: <code className="text-zinc-200">ollama run {testModel}</code>
                                </p>
                            </div>
                        ) : (
                            <div className="font-mono text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto p-1 scrollbar-thin">
                                {streamOutput}
                                {isTesting && (
                                    <span className="inline-block w-1.5 h-3.5 bg-indigo-400 animate-pulse ml-0.5 align-middle" />
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 6. PHẦN MỀM CHẠY LOCAL LLM (OLLAMA / LM STUDIO) */}
            <div className="rounded-2xl border border-border bg-card/70 backdrop-blur-md p-5 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-3">
                    <div>
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <Terminal className="w-4 h-4 text-blue-400" />
                            <span>Engine Chạy Local LLM Kèm Theo Worker (Ollama / LM Studio)</span>
                        </h3>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                            Worker (.exe) sẽ tự động chuyển tiếp câu hỏi từ Agent vào Ollama trên máy bạn:
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <a
                        href="https://ollama.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-4 rounded-xl border border-border bg-zinc-950/70 hover:border-blue-500/50 hover:bg-zinc-900 transition-all group flex flex-col justify-between space-y-3 shadow-sm"
                    >
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <strong className="text-xs font-bold text-white group-hover:text-blue-400 transition">
                                        Ollama
                                    </strong>
                                    <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 font-mono font-semibold">
                                        Mặc định (:11434)
                                    </span>
                                </div>
                                <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-blue-400 transition shrink-0" />
                            </div>
                            <p className="text-[11px] text-zinc-400 leading-relaxed">
                                Chạy ngầm tại <code className="text-zinc-200 font-mono">http://localhost:11434</code>. Gõ <code className="text-blue-300 font-mono">ollama run qwen2.5-coder:1.5b</code> để Worker tự động nhận diện.
                            </p>
                        </div>
                        <div className="text-[11px] text-blue-400 font-semibold flex items-center gap-1">
                            <span>Tải từ ollama.com</span>
                            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                    </a>

                    <a
                        href="https://lmstudio.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-4 rounded-xl border border-border bg-zinc-950/70 hover:border-purple-500/50 hover:bg-zinc-900 transition-all group flex flex-col justify-between space-y-3 shadow-sm"
                    >
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <strong className="text-xs font-bold text-white group-hover:text-purple-400 transition">
                                        LM Studio
                                    </strong>
                                    <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 font-mono font-semibold">
                                        GUI (:1234)
                                    </span>
                                </div>
                                <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-purple-400 transition shrink-0" />
                            </div>
                            <p className="text-[11px] text-zinc-400 leading-relaxed">
                                Giao diện trực quan hỗ trợ GGUF và GPU offload.
                            </p>
                        </div>
                        <div className="text-[11px] text-purple-400 font-semibold flex items-center gap-1">
                            <span>Tải từ lmstudio.ai</span>
                            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                    </a>
                </div>
            </div>

            {/* 6. BANNER ĐỒNG BỘ SANG TRANG ĐỐI TÁC MÔ HÌNH (/user-models) */}
            <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                    <strong className="text-white block font-semibold">
                        {isDesktopConnected
                            ? `Đang có ${onlineNodes.length} máy trạm trực tuyến trên Cụm 3D Đối Tác Mô Hình`
                            : 'Chưa có máy trạm nào trong Cụm 3D (Đang chờ Electron Worker kết nối)'}
                    </strong>
                    <span className="text-zinc-400 text-[11px] block">
                        Trang Kiểm tra Node AI và trang Đối tác Mô hình dùng chung một luồng WebSocket thời gian thực.
                    </span>
                </div>
                <Link
                    href="/user-models"
                    className="shrink-0 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-md shadow-blue-600/20 inline-flex items-center gap-1.5 self-start sm:self-auto"
                >
                    <span>Mở Trang Đối Tác Mô Hình</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                </Link>
            </div>

                </div>
            </div>

            {/* Modal Onboarding Đối Tác Mô Hình */}
            <PartnerOnboardingModal
                isOpen={isOnboardingModalOpen}
                onClose={() => setIsOnboardingModalOpen(false)}
                currentUser={{
                    id: profile?.id,
                    username: profile?.name,
                    email: profile?.email,
                }}
                onPartnerRegistered={(node) => {
                    upsertRegisteredNode(node)
                    setIsOnboardingModalOpen(false)
                    notify.success(
                        'Đã lưu cấu hình! Hãy mở ứng dụng Go-Python Worker (.exe) trên máy để chính thức kết nối vào mạng lưới.'
                    )
                }}
            />
        </div>
    )
}
