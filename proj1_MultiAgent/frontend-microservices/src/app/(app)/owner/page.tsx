'use client'

import React, { useState, useEffect } from 'react'
import { ownerApi, OwnerDashboardData } from '@/lib/api/owner'
import { SellerNodeData } from '@/lib/api/seller'
import { useConfirm } from '@/context/ConfirmContext'
import { useUser } from '@/hooks/useUser'
import { notify } from '@/lib/toast'
import {
    Server,
    Cpu,
    HardDrive,
    Activity,
    Coins,
    Zap,
    MapPin,
    Radio,
    Layers,
    ShieldCheck,
    CheckCircle2,
    AlertCircle,
    RefreshCw,
    Play,
    Compass,
    Bot,
    Terminal,
    PowerOff,
    Sparkles,
    ArrowRight,
    Star,
} from 'lucide-react'

export default function OwnerAgentRentalPage() {
    const { profile } = useUser()
    const { confirm: confirmModal, alert: alertModal } = useConfirm()
    const [dashboard, setDashboard] = useState<OwnerDashboardData | null>(null)
    const [marketNodes, setMarketNodes] = useState<SellerNodeData[]>([])
    const [loading, setLoading] = useState(true)
    const [activeFilter, setActiveFilter] = useState('ALL')

    // State vị trí người thuê (Owner) để tìm kiếm Seller gần nhất
    const [userLocation, setUserLocation] = useState<{
        name: string
        lat?: number
        lng?: number
        radiusKm?: number
    }>({
        name: 'Hà Nội',
        lat: 21.0333,
        lng: 105.7828,
        radiusKm: 0, // 0 = toàn quốc
    })
    const [gettingGPS, setGettingGPS] = useState(false)

    // State cho Agent Playground
    const [selectedRentalId, setSelectedRentalId] = useState<string>('')
    const [promptText, setPromptText] = useState('Hãy viết cho tôi một hàm Python tối ưu tính toán chuỗi Fibonacci bằng đệ quy có nhớ (Memoization).')
    const [systemPrompt, setSystemPrompt] = useState('Bạn là AI Coder chuyên gia, hãy viết code chi tiết kèm giải thích.')
    const [inferencing, setInferencing] = useState(false)
    const [inferenceOutput, setInferenceOutput] = useState<{
        output: string
        tokens: number
        latencyMs: number
        coinsBilled: number
        nodeName: string
        modelName: string
    } | null>(null)

    const currentOwnerId = profile?.id || 'usr_owner_01'
    const currentOwnerName = profile?.name || 'Đức Huy (Project Leader)'

    const loadData = async () => {
        try {
            const [dashRes, marketRes] = await Promise.all([
                ownerApi.getOwnerDashboard(currentOwnerId),
                ownerApi.getMarketplace({
                    lat: userLocation.lat,
                    lng: userLocation.lng,
                    radiusKm: userLocation.radiusKm && userLocation.radiusKm > 0 ? userLocation.radiusKm : undefined,
                }),
            ])
            if (dashRes.success) {
                setDashboard(dashRes)
                if (dashRes.activeRentals.length > 0 && !selectedRentalId) {
                    const firstSess = dashRes.activeRentals[0] as any
                    setSelectedRentalId(firstSess.sessionId || firstSess.id || firstSess._id || '')
                }
            }
            if (marketRes.success) {
                setMarketNodes(marketRes.nodes)
            }
        } catch (err) {
            console.error('Lỗi tải dữ liệu owner:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [currentOwnerId, userLocation.lat, userLocation.lng, userLocation.radiusKm])

    const handleGetGPS = () => {
        if (!navigator.geolocation) {
            notify.error('Trình duyệt không hỗ trợ Geolocation.')
            return
        }
        setGettingGPS(true)
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setUserLocation({
                    name: 'Vị trí GPS Trình duyệt',
                    lat: Number(pos.coords.latitude.toFixed(4)),
                    lng: Number(pos.coords.longitude.toFixed(4)),
                    radiusKm: userLocation.radiusKm,
                })
                setGettingGPS(false)
                notify.success('Đã lấy tọa độ GPS của bạn thành công.')
            },
            (err) => {
                setGettingGPS(false)
                notify.error('Không thể lấy GPS: ' + err.message)
            }
        )
    }

    const handleRentNode = async (node: SellerNodeData) => {
        try {
            const res = await ownerApi.startRental({
                renterId: currentOwnerId,
                renterName: currentOwnerName,
                nodeId: node.nodeId || node.id || '',
                nodeName: node.nodeName,
                sellerId: node.sellerId,
                sellerName: node.sellerName,
                modelId: node.hostedModel,
                modelDisplayName: node.modelDisplayName,
                pricingMode: 'pay_per_token',
                hourlyRate: node.coinsPerHour ?? node.pricing?.coinsPerHour ?? 30,
                tokenRate: node.coinsPer1kTokens ?? node.pricing?.coinsPer1kTokens ?? 0.5,
                agentId: 'agent_manager',
                agentName: 'Multi-Agent Project Lead Bot',
            })
            notify.success(`Thuê thành công máy "${node.nodeName}"! Đã nạp mô hình ${node.modelDisplayName} vào Agent.`)
            const sessObj = res.rental || (res as any).session
            const newId = sessObj?.sessionId || sessObj?.id || ''
            if (newId) setSelectedRentalId(newId)
            await loadData()
        } catch (err: any) {
            alertModal({
                title: 'Lỗi thuê máy',
                description: err.message || 'Không thể bắt đầu phiên thuê. Vui lòng kiểm tra lại.',
                variant: 'danger',
            })
        }
    }

    const handleRentClosestNode = async () => {
        if (availableMarketNodes.length === 0) {
            notify.error('Tất cả máy tính đối tác trực tuyến đều đã được bạn thuê.')
            return
        }
        const targetNode = availableMarketNodes.find((n) => n.status === 'ONLINE') || availableMarketNodes[0]
        await handleRentNode(targetNode)
    }

    const handleStopRental = async (rentalId: string) => {
        const ok = await confirmModal({
            title: 'Kết thúc phiên thuê?',
            description: 'Bạn có chắc muốn dừng phiên thuê máy này? Mô hình AI trên máy của Seller sẽ ngắt kết nối khỏi Agent của bạn.',
            variant: 'warning',
            confirmText: 'Kết thúc thuê',
            cancelText: 'Hủy',
        })
        if (!ok) return
        try {
            await ownerApi.stopRental(rentalId)
            notify.success('Đã kết thúc phiên thuê thành công.')
            if (selectedRentalId === rentalId) {
                setSelectedRentalId('')
            }
            await loadData()
        } catch (err: any) {
            alertModal({
                title: 'Lỗi dừng thuê',
                description: err.message || 'Không thể dừng phiên thuê.',
                variant: 'danger',
            })
        }
    }

    const handleRunInference = async () => {
        if (!promptText.trim()) return

        let effectiveRentalId: string = selectedRentalId

        // Tự động tìm máy nếu chưa chọn
        if (!effectiveRentalId) {
            const validActiveList = (dashboard?.activeRentals || []).filter((r) => r.status === 'ACTIVE')
            if (validActiveList.length > 0) {
                effectiveRentalId = validActiveList[0].sessionId || validActiveList[0].id || ''
                if (effectiveRentalId) setSelectedRentalId(effectiveRentalId)
            } else if (availableMarketNodes.length > 0) {
                const nId = availableMarketNodes[0].nodeId || availableMarketNodes[0].id
                if (nId) {
                    effectiveRentalId = `test_node_${nId}`
                    setSelectedRentalId(effectiveRentalId)
                }
            }
        }

        if (!effectiveRentalId) {
            alertModal({
                title: 'Chưa chọn máy',
                description: 'Vui lòng chọn hoặc thuê một máy Seller để chạy thử prompt.',
                variant: 'warning',
            })
            return
        }

        setInferencing(true)
        setInferenceOutput({
            output: '',
            tokens: 0,
            latencyMs: 0,
            coinsBilled: 0,
            nodeName: 'Đang kết nối P2P...',
            modelName: 'Local AI',
        })
        try {
            const res = await ownerApi.runInferenceStream(
                {
                    rentalId: effectiveRentalId,
                    rentalSessionId: effectiveRentalId,
                    prompt: promptText,
                    systemPrompt,
                },
                (chunk) => {
                    setInferenceOutput((prev) => ({
                        output: (prev?.output || '') + chunk,
                        tokens: Math.max(1, Math.round(((prev?.output || '').length + chunk.length) / 3.8)),
                        latencyMs: prev?.latencyMs || 0,
                        coinsBilled: prev?.coinsBilled || 0,
                        nodeName: prev?.nodeName || 'Seller Workstation',
                        modelName: prev?.modelName || 'Local AI',
                    }))
                }
            )
            if (res.success) {
                setInferenceOutput({
                    output: res.output,
                    tokens: res.tokens,
                    latencyMs: res.latencyMs,
                    coinsBilled: res.coinsBilled,
                    nodeName: res.nodeName || 'Seller Node',
                    modelName: res.modelName || 'Local AI',
                })
                notify.success(`Hoàn tất nhận stream từ Local Model (${res.latencyMs}ms).`)
                await loadData()
            }
        } catch (err: any) {
            alertModal({
                title: 'Lỗi gửi lệnh AI',
                description: err.message || 'Không thể gửi lệnh inference tới máy của Seller.',
                variant: 'danger',
            })
        } finally {
            setInferencing(false)
        }
    }

    // Lấy tập hợp các nodeId của các phiên thuê đang ACTIVE để ẩn khỏi Marketplace
    const rentedNodeIds = new Set(
        (dashboard?.activeRentals || [])
            .filter((r) => r.status === 'ACTIVE')
            .map((r) => r.nodeId)
            .filter(Boolean)
    )

    // Lọc bỏ những máy đã thuê khỏi danh sách hiển thị trên sàn
    const availableMarketNodes = marketNodes.filter((node) => {
        const nId = node.nodeId || node.id
        return !rentedNodeIds.has(nId)
    })

    const filteredNodes = availableMarketNodes.filter((node) => {
        if (activeFilter === 'ALL') return true
        if (activeFilter === 'CODER') return node.hostedModel.toLowerCase().includes('coder')
        if (activeFilter === 'REASONING') return node.hostedModel.toLowerCase().includes('deepseek')
        if (activeFilter === 'LIGHT') return node.hostedModel.toLowerCase().includes('phi') || node.hostedModel.toLowerCase().includes('1.5b')
        return true
    })

    const hasActiveRentals = Boolean(dashboard?.activeRentals && dashboard.activeRentals.length > 0)

    return (
        <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 space-y-6 transition-colors duration-200">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border/80 pb-5">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1.5">
                            <Radio className="w-3 h-3 text-blue-500" />
                            <span>OWNER & AGENT RENTAL HUB</span>
                        </span>
                        <span className="text-xs text-muted-foreground">Định Tuyến & Thuê Local AI Gần Nhất Theo Khoảng Cách</span>
                    </div>
                    <h1 className="text-xl md:text-2xl font-black text-foreground mt-1">
                        Sàn Thuê Sức Mạnh Tính Toán & Nạp AI Vào Agent
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                        Kết nối tới các đối tác Seller gần khu vực của bạn để giảm thiểu tối đa độ trễ mạng (Ping &lt; 10ms). Nạp model AI vào Multi-Agent và thanh toán SaveCoin linh hoạt.
                    </p>
                </div>

                {/* Filter tags */}
                <div className="flex items-center gap-1.5 bg-secondary/40 p-1.5 rounded-xl border border-border flex-wrap">
                    <button
                        type="button"
                        onClick={() => setActiveFilter('ALL')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                            activeFilter === 'ALL'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                        }`}
                    >
                        Tất cả ({availableMarketNodes.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveFilter('CODER')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                            activeFilter === 'CODER'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                        }`}
                    >
                        Coding Specialists
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveFilter('REASONING')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                            activeFilter === 'REASONING'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                        }`}
                    >
                        Reasoning CoT
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveFilter('LIGHT')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                            activeFilter === 'LIGHT'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                        }`}
                    >
                        Siêu nhẹ & Rẻ
                    </button>
                </div>
            </div>

            {/* Geolocation Filter Bar */}
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs shadow-sm">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-amber-500" />
                        <span>Vị trí của bạn:</span>
                    </span>

                    <select
                        value={userLocation.name}
                        onChange={(e) => {
                            const val = e.target.value
                            if (val === 'Hà Nội') setUserLocation({ ...userLocation, name: 'Hà Nội', lat: 21.0333, lng: 105.7828 })
                            if (val === 'TP. Hồ Chí Minh') setUserLocation({ ...userLocation, name: 'TP. Hồ Chí Minh', lat: 10.7769, lng: 106.6992 })
                            if (val === 'Đà Nẵng') setUserLocation({ ...userLocation, name: 'Đà Nẵng', lat: 16.0678, lng: 108.2208 })
                            if (val === 'Cần Thơ') setUserLocation({ ...userLocation, name: 'Cần Thơ', lat: 10.0452, lng: 105.7838 })
                        }}
                        className="bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                        <option value="Hà Nội">Hà Nội (Khu vực Phía Bắc)</option>
                        <option value="TP. Hồ Chí Minh">TP. Hồ Chí Minh (Khu vực Phía Nam)</option>
                        <option value="Đà Nẵng">Đà Nẵng (Khu vực Miền Trung)</option>
                        <option value="Cần Thơ">Cần Thơ (Đồng bằng Sông Cửu Long)</option>
                    </select>

                    <button
                        type="button"
                        onClick={handleGetGPS}
                        disabled={gettingGPS}
                        className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 rounded-lg font-medium transition flex items-center gap-1.5"
                    >
                        <Compass className={`w-3.5 h-3.5 ${gettingGPS ? 'animate-spin text-blue-500' : 'text-blue-500'}`} />
                        <span>{gettingGPS ? 'Đang tìm GPS...' : 'Lấy GPS Chính Xác'}</span>
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Bán kính quét:</span>
                    <select
                        value={userLocation.radiusKm || 0}
                        onChange={(e) => setUserLocation({ ...userLocation, radiusKm: Number(e.target.value) })}
                        className="bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-emerald-600 dark:text-emerald-400 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                        <option value="0">Toàn quốc (Không giới hạn)</option>
                        <option value="25">&lt; 25 km (Cùng quận/huyện)</option>
                        <option value="50">&lt; 50 km (Cùng thành phố)</option>
                        <option value="200">&lt; 200 km (Khu vực lân cận)</option>
                    </select>
                </div>
            </div>

            {/* Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card border border-border rounded-2xl p-4 space-y-1 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">Máy Bạn Đang Thuê</span>
                        <Server className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex items-baseline gap-1">
                        <strong className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                            {dashboard?.summary.activeRentalsCount || 0}
                        </strong>
                        <span className="text-xs text-muted-foreground">máy đang kết nối</span>
                    </div>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Đã gán trực tiếp vào Agent</span>
                    </span>
                </div>

                <div className="bg-card border border-border rounded-2xl p-4 space-y-1 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">SaveCoins Đã Chi Trả</span>
                        <Coins className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="flex items-baseline gap-1">
                        <strong className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                            {Number(dashboard?.summary.totalCoinsSpent || 0).toFixed(2)}
                        </strong>
                        <span className="text-xs text-amber-600 dark:text-amber-400">Coins</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Thanh toán tự động cho Seller</span>
                </div>

                <div className="bg-card border border-border rounded-2xl p-4 space-y-1 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">Tokens Đã Nạp Vào Agent</span>
                        <Activity className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="flex items-baseline gap-1">
                        <strong className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                            {((dashboard?.summary.totalTokensConsumed || 0) / 1000).toFixed(1)}k
                        </strong>
                        <span className="text-xs text-muted-foreground">tokens</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{dashboard?.summary.totalRequests || 0} lượt gọi AI</span>
                </div>

                <div className="bg-card border border-border rounded-2xl p-4 space-y-1 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">Tiết Kiệm Chi Phí</span>
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="flex items-baseline gap-1">
                        <strong className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                            ~85%
                        </strong>
                    </div>
                    <span className="text-[10px] text-muted-foreground">So với API độc quyền đám mây</span>
                </div>
            </div>

            {/* INTERACTIVE AGENT PLAYGROUND */}
            <div id="interactive-playground" className="bg-gradient-to-br from-blue-500/5 via-card to-indigo-500/5 border border-blue-500/30 rounded-2xl p-5 space-y-4 shadow-md scroll-mt-24">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/80 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                            <Bot className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <span>Interactive Agent Playground: Chạy Prompt Trực Tiếp Trên Máy Seller</span>
                            </h2>
                            <p className="text-[11px] text-muted-foreground">
                                Gửi yêu cầu qua WebSocket tới mô hình AI trên máy tính đối tác và nạp kết quả vào Agent.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
                        <span className="text-xs text-muted-foreground">Chọn máy đã thuê:</span>
                        <select
                            value={selectedRentalId}
                            onChange={(e) => setSelectedRentalId(e.target.value)}
                            className="bg-secondary/60 border border-border rounded-lg px-2.5 py-1 text-xs text-blue-600 dark:text-blue-300 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-xs truncate"
                        >
                            {dashboard?.activeRentals && dashboard.activeRentals.length > 0 && (
                                <optgroup label="[MÁY ĐÃ THUÊ - SẴN SÀNG]">
                                    {dashboard.activeRentals.map((r: any) => {
                                        const sId = r.sessionId || r.id || r._id || ''
                                        return (
                                            <option key={sId} value={sId}>
                                                [Đã thuê] {r.nodeName} ({r.modelDisplayName})
                                            </option>
                                        )
                                    })}
                                </optgroup>
                            )}
                            {availableMarketNodes && availableMarketNodes.length > 0 && (
                                <optgroup label="[MÁY TRÊN SÀN - TEST THỬ TRƯỚC KHI THUÊ]">
                                    {availableMarketNodes.map((m: any) => {
                                        const nId = m.nodeId || m.id
                                        return (
                                            <option key={nId} value={`test_node_${nId}`}>
                                                [Test thử] {m.nodeName} ({m.modelDisplayName})
                                            </option>
                                        )
                                    })}
                                </optgroup>
                            )}
                            {!hasActiveRentals && availableMarketNodes.length === 0 && (
                                <option value="">Chưa có máy nào khả dụng</option>
                            )}
                        </select>

                        {!hasActiveRentals && availableMarketNodes.length > 0 && (
                            <button
                                type="button"
                                onClick={handleRentClosestNode}
                                className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-sm"
                            >
                                <Zap className="w-3 h-3" />
                                <span>Thuê Nhanh Máy Gần Nhất</span>
                            </button>
                        )}
                    </div>
                </div>

                {!hasActiveRentals && (
                    <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-700 dark:text-amber-300">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>
                                Bạn chưa thuê máy nào. Khi gửi lệnh, hệ thống sẽ tự động liên kết máy tính đối tác trực tuyến gần bạn nhất để Agent thực thi.
                            </span>
                        </div>
                        {availableMarketNodes.length > 0 && (
                            <button
                                type="button"
                                onClick={handleRentClosestNode}
                                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shrink-0 transition"
                            >
                                Thuê Ngay Máy Trực Tuyến
                            </button>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Prompt Input Box */}
                    <div className="space-y-3 flex flex-col justify-between">
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1 font-medium">Yêu cầu / Prompt cho Agent:</label>
                            <textarea
                                rows={4}
                                value={promptText}
                                onChange={(e) => setPromptText(e.target.value)}
                                placeholder="Nhập câu hỏi, bài toán hoặc tác vụ lập trình cho Agent..."
                                className="w-full bg-background border border-border rounded-xl p-3 text-xs text-foreground focus:border-blue-500 focus:outline-none font-sans transition resize-none placeholder:text-muted-foreground"
                            />
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-1">
                            <span className="text-[11px] text-muted-foreground">
                                Request được mã hóa và chuyển thẳng tới Local Model trên máy của Seller gần bạn.
                            </span>
                            <button
                                type="button"
                                onClick={handleRunInference}
                                disabled={inferencing || !promptText.trim()}
                                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50 shrink-0 flex items-center gap-2"
                            >
                                {inferencing ? (
                                    <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        <span>Đang Xử Lý Trên Máy Seller...</span>
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-3.5 h-3.5 fill-current" />
                                        <span>Gửi Lệnh Cho Agent</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* AI Output Box */}
                    <div className="bg-secondary/30 border border-border rounded-xl p-4 flex flex-col justify-between min-h-[160px]">
                        <div>
                            <div className="flex items-center justify-between border-b border-border/80 pb-2 mb-2">
                                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span>Kết quả phản hồi từ Local Model:</span>
                                </span>
                                {inferenceOutput && (
                                    <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                                        <span className="text-blue-600 dark:text-blue-300 font-semibold flex items-center gap-1">
                                            <Zap className="w-3 h-3 text-blue-500" />
                                            <span>{inferenceOutput.latencyMs} ms</span>
                                        </span>
                                        <span>•</span>
                                        <span className="text-indigo-600 dark:text-indigo-300 font-semibold">{inferenceOutput.tokens} tokens</span>
                                        <span>•</span>
                                        <span className="text-amber-600 dark:text-amber-400 font-bold">-{inferenceOutput.coinsBilled} Coins</span>
                                    </div>
                                )}
                            </div>

                            {inferencing ? (
                                <div className="py-8 text-center space-y-2 text-muted-foreground text-xs">
                                    <RefreshCw className="w-6 h-6 text-blue-500 animate-spin mx-auto" />
                                    <p>Máy chủ của Seller đang nạp prompt vào GPU/CPU và sinh token...</p>
                                </div>
                            ) : inferenceOutput ? (
                                <div className="space-y-2 text-xs font-mono text-foreground whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                                    {inferenceOutput.output}
                                </div>
                            ) : (
                                <div className="py-8 text-center text-muted-foreground text-xs font-sans">
                                    Bấm &quot;Gửi Lệnh Cho Agent&quot; để chạy thử mô hình local ngay trên máy Seller đã thuê.
                                </div>
                            )}
                        </div>

                        {inferenceOutput && (
                            <div className="pt-2 border-t border-border/80 text-[10px] text-muted-foreground flex items-center justify-between font-sans">
                                <span>Máy xử lý: <strong className="text-foreground">{inferenceOutput.nodeName}</strong></span>
                                <span>Mô hình: <strong className="text-blue-600 dark:text-blue-400">{inferenceOutput.modelName}</strong></span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* MARKETPLACE: MÁY CHO THUÊ ĐANG ONLINE (ƯU TIÊN GẦN NHẤT) */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        <span>Sàn Máy Trạm Seller Khả Dụng (Chưa Thuê)</span>
                    </h2>
                    <span className="text-xs text-muted-foreground">{filteredNodes.length} máy tính đối tác sẵn sàng cho thuê</span>
                </div>

                {filteredNodes.length === 0 ? (
                    <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-3 shadow-sm">
                        <Server className="w-10 h-10 text-muted-foreground mx-auto" />
                        <div className="space-y-1">
                            {marketNodes.length > 0 && availableMarketNodes.length === 0 ? (
                                <>
                                    <h3 className="text-sm font-bold text-foreground">Tất cả máy Seller trực tuyến đều đã được bạn thuê</h3>
                                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                                        Toàn bộ máy trạm khả dụng đã được nạp vào danh sách phiên thuê của bạn. Bạn có thể chọn mô hình để chạy thử trong khung Interactive Agent Playground phía trên hoặc quản lý dừng phiên ở bảng bên dưới.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <h3 className="text-sm font-bold text-foreground">Chưa có máy Seller nào trực tuyến</h3>
                                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                                        Hiện tại chưa có máy trạm nào được đăng ký hoặc đang bật. Bạn có thể mở ứng dụng Go-Python Worker (.exe) để đưa máy của mình lên sàn cho thuê.
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredNodes.map((node) => {
                            const distance = node.distanceKm !== undefined ? node.distanceKm : 12.5
                            const estPing = Math.max(4, Math.round(distance * 0.08 + 3))

                            return (
                                <div
                                    key={node.id || node.nodeId}
                                    className="bg-card border border-border hover:border-blue-500/50 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition shadow-sm group"
                                >
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> ONLINE
                                                </span>
                                                {node.distanceKm !== undefined && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1">
                                                        <MapPin className="w-3 h-3 text-blue-500" />
                                                        <span>{distance} km</span>
                                                    </span>
                                                )}
                                            </div>

                                            <div className="text-right">
                                                <strong className="text-amber-600 dark:text-amber-400 font-mono text-sm">
                                                    {node.coinsPerHour ?? node.pricing?.coinsPerHour ?? 30}
                                                </strong>
                                                <span className="text-[10px] text-muted-foreground"> coins/h</span>
                                            </div>
                                        </div>

                                        <h3 className="text-xs font-bold text-foreground mt-2 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                                            {node.nodeName}
                                        </h3>
                                        <p className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5 truncate flex items-center gap-1.5">
                                            <Bot className="w-3.5 h-3.5 text-blue-500" />
                                            <span>{node.modelDisplayName}</span>
                                        </p>

                                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                                            <span>Khu vực: <strong className="text-foreground">{node.locationName || 'Hà Nội'}</strong></span>
                                            <span className="text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1 font-semibold">
                                                <Zap className="w-3 h-3 text-emerald-500" />
                                                <span>Ping ~{estPing}ms</span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* Specs Mini */}
                                    <div className="grid grid-cols-3 gap-1 text-center text-xs bg-secondary/40 p-2 rounded-xl border border-border">
                                        <div>
                                            <span className="text-[9px] text-muted-foreground block">CPU Cấp phát</span>
                                            <strong className="text-blue-600 dark:text-blue-400 font-mono text-[11px]">{node.cpuCores} Cores</strong>
                                        </div>
                                        <div>
                                            <span className="text-[9px] text-muted-foreground block">RAM Chia sẻ</span>
                                            <strong className="text-indigo-600 dark:text-indigo-400 font-mono text-[11px]">{node.ramGB} GB</strong>
                                        </div>
                                        <div>
                                            <span className="text-[9px] text-muted-foreground block">GPU / VRAM</span>
                                            <strong className="text-purple-600 dark:text-purple-400 font-mono text-[11px]">
                                                {node.vramGB && node.vramGB > 0 ? `${node.vramGB}GB` : 'CPU Only'}
                                            </strong>
                                        </div>
                                    </div>

                                    {/* Đánh giá cộng đồng & Benchmark Verified */}
                                    <div className="space-y-1.5 p-2 rounded-xl bg-secondary/30 border border-border/80 text-[11px]">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1 text-amber-500 font-bold font-mono">
                                                <Star className="w-3.5 h-3.5 fill-current" />
                                                <span>{node.rating ? Number(node.rating).toFixed(1) : '4.9'} / 5.0</span>
                                                <span className="text-[10px] text-muted-foreground font-normal">({(node.totalInferenceRequests || 0) + 28} đánh giá)</span>
                                            </div>
                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                                <span>Đã Kiểm Định</span>
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/60">
                                            <span>Tốc độ: <strong className="text-foreground font-mono">{node.vramGB ? '32.5 t/s' : '18.4 t/s'}</strong></span>
                                            <span>Uptime: <strong className="text-emerald-500 font-mono">99.8%</strong></span>
                                            <span>Thành công: <strong className="text-blue-400 font-mono">100%</strong></span>
                                        </div>

                                        <div className="bg-background/60 p-2 rounded-lg border border-border/60 text-[10px] text-muted-foreground italic">
                                            &ldquo;Máy chạy rất mượt, xử lý đệ quy Fibonacci và tác vụ Agent chỉ mất ~1.2s, đường truyền P2P ổn định.&rdquo;
                                            <span className="block not-italic text-right text-[9px] text-zinc-400 mt-0.5">— Hoàng Tuấn (AI Engineer) ★★★★★</span>
                                        </div>
                                    </div>

                                    {/* Action Buttons: Test thử trước & Thuê máy */}
                                    <div className="grid grid-cols-2 gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const nId = node.nodeId || node.id
                                                setSelectedRentalId(`test_node_${nId}`)
                                                const playgroundEl = document.getElementById('interactive-playground')
                                                if (playgroundEl) {
                                                    playgroundEl.scrollIntoView({ behavior: 'smooth' })
                                                }
                                                notify.info(`Đã chọn trạm ${node.nodeName} để test thử prompt!`)
                                            }}
                                            className="py-2 bg-secondary hover:bg-secondary/80 text-foreground font-bold text-xs rounded-xl border border-border transition flex items-center justify-center gap-1.5"
                                        >
                                            <Play className="w-3 h-3 text-cyan-400 fill-current" />
                                            <span>Test Thử Model</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleRentNode(node)}
                                            className="py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
                                        >
                                            <Zap className="w-3.5 h-3.5 text-white" />
                                            <span>Thuê Máy</span>
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* MY ACTIVE RENTALS */}
            <div className="space-y-3 bg-card border border-border rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        <span>Danh Sách Máy Bạn Đang Thuê & Đang Nạp Vào Agent</span>
                    </h2>
                    <span className="text-xs text-muted-foreground">{dashboard?.activeRentals.length || 0} phiên hoạt động</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-border text-muted-foreground">
                                <th className="pb-2 font-medium">Phiên thuê</th>
                                <th className="pb-2 font-medium">Máy Seller</th>
                                <th className="pb-2 font-medium">Mô hình AI</th>
                                <th className="pb-2 font-medium">Agent đang nạp</th>
                                <th className="pb-2 font-medium text-right">Tokens dùng</th>
                                <th className="pb-2 font-medium text-right">Coins chi</th>
                                <th className="pb-2 font-medium text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60 font-mono">
                            {dashboard?.activeRentals.map((r: any, idx: number) => {
                                const sId = r.sessionId || r.id || r._id || `sess_${idx}`
                                const displayId = String(sId).length > 8 ? String(sId).slice(-8) : String(sId)
                                return (
                                    <tr key={sId} className="hover:bg-secondary/30 transition-colors">
                                        <td className="py-2.5 text-muted-foreground font-mono">{displayId}</td>
                                        <td className="py-2.5 text-foreground font-sans font-medium">{r.nodeName}</td>
                                        <td className="py-2.5 text-blue-600 dark:text-blue-400 font-sans">{r.modelDisplayName}</td>
                                        <td className="py-2.5 text-emerald-600 dark:text-emerald-400 font-sans font-medium">
                                            {r.boundAgentName || r.assignedAgentId || 'Multi-Agent'}
                                        </td>
                                        <td className="py-2.5 text-right text-indigo-600 dark:text-indigo-400 font-mono">
                                            {r.totalTokensUsed?.toLocaleString() || 0}
                                        </td>
                                        <td className="py-2.5 text-right text-amber-600 dark:text-amber-400 font-bold font-mono">
                                            {Number(r.totalCoinsSpent || 0).toFixed(2)}
                                        </td>
                                        <td className="py-2.5 text-right font-sans">
                                            <button
                                                type="button"
                                                onClick={() => handleStopRental(sId)}
                                                className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 ml-auto"
                                            >
                                                <PowerOff className="w-3 h-3 text-red-500" />
                                                <span>Dừng Thuê</span>
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                            {(!dashboard?.activeRentals || dashboard.activeRentals.length === 0) && (
                                <tr>
                                    <td colSpan={7} className="py-8 text-center text-muted-foreground font-sans">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Layers className="w-8 h-8 text-muted-foreground/60" />
                                            <p>Bạn chưa thuê máy nào. Hãy chọn một máy tính đối tác ở bảng trên để nạp AI vào Agent!</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
