'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
    distributedApi,
    HardwareReport,
    RentConfiguration,
    BenchmarkResult,
    PartnerNodeData,
    AppPackageInfo,
} from '@/lib/api/distributed'

interface PartnerOnboardingModalProps {
    isOpen: boolean
    onClose: () => void
    currentUser?: {
        id?: string
        username?: string
        email?: string
    }
    onPartnerRegistered?: (node: PartnerNodeData) => void
}

export default function PartnerOnboardingModal({
    isOpen,
    onClose,
    currentUser,
    onPartnerRegistered,
}: PartnerOnboardingModalProps) {
    const [step, setStep] = useState<'inspecting' | 'configure' | 'download_client'>('inspecting')
    const [scanning, setScanning] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // Hardware Specs
    const [hardware, setHardware] = useState<HardwareReport>({
        cpuCores: 8,
        deviceMemoryGB: 16,
        hasWebGPU: false,
        gpuName: 'Đang kiểm tra...',
        vramGB: 0,
        os: 'Windows 64-bit',
        arch: 'x64',
    })

    // Rental Configuration
    const [rentConfig, setRentConfig] = useState<RentConfiguration>({
        allocatedCores: 4,
        allocatedRAMGB: 8,
        enableGPU: true,
        gpuSharePercent: 70,
        availabilitySchedule: '24/7',
        minPricePerHourCoin: 80,
        autoStartWithOS: true,
    })

    // Benchmark Result from Golang service
    const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null)
    const [registeredNode, setRegisteredNode] = useState<PartnerNodeData | null>(null)
    const [appPackage, setAppPackage] = useState<AppPackageInfo | null>(null)
    const [copiedToken, setCopiedToken] = useState(false)

    // Real-time Telemetry via WebSocket from client
    const [liveTelemetry, setLiveTelemetry] = useState<{
        cpu: number
        ram: number
        disk: number
        connected: boolean
    }>({ cpu: 0, ram: 0, disk: 0, connected: false })

    const wsRef = useRef<WebSocket | null>(null)

    // 1. Quét thông số phần cứng từ trình duyệt
    useEffect(() => {
        if (!isOpen) return

        async function detectHardware() {
            setScanning(true)
            const cpuCores = navigator.hardwareConcurrency || 8
            const deviceMemoryGB = (navigator as any).deviceMemory || 16

            let hasWebGPU = false
            let gpuName = 'Không khả dụng'
            let vramGB = 0

            if ('gpu' in navigator) {
                try {
                    const adapter = await (navigator as any).gpu.requestAdapter()
                    if (adapter) {
                        hasWebGPU = true
                        const info = await adapter.requestAdapterInfo?.()
                        gpuName = info?.description || info?.vendor || 'WebGPU Compatible Adapter'
                        vramGB = 8
                    }
                } catch {
                    // Trình duyệt không hỗ trợ WebGPU
                }
            }

            const platform = navigator.userAgent.includes('Win')
                ? 'Windows 64-bit'
                : navigator.userAgent.includes('Mac')
                ? 'macOS'
                : 'Linux 64-bit'

            const detectedHW: HardwareReport = {
                cpuCores,
                deviceMemoryGB,
                hasWebGPU,
                gpuName,
                vramGB,
                os: platform,
                arch: 'x64',
            }

            setHardware(detectedHW)

            // Khởi tạo mức cho thuê mặc định: 50% CPU, 50% RAM
            setRentConfig((prev) => ({
                ...prev,
                allocatedCores: Math.max(2, Math.floor(cpuCores * 0.6)),
                allocatedRAMGB: Math.max(4, Math.floor(deviceMemoryGB * 0.6)),
                enableGPU: hasWebGPU,
            }))

            // Gửi lên Golang Distributed Service để benchmark và nhận đề xuất model
            try {
                const res = await distributedApi.benchmarkHardware(detectedHW)
                if (res.success && res.data) {
                    setBenchmark(res.data)
                }
            } catch (err) {
                console.warn('Lỗi gọi API benchmark phần cứng:', err)
            } finally {
                setScanning(false)
                setStep('configure')
            }
        }

        detectHardware()
    }, [isOpen])

    // 2. Kết nối WebSocket tới Go Server khi đã đăng ký node thành công để theo dõi telemetry
    useEffect(() => {
        if (step !== 'download_client' || !registeredNode) return

        const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000'
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsHost = gatewayUrl.replace(/^http:\/\//, '').replace(/^https:\/\//, '')
        const wsUrl = `${wsProtocol}//${wsHost}/api/v1/distributed/ws?nodeId=${registeredNode.id}&token=${registeredNode.authToken}`

        let ws: WebSocket
        try {
            ws = new WebSocket(wsUrl)
            wsRef.current = ws

            ws.onopen = () => {
                setLiveTelemetry((prev) => ({ ...prev, connected: true }))
            }

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data)
                    if (data.type === 'HARDWARE_STATS' || data.cpu_percent !== undefined) {
                        setLiveTelemetry({
                            cpu: data.cpu_percent || 0,
                            ram: data.ram_percent || 0,
                            disk: data.disk_percent || 0,
                            connected: true,
                        })
                    }
                } catch {
                    // Ignore
                }
            }

            ws.onclose = () => {
                setLiveTelemetry((prev) => ({ ...prev, connected: false }))
            }
        } catch {
            // Ignore
        }

        return () => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close()
            }
        }
    }, [step, registeredNode])

    // Xử lý gửi đăng ký đối tác
    const handleConfirmPartnership = async () => {
        setSubmitting(true)
        try {
            const payload = {
                userId: currentUser?.id || 'usr_client_' + Date.now().toString(36),
                username: currentUser?.username || 'AI_Compute_Partner',
                email: currentUser?.email || 'partner@network.ai',
                hardware,
                rentConfig,
            }

            const res = await distributedApi.registerPartnerNode(payload)
            if (res.success && res.node) {
                setRegisteredNode(res.node)
                setAppPackage(res.clientApp)
                if (res.benchmark) setBenchmark(res.benchmark)
                onPartnerRegistered?.(res.node)
                setStep('download_client')
            }
        } catch (err: any) {
            alert('Lỗi đăng ký đối tác: ' + (err.message || 'Không thể kết nối Distributed Service'))
        } finally {
            setSubmitting(false)
        }
    }

    // Sao chép Token
    const copyTokenToClipboard = () => {
        if (!registeredNode?.authToken) return
        navigator.clipboard.writeText(registeredNode.authToken)
        setCopiedToken(true)
        setTimeout(() => setCopiedToken(false), 2000)
    }

    // Tính toán ước tính thu nhập theo cấu hình cho thuê
    const estimatedMonthlyCoins = Math.round(
        (rentConfig.allocatedCores * 8 +
            rentConfig.allocatedRAMGB * 5 +
            (rentConfig.enableGPU ? (rentConfig.gpuSharePercent / 100) * 80 : 0)) *
            24 *
            30
    )
    const estimatedHourlyCoins = Math.round((estimatedMonthlyCoins / (24 * 30)) * 10) / 10

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/40">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                <span>Chương Trình Đối Tác Tính Toán Mô Hình AI</span>
                                <span className="px-2 py-0.5 text-[10px] rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                                    Golang Core
                                </span>
                            </h2>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Cho thuê phần cứng nhàn rỗi, vận hành mô hình AI phân tán và nhận SaveCoins mỗi giờ.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-zinc-800 transition"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Progress Steps Header */}
                    <div className="flex items-center justify-between border border-zinc-800/60 bg-zinc-900/30 rounded-xl p-3 text-xs">
                        <div className={`flex items-center gap-2 ${step === 'inspecting' ? 'text-blue-400 font-bold' : 'text-zinc-400'}`}>
                            <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px]">1</span>
                            <span>Kiểm tra Phần Cứng</span>
                        </div>
                        <div className="w-8 h-[1px] bg-zinc-800" />
                        <div className={`flex items-center gap-2 ${step === 'configure' ? 'text-blue-400 font-bold' : 'text-zinc-400'}`}>
                            <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px]">2</span>
                            <span>Gợi ý Model & Cấu hình Thuê</span>
                        </div>
                        <div className="w-8 h-[1px] bg-zinc-800" />
                        <div className={`flex items-center gap-2 ${step === 'download_client' ? 'text-emerald-400 font-bold' : 'text-zinc-400'}`}>
                            <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px]">3</span>
                            <span>Tải Electron Desktop Client</span>
                        </div>
                    </div>

                    {/* BƯỚC 1 & 2: CẤU HÌNH VÀ GỢI Ý MODEL */}
                    {step === 'configure' && (
                        <div className="space-y-6">
                            {/* Card 1: Thông số quét tự động */}
                            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                                            <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                                            <line x1="6" y1="6" x2="6.01" y2="6" />
                                            <line x1="6" y1="18" x2="6.01" y2="18" />
                                        </svg>
                                        <span>Phần Cứng Đã Phát Hiện Tự Động</span>
                                    </h3>
                                    {benchmark && (
                                        <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                            {benchmark.tierName}
                                        </span>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                    <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/80">
                                        <span className="text-zinc-500 block text-[11px]">CPU Cores</span>
                                        <strong className="text-white text-sm">{hardware.cpuCores} Luồng xử lý</strong>
                                    </div>
                                    <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/80">
                                        <span className="text-zinc-500 block text-[11px]">Bộ nhớ RAM</span>
                                        <strong className="text-white text-sm">{hardware.deviceMemoryGB} GB RAM</strong>
                                    </div>
                                    <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/80">
                                        <span className="text-zinc-500 block text-[11px]">Tăng tốc WebGPU</span>
                                        <strong className={`text-sm ${hardware.hasWebGPU ? 'text-emerald-400' : 'text-amber-400'}`}>
                                            {hardware.hasWebGPU ? 'Khả dụng' : 'Chưa bật / CPU'}
                                        </strong>
                                    </div>
                                    <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/80">
                                        <span className="text-zinc-500 block text-[11px]">Tên Card Đồ Hoạ</span>
                                        <strong className="text-white text-xs truncate block" title={hardware.gpuName}>
                                            {hardware.gpuName || 'Không có GPU rời'}
                                        </strong>
                                    </div>
                                </div>

                                {benchmark?.summaryAdvice && (
                                    <div className="text-xs text-zinc-400 bg-blue-950/20 border border-blue-500/20 rounded-lg p-3 flex items-start gap-2">
                                        <span className="text-blue-400 text-sm">💡</span>
                                        <span>{benchmark.summaryAdvice}</span>
                                    </div>
                                )}
                            </div>

                            {/* Card 2: Danh sách Model Tương Thích & Đề Xuất */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                                    <span>Mô Hình AI Khả Thi & Mức Thu Nhập Đề Xuất</span>
                                    <span className="text-[11px] text-zinc-500 font-normal">
                                        Đánh giá bởi Golang Distributed Engine
                                    </span>
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {benchmark?.eligibleModels?.map((model) => (
                                        <div
                                            key={model.modelId}
                                            className={`p-3.5 rounded-xl border transition ${
                                                model.isEligible
                                                    ? 'bg-zinc-900/50 border-zinc-700/80 hover:border-blue-500/50'
                                                    : 'bg-zinc-900/20 border-zinc-800/40 opacity-70'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-2 h-2 rounded-full ${model.isEligible ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                                                    <strong className="text-xs text-white">{model.modelName}</strong>
                                                </div>
                                                <span
                                                    className={`px-2 py-0.5 text-[10px] rounded-md font-semibold border ${
                                                        model.isEligible
                                                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                                            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                                    }`}
                                                >
                                                    {model.isEligible ? 'Đủ Điều Kiện' : 'Chưa Đạt Cấu Hình'}
                                                </span>
                                            </div>

                                            <div className="mt-2.5 flex items-center justify-between text-xs text-zinc-400">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-[11px] text-zinc-300 font-medium">{model.role || model.category}</span>
                                                    {model.downloadSizeGB && (
                                                        <span className="px-1.5 py-0.2 bg-zinc-800 text-blue-300 rounded text-[10px] font-mono">
                                                            {model.downloadSizeGB} GB • {model.downloadFormat}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="font-semibold text-amber-400 shrink-0">
                                                    ~{model.coinsPerHour} SaveCoins/giờ
                                                </span>
                                            </div>

                                            {model.isEligible ? (
                                                <div className="mt-2.5 pt-2 border-t border-zinc-800/60 space-y-2">
                                                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                                                        <span>Tốc độ dự kiến:</span>
                                                        <strong className="text-blue-300 font-mono">
                                                            {model.estimatedTokensPerS} tokens/giây
                                                        </strong>
                                                    </div>

                                                    {/* Hướng dẫn setup và nút Tải Model */}
                                                    <div className="flex items-center justify-between gap-2 pt-1">
                                                        <span className="text-[10px] text-zinc-500 truncate font-mono">
                                                            {model.runCommand || `ollama run ${model.ollamaModel}`}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <a
                                                                href={distributedApi.getModelSetupScriptUrl(model.modelId, 'windows')}
                                                                download={`setup_${model.modelId}.bat`}
                                                                title="Tải kịch bản cài đặt tự động 1-click cho Windows"
                                                                className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-semibold rounded flex items-center gap-1 transition border border-zinc-700"
                                                            >
                                                                <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                                </svg>
                                                                <span>Cài 1-Click (.bat)</span>
                                                            </a>
                                                            {model.downloadUrl && (
                                                                <a
                                                                    href={model.downloadUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    title="Tải file trọng số GGUF trực tiếp từ HuggingFace"
                                                                    className="px-2 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 text-[10px] font-semibold rounded flex items-center gap-1 transition border border-blue-500/30"
                                                                >
                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                                    </svg>
                                                                    <span>Tải GGUF</span>
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="mt-2 pt-2 border-t border-zinc-800/60 text-[11px] text-red-400/90 space-y-0.5">
                                                    {model.missingRequirements?.map((req, i) => (
                                                        <div key={i}>⚠️ {req}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Card 3: Cấu hình cho thuê tài nguyên (Core, GPU, CPU) */}
                            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-4">
                                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                                    <span>Cấu Hình Tài Nguyên Bạn Muốn Cho Thuê</span>
                                    <span className="text-[11px] text-emerald-400 font-semibold">
                                        Ước tính: ~{estimatedHourlyCoins} SaveCoins/giờ
                                    </span>
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                                    {/* Slider CPU Cores */}
                                    <div className="space-y-2 bg-zinc-950/50 p-3 rounded-lg border border-zinc-800/80">
                                        <div className="flex items-center justify-between">
                                            <span className="text-zinc-400 font-medium">Số Core CPU Cho Thuê:</span>
                                            <strong className="text-blue-400 text-sm font-mono">
                                                {rentConfig.allocatedCores} / {hardware.cpuCores} Cores
                                            </strong>
                                        </div>
                                        <input
                                            type="range"
                                            min={1}
                                            max={hardware.cpuCores}
                                            value={rentConfig.allocatedCores}
                                            onChange={(e) =>
                                                setRentConfig({
                                                    ...rentConfig,
                                                    allocatedCores: parseInt(e.target.value),
                                                })
                                            }
                                            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                        />
                                        <span className="text-[10px] text-zinc-500 block">
                                            Giữ lại ít nhất 1-2 cores cho các tác vụ thường ngày của máy tính.
                                        </span>
                                    </div>

                                    {/* Slider RAM GB */}
                                    <div className="space-y-2 bg-zinc-950/50 p-3 rounded-lg border border-zinc-800/80">
                                        <div className="flex items-center justify-between">
                                            <span className="text-zinc-400 font-medium">Dung Lượng RAM Cho Thuê:</span>
                                            <strong className="text-indigo-400 text-sm font-mono">
                                                {rentConfig.allocatedRAMGB} / {hardware.deviceMemoryGB} GB
                                            </strong>
                                        </div>
                                        <input
                                            type="range"
                                            min={2}
                                            max={hardware.deviceMemoryGB}
                                            step={1}
                                            value={rentConfig.allocatedRAMGB}
                                            onChange={(e) =>
                                                setRentConfig({
                                                    ...rentConfig,
                                                    allocatedRAMGB: parseFloat(e.target.value),
                                                })
                                            }
                                            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                        />
                                        <span className="text-[10px] text-zinc-500 block">
                                            Mô hình 7B cần tối thiểu 8-12GB RAM phân bổ.
                                        </span>
                                    </div>

                                    {/* GPU Sharing Toggle & Slider */}
                                    <div className="space-y-2 bg-zinc-950/50 p-3 rounded-lg border border-zinc-800/80 md:col-span-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id="enableGpuCheck"
                                                    checked={rentConfig.enableGPU}
                                                    onChange={(e) =>
                                                        setRentConfig({
                                                            ...rentConfig,
                                                            enableGPU: e.target.checked,
                                                        })
                                                    }
                                                    className="w-4 h-4 rounded text-blue-600 bg-zinc-800 border-zinc-700"
                                                />
                                                <label htmlFor="enableGpuCheck" className="text-zinc-300 font-medium cursor-pointer">
                                                    Cho phép tăng tốc bằng GPU / WebGPU
                                                </label>
                                            </div>
                                            {rentConfig.enableGPU && (
                                                <strong className="text-amber-400 font-mono text-xs">
                                                    Phân bổ {rentConfig.gpuSharePercent}% công suất
                                                </strong>
                                            )}
                                        </div>

                                        {rentConfig.enableGPU && (
                                            <div className="pt-2">
                                                <input
                                                    type="range"
                                                    min={20}
                                                    max={100}
                                                    step={10}
                                                    value={rentConfig.gpuSharePercent}
                                                    onChange={(e) =>
                                                        setRentConfig({
                                                            ...rentConfig,
                                                            gpuSharePercent: parseInt(e.target.value),
                                                        })
                                                    }
                                                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Banner Lợi Nhuận Dự Kiến */}
                                <div className="bg-gradient-to-r from-emerald-950/30 to-blue-950/30 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between text-xs">
                                    <div>
                                        <span className="text-zinc-400 block text-[11px]">Tổng Thu Nhập Dự Kiến Hàng Tháng:</span>
                                        <strong className="text-lg text-emerald-400 font-bold font-mono">
                                            ~{estimatedMonthlyCoins.toLocaleString()} SaveCoins
                                        </strong>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-zinc-400 block text-[11px]">Quy đổi thưởng:</span>
                                        <span className="text-xs text-zinc-300">Đổi thẻ cào, API Credits, hoặc tiền thưởng</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* BƯỚC 3: NHẬN VÀ TẢI ELECTRON DESKTOP CLIENT (PYTHON + REACT) */}
                    {step === 'download_client' && registeredNode && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Banner Chúc Mừng */}
                            <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">
                                        Đã Ký Kết Đối Tác & Khởi Tạo Node AI Thành Công!
                                    </h3>
                                    <p className="text-xs text-zinc-300 mt-0.5">
                                        Node ID của bạn: <code className="text-emerald-400 font-mono font-bold">{registeredNode.id}</code>.
                                        Hãy cài đặt Desktop Client để bắt đầu kết nối máy và nhận việc.
                                    </p>
                                </div>
                            </div>

                            {/* Token Xác Thực */}
                            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-zinc-400">Node Authentication Token:</span>
                                    <button
                                        onClick={copyTokenToClipboard}
                                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
                                    >
                                        {copiedToken ? '✓ Đã sao chép' : 'Sao chép Token'}
                                    </button>
                                </div>
                                <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 font-mono text-xs text-zinc-200 select-all overflow-x-auto">
                                    {registeredNode.authToken}
                                </div>
                            </div>

                            {/* Tải về Client App Package (Go + Python + React + Electron) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="rounded-xl border border-blue-500/30 bg-blue-950/10 p-5 space-y-4 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <span className="px-2.5 py-0.5 text-[10px] rounded-full bg-blue-500/20 text-blue-300 font-bold">
                                                Gói Cài Đặt Chính Thức
                                            </span>
                                            <span className="text-xs text-zinc-400">
                                                {appPackage?.fileSizeMB || 109.6} MB
                                            </span>
                                        </div>
                                        <h4 className="text-sm font-bold text-white mt-2">
                                            Desktop Partner Client (Electron + React)
                                        </h4>
                                        <p className="text-xs text-zinc-400 mt-1">
                                            Bộ cài đặt Windows hoàn chỉnh tích hợp giao diện React Postman-style và Python Worker quét phần cứng thời gian thực.
                                        </p>
                                    </div>

                                    <div className="space-y-2 pt-2">
                                        <a
                                            href={distributedApi.getDownloadAppUrl()}
                                            download="Go-Python-Worker-Monitor-Setup-1.0.0.exe"
                                            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                            <span>Tải Bản Cài Đặt Windows (.exe)</span>
                                        </a>

                                        <a
                                            href={distributedApi.getDownloadConfigFileUrl(registeredNode.id)}
                                            download="worker-config.json"
                                            className="w-full py-2 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 font-semibold text-xs flex items-center justify-center gap-2 transition"
                                        >
                                            <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <span>Tải File Cấu Hình (worker-config.json)</span>
                                        </a>
                                    </div>
                                </div>

                                {/* Hướng dẫn chạy và Trạng thái Live WebSocket */}
                                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                                                Trạng Thái Kết Nối Trực Tiếp
                                            </h4>
                                            <span
                                                className={`px-2 py-0.5 text-[10px] rounded-full font-bold flex items-center gap-1.5 ${
                                                    liveTelemetry.connected
                                                        ? 'bg-emerald-500/20 text-emerald-400'
                                                        : 'bg-zinc-800 text-zinc-400'
                                                }`}
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full ${liveTelemetry.connected ? 'bg-emerald-400 animate-ping' : 'bg-zinc-500'}`} />
                                                <span>{liveTelemetry.connected ? 'ĐÃ KẾT NỐI' : 'CHỜ DESKTOP APP'}</span>
                                            </span>
                                        </div>

                                        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                                            <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                                                <span className="text-[10px] text-zinc-500 block">CPU Live</span>
                                                <strong className="text-blue-400 font-mono text-sm">{liveTelemetry.cpu}%</strong>
                                            </div>
                                            <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                                                <span className="text-[10px] text-zinc-500 block">RAM Live</span>
                                                <strong className="text-indigo-400 font-mono text-sm">{liveTelemetry.ram}%</strong>
                                            </div>
                                            <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                                                <span className="text-[10px] text-zinc-500 block">Disk Live</span>
                                                <strong className="text-amber-400 font-mono text-sm">{liveTelemetry.disk}%</strong>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-zinc-950/80 p-3 rounded-lg border border-zinc-800/80 text-[11px] text-zinc-400 space-y-1">
                                        <strong className="text-zinc-300 block">Khởi chạy nhanh qua mã nguồn:</strong>
                                        <div>1. Mở thư mục <code className="text-zinc-200">proj3_clientElectron</code></div>
                                        <div>2. Chạy Python daemon: <code className="text-blue-300">python backend/worker.py</code></div>
                                        <div>3. Chạy Desktop App: <code className="text-emerald-300">npm start</code></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between">
                    {step === 'configure' && (
                        <>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                            >
                                Đóng
                            </button>
                            <button
                                onClick={handleConfirmPartnership}
                                disabled={submitting}
                                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 flex items-center gap-2 transition disabled:opacity-50"
                            >
                                {submitting ? (
                                    <>
                                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Đang xác nhận đối tác...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Đồng Ý Ký Kết Đối Tác & Nhận App Client</span>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </>
                    )}

                    {step === 'download_client' && (
                        <div className="w-full flex items-center justify-between">
                            <span className="text-xs text-zinc-400">
                                Ứng dụng Desktop sẽ tự động gửi số liệu tính toán và tích lũy SaveCoin vào ví của bạn.
                            </span>
                            <button
                                onClick={onClose}
                                className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs transition"
                            >
                                Hoàn Tất & Đóng
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
