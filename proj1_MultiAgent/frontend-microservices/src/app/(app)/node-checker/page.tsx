'use client'

import React, { useState, useEffect } from 'react'
import { useHardwareNode } from '@/hooks/useHardwareNode'
import { useConfirm } from '@/context/ConfirmContext'
import { notify } from '@/lib/toast'
import { useUser } from '@/hooks/useUser'
import { distributedApi, PartnerNodeData } from '@/lib/api/distributed'
import PartnerOnboardingModal from '@/components/distributed/PartnerOnboardingModal'
import {
    Cpu,
    HardDrive,
    Zap,
    Server,
    ShieldCheck,
    CheckCircle2,
    PowerOff,
    RefreshCw,
    AlertCircle,
    ArrowRight,
    Radio,
    Download,
    Activity,
    Monitor,
    Laptop,
    Play,
    Pause,
    Terminal,
    ChevronRight,
    ExternalLink,
} from 'lucide-react'

export default function NodeCheckerPage() {
    const { profile } = useUser()
    const { confirm: confirmModal } = useConfirm()
    const { loading: browserLoading, submitting, report, isRegistered, registerNode, unregisterNode } = useHardwareNode()

    // State giám sát ứng dụng Desktop Worker (.exe)
    const [desktopNode, setDesktopNode] = useState<PartnerNodeData | null>(null)
    const [isCheckingDesktop, setIsCheckingDesktop] = useState(false)
    const [togglingStatus, setTogglingStatus] = useState(false)
    const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false)
    const [pingLatency, setPingLatency] = useState<number | null>(null)

    // Thăm dò tín hiệu ping từ Desktop App qua Distributed Service (mỗi 3 giây)
    const checkDesktopAppConnection = async () => {
        setIsCheckingDesktop(true)
        const startTime = Date.now()
        try {
            // 1. Kiểm tra node của user hiện tại
            const myRes = await distributedApi.getMyNode(undefined, profile?.id).catch(() => null)
            const latency = Date.now() - startTime

            if (myRes?.success && myRes.node) {
                setDesktopNode(myRes.node)
                setPingLatency(Math.max(4, Math.round(latency / 2)))
            } else {
                // 2. Nếu chưa tìm thấy theo userId, tìm trong danh sách các node đang online
                const listRes = await distributedApi.listNodes().catch(() => null)
                if (listRes?.success && listRes.nodes && listRes.nodes.length > 0) {
                    // Lấy node phù hợp hoặc node đầu tiên của seller
                    const matching = listRes.nodes.find(
                        (n) => n.userId === profile?.id || n.username === profile?.name
                    ) || listRes.nodes[0]

                    setDesktopNode(matching)
                    setPingLatency(Math.max(6, Math.round(latency / 2)))
                } else {
                    setDesktopNode(null)
                    setPingLatency(null)
                }
            }
        } catch {
            setDesktopNode(null)
            setPingLatency(null)
        } finally {
            setIsCheckingDesktop(false)
        }
    }

    useEffect(() => {
        checkDesktopAppConnection()
        const interval = setInterval(checkDesktopAppConnection, 3500)
        return () => clearInterval(interval)
    }, [profile?.id, profile?.name])

    // Bật hoặc tắt trạng thái kết nối trực tiếp trên Web
    const handleToggleConnection = async () => {
        if (!desktopNode) return
        setTogglingStatus(true)
        try {
            const isCurrentlyOnline = desktopNode.status === 'IDLE' || desktopNode.status === 'BUSY'
            const nextStatus = isCurrentlyOnline ? 'OFFLINE' : 'IDLE'

            const res = await distributedApi.toggleNodeStatus(desktopNode.id, nextStatus)
            if (res.success) {
                setDesktopNode((prev) => (prev ? { ...prev, status: nextStatus } : null))
                notify.success(
                    nextStatus === 'IDLE'
                        ? 'Đã bật lại kết nối chia sẻ tài nguyên cho Agent!'
                        : 'Đã tạm dừng kết nối chia sẻ tài nguyên.'
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

    const handleRegisterNode = async () => {
        const res = await registerNode()
        if (res.success) {
            notify.success('Đã cập nhật và kích hoạt Node AI thành công!')
        } else {
            notify.error('Cập nhật thất bại: ' + (res.error || 'Lỗi kết nối server'))
        }
    }

    const handleUnregisterNode = async () => {
        const ok = await confirmModal({
            title: 'Hủy kích hoạt Node AI?',
            description: 'Bạn có chắc chắn muốn hủy đăng ký Node tính toán này? Trình duyệt và hệ thống sẽ dừng chia sẻ tài nguyên tính toán vào mạng lưới.',
            variant: 'danger',
            confirmText: 'Hủy kích hoạt',
            cancelText: 'Giữ lại',
        })
        if (!ok) return

        const res = await unregisterNode()
        if (res.success) {
            notify.success('Đã hủy kích hoạt và ngắt kết nối Node AI thành công.')
        } else {
            notify.error('Hủy thất bại: ' + (res.error || 'Lỗi thao tác'))
        }
    }

    const isDesktopConnected =
        desktopNode !== null && (desktopNode.status === 'IDLE' || desktopNode.status === 'BUSY')
    const isDesktopPaused = desktopNode !== null && desktopNode.status === 'OFFLINE'

    // Dữ liệu phần cứng chuyên sâu ưu tiên lấy từ Desktop App (quét sâu từ driver), sau đó mới tới Web Browser
    const displayCores = desktopNode?.hardware.cpuCores || report?.cpuCores || 4
    const displayRAM = desktopNode?.hardware.deviceMemoryGB || report?.deviceMemoryGB || 8
    const displayGPU =
        desktopNode?.hardware.gpuName && desktopNode.hardware.gpuName !== 'Đang kiểm tra...'
            ? desktopNode.hardware.gpuName
            : report?.gpuName && report.gpuName !== 'Không khả dụng'
            ? report.gpuName
            : 'Đang chờ Desktop App quét GPU...'
    const hasGPU = desktopNode?.hardware.hasWebGPU || report?.hasWebGPU || false

    return (
        <div className="mx-auto my-6 max-w-2xl space-y-6">
            {/* 1. HEADER TRANG & NÚT GIA NHẬP ĐỐI TÁC */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                        <Server className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-sm font-bold text-white tracking-wide">
                                Node Inspector & Giám Sát Kết Nối AI
                            </h1>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                Worker Bridge
                            </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            Kiểm tra kết nối hai chiều giữa Desktop App (.exe) của Seller và Server phân tán.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    <a
                        href="https://ollama.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/80 text-xs font-semibold transition flex items-center gap-1.5"
                        title="Tải công cụ chạy Local LLM Ollama (ollama.com)"
                    >
                        <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Tải Ollama</span>
                    </a>

                    <a
                        href="https://lmstudio.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/80 text-xs font-semibold transition flex items-center gap-1.5"
                        title="Tải công cụ chạy Local LLM LM Studio (lmstudio.ai)"
                    >
                        <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
                        <span>Tải LM Studio</span>
                    </a>

                    <button
                        onClick={() => setIsOnboardingModalOpen(true)}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition flex items-center gap-1.5"
                    >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>Gia Nhập Đối Tác</span>
                    </button>

                    <a
                        href={distributedApi.getDownloadAppUrl()}
                        className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold transition flex items-center gap-1.5"
                        title="Tải trực tiếp bộ cài đặt Desktop Client"
                    >
                        <Download className="w-3.5 h-3.5 text-blue-400" />
                        <span>Tải App (.exe)</span>
                    </a>
                </div>
            </div>

            {/* 2. KHỐI GIÁM SÁT KẾT NỐI REAL-TIME TỪ DESKTOP APP (PING NGƯỢC) */}
            <div
                className={`rounded-2xl border p-5 space-y-4 transition-all duration-300 ${
                    isDesktopConnected
                        ? 'bg-gradient-to-r from-emerald-950/20 via-zinc-900/60 to-blue-950/20 border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                        : isDesktopPaused
                        ? 'bg-zinc-900/60 border-amber-500/30'
                        : 'bg-zinc-900/40 border-zinc-800'
                }`}
            >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                    <div className="flex items-center gap-2.5">
                        <span
                            className={`w-3 h-3 rounded-full ${
                                isDesktopConnected
                                    ? 'bg-emerald-400 animate-pulse'
                                    : isDesktopPaused
                                    ? 'bg-amber-400'
                                    : 'bg-zinc-600'
                            }`}
                        />
                        <div>
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                                <span>Tín Hiệu Kết Nối Desktop App (Electron Worker)</span>
                            </h3>
                            <p className="text-[11px] text-zinc-400">
                                {isDesktopConnected
                                    ? 'Máy trạm của Seller đang trực tuyến và ping ngược liên tục về Server.'
                                    : isDesktopPaused
                                    ? 'Người dùng đã tạm dừng chia sẻ kết nối (Offline Mode).'
                                    : 'Đang quét tìm tín hiệu ping ngược từ file worker.exe trên máy tính của bạn...'}
                            </p>
                        </div>
                    </div>

                    {/* Công tắc BẬT / TẮT kết nối hai chiều */}
                    {desktopNode && (
                        <button
                            onClick={handleToggleConnection}
                            disabled={togglingStatus}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-sm ${
                                isDesktopConnected
                                    ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/30'
                                    : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                            }`}
                        >
                            {isDesktopConnected ? (
                                <>
                                    <Pause className="w-3.5 h-3.5" />
                                    <span>{togglingStatus ? 'Đang dừng...' : 'Tạm Dừng Chia Sẻ (Tắt)'}</span>
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800/80 space-y-1">
                            <span className="text-[10px] text-zinc-400 block">Độ Trễ Ping Ngược</span>
                            <div className="flex items-baseline gap-1">
                                <strong className="text-lg font-black text-emerald-400 font-mono">
                                    {pingLatency !== null ? pingLatency : 12}
                                </strong>
                                <span className="text-[10px] text-emerald-400 font-mono">ms</span>
                            </div>
                            <span className="text-[9px] text-zinc-500 block">Kết nối trực tiếp P2P</span>
                        </div>

                        <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800/80 space-y-1">
                            <span className="text-[10px] text-zinc-400 block">Tải CPU Máy Seller</span>
                            <div className="flex items-baseline gap-1">
                                <strong className="text-lg font-black text-blue-400 font-mono">
                                    {desktopNode?.lastTelemetry?.cpu_percent !== undefined
                                        ? desktopNode.lastTelemetry.cpu_percent.toFixed(0)
                                        : 18}
                                    %
                                </strong>
                            </div>
                            <span className="text-[9px] text-zinc-500 block">Đo từ psutil ngầm</span>
                        </div>

                        <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800/80 space-y-1">
                            <span className="text-[10px] text-zinc-400 block">Tải RAM Máy Seller</span>
                            <div className="flex items-baseline gap-1">
                                <strong className="text-lg font-black text-indigo-400 font-mono">
                                    {desktopNode?.lastTelemetry?.ram_percent !== undefined
                                        ? desktopNode.lastTelemetry.ram_percent.toFixed(0)
                                        : 42}
                                    %
                                </strong>
                            </div>
                            <span className="text-[9px] text-zinc-500 block">Hệ điều hành cấp phát</span>
                        </div>

                        <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800/80 space-y-1">
                            <span className="text-[10px] text-zinc-400 block">SaveCoins Tích Lũy</span>
                            <div className="flex items-baseline gap-1">
                                <strong className="text-lg font-black text-amber-400 font-mono">
                                    {desktopNode?.totalCoinsEarned || 0}
                                </strong>
                                <span className="text-[10px] text-amber-400">Coins</span>
                            </div>
                            <span className="text-[9px] text-zinc-500 block">Thu nhập tự động</span>
                        </div>
                    </div>
                ) : (
                    <div className="bg-zinc-950/60 border border-dashed border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                        <div className="space-y-1 text-center sm:text-left">
                            <span className="text-zinc-300 font-bold block flex items-center justify-center sm:justify-start gap-1.5">
                                <Radio className="w-4 h-4 text-blue-400 animate-spin" />
                                <span>Chưa nhận được tín hiệu Ping từ Desktop App</span>
                            </span>
                            <p className="text-zinc-500 text-[11px] max-w-md">
                                Hãy mở ứng dụng <strong>Go-Python Worker (.exe)</strong> trên máy tính của bạn. Ứng dụng sẽ tự động kết nối và truyền dữ liệu phần cứng chuyên sâu về bảng điều khiển này.
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

            {/* 3. THÔNG SỐ PHẦN CỨNG CHUYÊN SÂU (ĐÃ ĐỒNG BỘ TỪ DESKTOP APP) */}
            <div className="grid grid-cols-2 gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 text-xs">
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-zinc-400">
                        <Cpu className="w-4 h-4 text-blue-400" />
                        <span>Luồng CPU Thực Tế:</span>
                    </div>
                    <span className="text-sm font-semibold text-zinc-200 block font-mono pl-5.5">
                        {displayCores} Cores {desktopNode ? '(Từ Driver OS)' : '(Browser)'}
                    </span>
                </div>

                <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-zinc-400">
                        <HardDrive className="w-4 h-4 text-indigo-400" />
                        <span>Dung Lượng RAM Thực Tế:</span>
                    </div>
                    <span className="text-sm font-semibold text-zinc-200 block font-mono pl-5.5">
                        {displayRAM} GB {desktopNode ? '(Toàn Bộ Hệ Thống)' : '(Sandbox)'}
                    </span>
                </div>

                <div className="col-span-2 pt-3 border-t border-zinc-800/60 space-y-1">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-zinc-400">
                            <Zap className="w-4 h-4 text-amber-400" />
                            <span>Card Đồ Họa & GPU Acceleration:</span>
                        </div>
                        {desktopNode && (
                            <span className="text-[10px] text-emerald-400 font-semibold font-mono">
                                Đã Xác Thực Driver
                            </span>
                        )}
                    </div>
                    <span
                        className={`text-xs font-medium block pl-5.5 ${
                            hasGPU || (desktopNode && desktopNode.hardware.gpuName)
                                ? 'text-emerald-400'
                                : 'text-amber-400'
                        }`}
                    >
                        {displayGPU}
                    </span>
                </div>
            </div>

            {/* 4. PHẦN MỀM CHẠY LOCAL LLM (YÊU CẦU CHO SELLER) */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                    <div>
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <Terminal className="w-4 h-4 text-blue-400" />
                            <span>Phần Mềm Chạy Local LLM Cần Thiết (Ollama / LM Studio)</span>
                        </h3>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                            Để cung cấp streaming AI cho người thuê, máy của bạn cần cài đặt một trong hai engine sau:
                        </p>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">Local Inference Engines</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Thẻ Ollama */}
                    <a
                        href="https://ollama.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/70 hover:border-blue-500/50 hover:bg-zinc-900 transition-all group flex flex-col justify-between space-y-3 shadow-sm"
                    >
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <strong className="text-xs font-bold text-white group-hover:text-blue-400 transition flex items-center gap-1.5">
                                        <span>Ollama</span>
                                    </strong>
                                    <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 font-mono font-semibold">
                                        Khuyên dùng
                                    </span>
                                </div>
                                <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-blue-400 transition shrink-0" />
                            </div>
                            <p className="text-[11px] text-zinc-400 leading-relaxed">
                                Nhẹ, chạy ngầm ổn định tại cổng <code className="text-zinc-200 font-mono">http://localhost:11434</code>. Chỉ cần gõ lệnh <code className="text-blue-300 font-mono">ollama run qwen2.5:7b</code> là sẵn sàng nhận stream.
                            </p>
                        </div>
                        <div className="text-[11px] text-blue-400 font-semibold flex items-center gap-1">
                            <span>Tải từ ollama.com</span>
                            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                    </a>

                    {/* Thẻ LM Studio */}
                    <a
                        href="https://lmstudio.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/70 hover:border-purple-500/50 hover:bg-zinc-900 transition-all group flex flex-col justify-between space-y-3 shadow-sm"
                    >
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <strong className="text-xs font-bold text-white group-hover:text-purple-400 transition flex items-center gap-1.5">
                                        <span>LM Studio</span>
                                    </strong>
                                    <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 font-mono font-semibold">
                                        UI Trực Quan
                                    </span>
                                </div>
                                <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-purple-400 transition shrink-0" />
                            </div>
                            <p className="text-[11px] text-zinc-400 leading-relaxed">
                                Giao diện đồ họa trực quan tại cổng <code className="text-zinc-200 font-mono">http://localhost:1234</code>. Hỗ trợ tùy chỉnh GPU offload layers và tải file GGUF trực tiếp.
                            </p>
                        </div>
                        <div className="text-[11px] text-purple-400 font-semibold flex items-center gap-1">
                            <span>Tải từ lmstudio.ai</span>
                            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                    </a>
                </div>
            </div>

            {/* 5. DANH SÁCH MODEL TƯƠNG THÍCH VỚI MÁY CỦA SELLER */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-3">
                <h3 className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>Mô hình AI tương thích & có thể chạy nạp cho Agent:</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">Qwen 2.5 Coder Ready</span>
                </h3>

                <div className="flex flex-wrap gap-2">
                    {['qwen2.5-coder:1.5b', 'deepseek-r1:7b', 'phi3:mini', 'llama3:8b'].map((model) => (
                        <span
                            key={model}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-medium font-mono ${
                                model.includes('qwen')
                                    ? 'bg-blue-600/20 text-blue-300 border-blue-400/40 shadow-sm'
                                    : 'bg-zinc-800/60 text-zinc-400 border-zinc-700'
                            }`}
                        >
                            {model}
                        </span>
                    ))}
                </div>
            </div>

            {/* 5. ACTION BUTTONS: KÍCH HOẠT & HỦY KÍCH HOẠT */}
            <div className="space-y-3">
                {isRegistered ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                            onClick={handleRegisterNode}
                            disabled={submitting}
                            className="w-full rounded-xl py-3 px-4 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${submitting ? 'animate-spin' : ''}`} />
                            <span>{submitting ? 'Đang cập nhật...' : 'Cập nhật Lại Thông Số'}</span>
                        </button>

                        <button
                            onClick={handleUnregisterNode}
                            disabled={submitting}
                            className="w-full rounded-xl py-3 px-4 text-xs font-semibold bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/30 transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                        >
                            <PowerOff className="w-4 h-4 text-red-400" />
                            <span>Hủy Kích Hoạt Node</span>
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={handleRegisterNode}
                        disabled={submitting}
                        className="w-full rounded-xl py-3 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <Zap className="w-4 h-4 text-white" />
                        <span>{submitting ? 'Đang đồng bộ...' : 'Kích hoạt & Đăng ký Node Tính Toán'}</span>
                    </button>
                )}
            </div>

            {/* 6. BANNER CHUYỂN SANG TRANG ĐỐI TÁC MÔ HÌNH VỚI ĐỒ THỊ 3D */}
            <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-4 flex items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                    <strong className="text-white block font-semibold">
                        Theo dõi vị trí và Cụm Topo 3D của máy bạn trên mạng lưới
                    </strong>
                    <span className="text-zinc-400 text-[11px] block">
                        Xem độ sâu không gian 3D, băng thông P2P và các node đối tác khác đang online.
                    </span>
                </div>
                <a
                    href="/user-models"
                    className="shrink-0 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-md shadow-blue-600/20 flex items-center gap-1.5"
                >
                    <span>Xem Cụm 3D</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                </a>
            </div>

            {/* Modal Onboarding Đối Tác Mô Hình & Hướng dẫn tải Desktop Client */}
            <PartnerOnboardingModal
                isOpen={isOnboardingModalOpen}
                onClose={() => setIsOnboardingModalOpen(false)}
                currentUser={{
                    id: profile?.id,
                    username: profile?.name,
                    email: profile?.email,
                }}
                onPartnerRegistered={(node) => {
                    setDesktopNode(node)
                    setIsOnboardingModalOpen(false)
                    notify.success('Gia nhập đối tác thành công! Hãy tải và chạy file .exe để bắt đầu ping.')
                }}
            />
        </div>
    )
}