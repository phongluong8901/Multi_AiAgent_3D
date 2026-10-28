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
        const interval = setInterval(loadData, 8000)
        return () => clearInterval(interval)
    }, [userLocation.lat, userLocation.lng, userLocation.radiusKm])

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
        setInferencing(true)
        setInferenceOutput(null)
        try {
            const res = await ownerApi.runInference({
                rentalId: selectedRentalId || undefined,
                prompt: promptText,
                systemPrompt,
            })
            if (res.success) {
                setInferenceOutput({
                    output: res.output,
                    tokens: res.tokens,
                    latencyMs: res.latencyMs,
                    coinsBilled: res.coinsBilled,
                    nodeName: res.nodeName || res.rentalSession?.nodeName || 'Seller Node',
                    modelName: res.modelName || res.rentalSession?.modelName || 'Local AI',
                })
                notify.success('Nhận phản hồi từ Local Model thành công.')
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

    const filteredNodes = marketNodes.filter((node) => {
        if (activeFilter === 'ALL') return true
        if (activeFilter === 'CODER') return node.hostedModel.includes('coder')
        if (activeFilter === 'REASONING') return node.hostedModel.includes('deepseek')
        if (activeFilter === 'LIGHT') return node.hostedModel.includes('phi') || node.hostedModel.includes('1.5b')
        return true
    })

    return (
        <div className="min-h-screen bg-zinc-950 text-white p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1.5">
                            <Radio className="w-3 h-3 text-blue-400" />
                            <span>OWNER & AGENT RENTAL HUB</span>
                        </span>
                        <span className="text-xs text-zinc-500">Định Tuyến & Thuê Local AI Gần Nhất Theo Khoảng Cách</span>
                    </div>
                    <h1 className="text-xl md:text-2xl font-black text-white mt-1">
                        Sàn Thuê Sức Mạnh Tính Toán & Nạp AI Vào Agent
                    </h1>
                    <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
                        Kết nối tới các đối tác Seller gần khu vực của bạn để giảm thiểu tối đa độ trễ mạng (Ping &lt; 10ms). Nạp model AI vào Multi-Agent và trả SaveCoin linh hoạt.
                    </p>
                </div>

                {/* Filter tags */}
                <div className="flex items-center gap-2 bg-zinc-900/60 p-1.5 rounded-xl border border-zinc-800 flex-wrap">
                    <button
                        onClick={() => setActiveFilter('ALL')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${activeFilter === 'ALL' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                    >
                        Tất cả ({marketNodes.length})
                    </button>
                    <button
                        onClick={() => setActiveFilter('CODER')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${activeFilter === 'CODER' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                    >
                        Coding Specialists
                    </button>
                    <button
                        onClick={() => setActiveFilter('REASONING')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${activeFilter === 'REASONING' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                    >
                        Reasoning CoT
                    </button>
                    <button
                        onClick={() => setActiveFilter('LIGHT')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${activeFilter === 'LIGHT' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                    >
                        Siêu nhẹ & Rẻ
                    </button>
                </div>
            </div>

            {/* Geolocation Filter Bar */}
            <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-amber-400" />
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
                        className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-white font-medium"
                    >
                        <option value="Hà Nội">Hà Nội (Khu vực Phía Bắc)</option>
                        <option value="TP. Hồ Chí Minh">TP. Hồ Chí Minh (Khu vực Phía Nam)</option>
                        <option value="Đà Nẵng">Đà Nẵng (Khu vực Miền Trung)</option>
                        <option value="Cần Thơ">Cần Thơ (Đồng bằng Sông Cửu Long)</option>
                    </select>

                    <button
                        onClick={handleGetGPS}
                        disabled={gettingGPS}
                        className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-300 border border-blue-500/30 rounded-lg font-medium transition flex items-center gap-1.5"
                    >
                        <Compass className={`w-3.5 h-3.5 ${gettingGPS ? 'animate-spin text-blue-400' : 'text-blue-400'}`} />
                        <span>{gettingGPS ? 'Đang tìm GPS...' : 'Lấy GPS Chính Xác'}</span>
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-zinc-400">Bán kính quét:</span>
                    <select
                        value={userLocation.radiusKm || 0}
                        onChange={(e) => setUserLocation({ ...userLocation, radiusKm: Number(e.target.value) })}
                        className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-emerald-400 font-bold"
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
                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4 space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-400">Máy Bạn Đang Thuê</span>
                        <Server className="w-4 h-4 text-blue-400/80" />
                    </div>
                    <div className="flex items-baseline gap-1">
                        <strong className="text-2xl font-black text-blue-400 font-mono">
                            {dashboard?.summary.activeRentalsCount || 0}
                        </strong>
                        <span className="text-xs text-zinc-500">máy đang kết nối</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Đã gán trực tiếp vào Agent</span>
                    </span>
                </div>

                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4 space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-400">SaveCoins Đã Chi Trả</span>
                        <Coins className="w-4 h-4 text-amber-400/80" />
                    </div>
                    <div className="flex items-baseline gap-1">
                        <strong className="text-2xl font-black text-amber-400 font-mono">
                            {dashboard?.summary.totalCoinsSpent || 0}
                        </strong>
                        <span className="text-xs text-amber-400/80">Coins</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">Thanh toán tự động cho Seller</span>
                </div>

                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4 space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-400">Tokens Đã Nạp Vào Agent</span>
                        <Activity className="w-4 h-4 text-indigo-400/80" />
                    </div>
                    <div className="flex items-baseline gap-1">
                        <strong className="text-2xl font-black text-indigo-400 font-mono">
                            {((dashboard?.summary.totalTokensConsumed || 0) / 1000).toFixed(1)}k
                        </strong>
                        <span className="text-xs text-zinc-500">tokens</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">{dashboard?.summary.totalRequests || 0} lượt gọi AI</span>
                </div>

                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4 space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-400">Tiết Kiệm Chi Phí</span>
                        <ShieldCheck className="w-4 h-4 text-emerald-400/80" />
                    </div>
                    <div className="flex items-baseline gap-1">
                        <strong className="text-2xl font-black text-emerald-400 font-mono">
                            ~85%
                        </strong>
                    </div>
                    <span className="text-[10px] text-zinc-500">So với API độc quyền đám mây</span>
                </div>
            </div>

            {/* INTERACTIVE AGENT PLAYGROUND */}
            <div className="bg-gradient-to-r from-blue-950/20 via-zinc-900/40 to-indigo-950/20 border border-blue-500/30 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                            <Bot className="w-4 h-4 text-blue-400" />
                            <span>Interactive Agent Playground: Kiểm Tra & Chạy Prompt Trực Tiếp Trên Máy Seller</span>
                        </h2>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400">Chọn máy đã thuê:</span>
                        <select
                            value={selectedRentalId}
                            onChange={(e) => setSelectedRentalId(e.target.value)}
                            className="bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-blue-300 font-medium"
                        >
                            {dashboard?.activeRentals.map((r: any) => {
                                const sId = r.sessionId || r.id || r._id || ''
                                return (
                                    <option key={sId} value={sId}>
                                        {r.nodeName} ({r.modelDisplayName})
                                    </option>
                                )
                            })}
                            {(!dashboard?.activeRentals || dashboard.activeRentals.length === 0) && (
                                <option value="">Chưa có máy nào - Hãy chọn 1 máy bên dưới</option>
                            )}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Prompt Input Box */}
                    <div className="space-y-3 flex flex-col justify-between">
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Yêu cầu / Prompt cho Agent:</label>
                            <textarea
                                rows={4}
                                value={promptText}
                                onChange={(e) => setPromptText(e.target.value)}
                                placeholder="Nhập câu hỏi, bài toán hoặc tác vụ lập trình cho Agent..."
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:border-blue-500 focus:outline-none font-sans"
                            />
                        </div>

                        <div className="flex items-center justify-between gap-3">
                            <span className="text-[11px] text-zinc-500">
                                Request sẽ được mã hóa và chuyển thẳng tới Local Model trên máy của Seller gần bạn.
                            </span>
                            <button
                                onClick={handleRunInference}
                                disabled={inferencing || !promptText.trim()}
                                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/25 transition disabled:opacity-50 shrink-0 flex items-center gap-2"
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
                    <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between min-h-[160px]">
                        <div>
                            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2 mb-2">
                                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                                    <span>Kết quả phản hồi từ Local Model:</span>
                                </span>
                                {inferenceOutput && (
                                    <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
                                        <span className="text-blue-300 flex items-center gap-1">
                                            <Zap className="w-3 h-3 text-blue-400" />
                                            <span>{inferenceOutput.latencyMs} ms</span>
                                        </span>
                                        <span>•</span>
                                        <span className="text-indigo-300">{inferenceOutput.tokens} tokens</span>
                                        <span>•</span>
                                        <span className="text-amber-400 font-bold">-{inferenceOutput.coinsBilled} Coins</span>
                                    </div>
                                )}
                            </div>

                            {inferencing ? (
                                <div className="py-8 text-center space-y-2 text-zinc-400 text-xs">
                                    <RefreshCw className="w-6 h-6 text-blue-500 animate-spin mx-auto" />
                                    <p>Máy chủ của Seller đang nạp prompt vào GPU/CPU và sinh token...</p>
                                </div>
                            ) : inferenceOutput ? (
                                <div className="space-y-2 text-xs font-mono text-zinc-200 whitespace-pre-wrap max-h-48 overflow-y-auto">
                                    {inferenceOutput.output}
                                </div>
                            ) : (
                                <div className="py-8 text-center text-zinc-600 text-xs font-sans">
                                    Bấm &quot;Gửi Lệnh Cho Agent&quot; để chạy thử mô hình local ngay trên máy Seller đã thuê.
                                </div>
                            )}
                        </div>

                        {inferenceOutput && (
                            <div className="pt-2 border-t border-zinc-800/60 text-[10px] text-zinc-500 flex items-center justify-between font-sans">
                                <span>Máy xử lý: <strong className="text-zinc-300">{inferenceOutput.nodeName}</strong></span>
                                <span>Mô hình: <strong className="text-blue-300">{inferenceOutput.modelName}</strong></span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* MARKETPLACE: MÁY CHO THUÊ ĐANG ONLINE (ƯU TIÊN GẦN NHẤT) */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <span>Sàn Máy Trạm Seller Đang Online (Sắp Xếp Theo Khoảng Cách Gần Nhất)</span>
                    </h2>
                    <span className="text-xs text-zinc-500">{filteredNodes.length} máy tính đối tác khả dụng</span>
                </div>

                {filteredNodes.length === 0 ? (
                    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-10 text-center space-y-3">
                        <Server className="w-10 h-10 text-zinc-600 mx-auto" />
                        <div className="space-y-1">
                            <h3 className="text-sm font-bold text-zinc-300">Chưa có máy Seller nào trực tuyến</h3>
                            <p className="text-xs text-zinc-500 max-w-md mx-auto">
                                Hiện tại chưa có máy trạm nào được đăng ký hoặc đang bật. Bạn có thể tự mở ứng dụng đối tác Seller để đưa máy của mình lên sàn cho thuê.
                            </p>
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
                                    className="bg-zinc-900/50 border border-zinc-800/80 hover:border-blue-500/40 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition shadow-lg group"
                                >
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> ONLINE
                                                </span>
                                                {node.distanceKm !== undefined && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                                                        <MapPin className="w-3 h-3 text-blue-400" />
                                                        <span>{distance} km</span>
                                                    </span>
                                                )}
                                            </div>

                                            <div className="text-right">
                                                <strong className="text-amber-400 font-mono text-sm">{node.coinsPerHour ?? node.pricing?.coinsPerHour ?? 30}</strong>
                                                <span className="text-[10px] text-zinc-400"> coins/h</span>
                                            </div>
                                        </div>

                                        <h3 className="text-xs font-bold text-white mt-2 truncate group-hover:text-blue-300 transition">
                                            {node.nodeName}
                                        </h3>
                                        <p className="text-[11px] text-blue-400 font-semibold mt-0.5 truncate flex items-center gap-1.5">
                                            <Bot className="w-3.5 h-3.5 text-blue-400" />
                                            <span>{node.modelDisplayName}</span>
                                        </p>

                                        <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-1">
                                            <span>Khu vực: <strong className="text-zinc-300">{node.locationName || 'Hà Nội'}</strong></span>
                                            <span className="text-emerald-400 font-mono flex items-center gap-1">
                                                <Zap className="w-3 h-3 text-emerald-400" />
                                                <span>Ping ~{estPing}ms</span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* Specs Mini */}
                                    <div className="grid grid-cols-3 gap-1 text-center text-xs bg-zinc-950/70 p-2 rounded-xl border border-zinc-800/80">
                                        <div>
                                            <span className="text-[9px] text-zinc-500 block">CPU</span>
                                            <strong className="text-blue-300 font-mono text-[11px]">{node.cpuCores}C</strong>
                                        </div>
                                        <div>
                                            <span className="text-[9px] text-zinc-500 block">RAM</span>
                                            <strong className="text-indigo-300 font-mono text-[11px]">{node.ramGB}GB</strong>
                                        </div>
                                        <div>
                                            <span className="text-[9px] text-zinc-500 block">VRAM</span>
                                            <strong className="text-purple-300 font-mono text-[11px]">
                                                {node.vramGB && node.vramGB > 0 ? `${node.vramGB}G` : 'CPU'}
                                            </strong>
                                        </div>
                                    </div>

                                    {/* Rent Button */}
                                    <button
                                        onClick={() => handleRentNode(node)}
                                        className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-1.5"
                                    >
                                        <Zap className="w-3.5 h-3.5 text-white" />
                                        <span>Thuê Máy & Nạp Cho Agent</span>
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* MY ACTIVE RENTALS */}
            <div className="space-y-3 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                        <span>Danh Sách Máy Bạn Đang Thuê & Đang Nạp Vào Agent</span>
                    </h2>
                    <span className="text-xs text-zinc-500">{dashboard?.activeRentals.length || 0} phiên hoạt động</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-zinc-800 text-zinc-400">
                                <th className="pb-2 font-medium">Phiên thuê</th>
                                <th className="pb-2 font-medium">Máy Seller</th>
                                <th className="pb-2 font-medium">Mô hình AI</th>
                                <th className="pb-2 font-medium">Agent đang nạp</th>
                                <th className="pb-2 font-medium text-right">Tokens dùng</th>
                                <th className="pb-2 font-medium text-right">Coins chi</th>
                                <th className="pb-2 font-medium text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50 font-mono">
                            {dashboard?.activeRentals.map((r: any, idx: number) => {
                                const sId = r.sessionId || r.id || r._id || `sess_${idx}`
                                const displayId = String(sId).length > 8 ? String(sId).slice(-8) : String(sId)
                                return (
                                    <tr key={sId} className="hover:bg-zinc-900/50">
                                        <td className="py-2.5 text-zinc-400 font-mono">{displayId}</td>
                                        <td className="py-2.5 text-zinc-200 font-sans font-medium">{r.nodeName}</td>
                                        <td className="py-2.5 text-blue-300 font-sans">{r.modelDisplayName}</td>
                                        <td className="py-2.5 text-emerald-400 font-sans">{r.boundAgentName || r.assignedAgentId || 'Multi-Agent'}</td>
                                        <td className="py-2.5 text-right text-indigo-400 font-mono">{r.totalTokensUsed?.toLocaleString() || 0}</td>
                                        <td className="py-2.5 text-right text-amber-400 font-bold font-mono">{r.totalCoinsSpent || 0}</td>
                                        <td className="py-2.5 text-right font-sans">
                                            <button
                                                onClick={() => handleStopRental(sId)}
                                                className="px-2.5 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/30 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 ml-auto"
                                            >
                                                <PowerOff className="w-3 h-3 text-red-400" />
                                                <span>Dừng Thuê</span>
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                            {(!dashboard?.activeRentals || dashboard.activeRentals.length === 0) && (
                                <tr>
                                    <td colSpan={7} className="py-8 text-center text-zinc-500 font-sans">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Layers className="w-8 h-8 text-zinc-600" />
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
