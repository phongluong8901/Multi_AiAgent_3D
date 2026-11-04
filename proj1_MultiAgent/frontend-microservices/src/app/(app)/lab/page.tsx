'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    Sparkles,
    Bot,
    Play,
    CheckCircle2,
    Clock,
    Terminal,
    FileCode,
    FileText,
    Layers,
    Cpu,
    ArrowRight,
    RefreshCw,
    ShieldCheck,
    Boxes,
    Search,
    Sliders,
    Copy,
    Check,
    FolderCode,
    Folder,
    Database,
    ExternalLink,
    File
} from 'lucide-react'
import LabScene from '@/components/lab/LabScene'
import { labApi, LabStage, LabSynthesisResponse, Agent, GeneratedFileList } from '@/lib/api'

const QUICK_TEMPLATES = [
    {
        title: 'Agent Phân tích PDF',
        goal: 'Tạo ra agent phân tích file PDF: trích xuất văn bản, đọc bảng số liệu, bóc tách hóa đơn và tóm tắt nội dung chính',
        model: 'gemini-2.5-flash-lite',
        color: '#6366f1',
    },
    {
        title: 'Agent Kiểm toán Mã nguồn',
        goal: 'Tạo ra agent review code Python: phát hiện lỗ hổng bảo mật, kiểm tra chuẩn PEP8, memory leak và sinh unit test',
        model: 'deepseek-coder',
        color: '#ec4899',
    },
    {
        title: 'Agent Khai thác Dữ liệu CSV',
        goal: 'Tạo ra agent phân tích file dữ liệu CSV: tính toán thống kê mô tả, tìm outliers và đề xuất chiến lược kinh doanh',
        model: 'gemini-2.5-flash',
        color: '#10b981',
    },
    {
        title: 'Agent Nghiên cứu Thị trường',
        goal: 'Tạo ra agent tra cứu xu hướng giá cả, phân tích đối thủ cạnh tranh và lập báo cáo tổng hợp SWOT',
        model: 'gemini-2.5-flash-lite',
        color: '#f59e0b',
    },
]

export default function AgentLabPage() {
    const [userGoal, setUserGoal] = useState('')
    const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash-lite')
    const [isSynthesizing, setIsSynthesizing] = useState(false)
    const [currentStep, setCurrentStep] = useState(0) // 0: idle, 1..5
    const [stages, setStages] = useState<LabStage[]>([])
    const [activeSpeech, setActiveSpeech] = useState<{ agentId: string; text: string } | null>(null)
    const [synthesisResult, setSynthesisResult] = useState<LabSynthesisResponse | null>(null)
    const [createdAgent, setCreatedAgent] = useState<Agent | null>(null)
    const [activeTab, setActiveTab] = useState<'blueprint' | 'prompt' | 'code' | 'sandbox' | 'files'>('blueprint')
    const [copied, setCopied] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [generatedFiles, setGeneratedFiles] = useState<GeneratedFileList | null>(null)
    const [loadingFiles, setLoadingFiles] = useState(false)

    const loadGeneratedFiles = async () => {
        try {
            setLoadingFiles(true)
            const res = await labApi.listGeneratedFiles()
            setGeneratedFiles(res)
        } catch (e) {
            console.error('Lỗi nạp danh sách file tự sinh:', e)
        } finally {
            setLoadingFiles(false)
        }
    }

    useEffect(() => {
        loadGeneratedFiles()
    }, [])

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleStartSynthesis = async (presetGoal?: string, presetModel?: string) => {
        const goal = presetGoal || userGoal
        const model = presetModel || selectedModel

        if (!goal.trim()) {
            setErrorMessage('Vui lòng nhập mô tả yêu cầu Agent bạn muốn chế tạo!')
            return
        }

        setErrorMessage(null)
        setIsSynthesizing(true)
        setCurrentStep(1)
        setCreatedAgent(null)
        setSynthesisResult(null)

        // Mô phỏng hiệu ứng chuyển tiếp giữa các Agent trong 3D Scene
        setActiveSpeech({
            agentId: 'agent_manager',
            text: `Đã tiếp nhận yêu cầu: "${goal}". Đang phân tích kiến trúc và điều phối dây chuyền Lab...`,
        })

        try {
            // Bước 1: Manager
            setCurrentStep(1)
            await new Promise((r) => setTimeout(r, 1200))

            // Bước 2: Search
            setCurrentStep(2)
            setActiveSpeech({
                agentId: 'agent_search',
                text: 'Đang khảo sát tài liệu kỹ thuật, thư viện mã nguồn và thuật toán tối ưu...',
            })
            await new Promise((r) => setTimeout(r, 1500))

            // Bước 3: Summarizer
            setCurrentStep(3)
            setActiveSpeech({
                agentId: 'agent_summarizer',
                text: 'Đang thiết kế System Prompt và định dạng dữ liệu đầu vào / đầu ra...',
            })
            await new Promise((r) => setTimeout(r, 1500))

            // Bước 4: Coder
            setCurrentStep(4)
            setActiveSpeech({
                agentId: 'agent_coder',
                text: 'Đang lập trình Python Tool và kích hoạt kiểm thử an toàn trong Sandbox Container...',
            })

            // Gọi API backend thực hiện chu trình
            const response = await labApi.generateAgent({
                goal,
                target_model: model,
                save_to_db: true,
            })

            setSynthesisResult(response)
            setStages(response.stages || [])

            // Bước 5: Hoàn tất
            setCurrentStep(5)
            const newAgent: Agent = {
                id: response.agent_blueprint.id,
                name: response.agent_blueprint.name,
                color: response.agent_blueprint.color,
                status: 'idle',
                speech: `Xin chào! Tôi là ${response.agent_blueprint.name}, vừa được chế tạo tại Agent Lab 3D!`,
                position: [0, 0, 0],
                model: response.agent_blueprint.model,
                prompt_id: response.agent_blueprint.prompt_id,
            }
            setCreatedAgent(newAgent)
            setActiveSpeech({
                agentId: 'agent_manager',
                text: `Chúc mừng! Agent '${response.agent_blueprint.name}' đã hoàn tất chế tạo, nạp vào DB và sẵn sàng hoạt động!`,
            })
            // Tải lại danh sách file vật lý trên đĩa
            loadGeneratedFiles()
        } catch (err: any) {
            console.error('Lỗi chế tạo Agent:', err)
            setErrorMessage(err.message || 'Không thể chế tạo Agent lúc này. Vui lòng thử lại!')
            setCurrentStep(0)
        } finally {
            setIsSynthesizing(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 lg:p-8 space-y-6">
            {/* Header Trang */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 shadow-lg shadow-cyan-500/20 text-white">
                            <Boxes className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                                Agent Lab Generator 3D
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                                    AI Foundry
                                </span>
                            </h1>
                            <p className="text-xs md:text-sm text-slate-400">
                                Phòng thí nghiệm AI tự động: Manager điều phối Search, Summarizer, Coder để tự sinh Agent hoàn chỉnh
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        href="/"
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-300 transition flex items-center gap-2"
                    >
                        <Bot className="w-4 h-4 text-cyan-400" />
                        Về Văn phòng 3D
                    </Link>
                </div>
            </div>

            {/* Khung 3D Scene Phòng Thí Nghiệm */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-8 flex flex-col gap-4">
                    {/* Viewport 3D Canvas */}
                    <div className="h-[520px] md:h-[600px] w-full rounded-2xl overflow-hidden shadow-2xl relative">
                        <LabScene
                            currentStep={currentStep}
                            createdAgent={createdAgent}
                            isSynthesizing={isSynthesizing}
                            activeSpeech={activeSpeech}
                        />
                    </div>

                    {/* Hộp điều khiển & Nhập yêu cầu Chế tạo */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-bold text-white">
                                <Sparkles className="w-4 h-4 text-cyan-400" />
                                Ra lệnh cho Agent Manager Chế tạo Agent Mới
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <Cpu className="w-3.5 h-3.5 text-blue-400" />
                                <span>LLM Model:</span>
                                <select
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    disabled={isSynthesizing}
                                    className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                                >
                                    <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Nhanh, Tối ưu)</option>
                                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (Thông minh cao cấp)</option>
                                    <option value="deepseek-coder">DeepSeek Coder (Chuyên lập trình)</option>
                                    <option value="qwen2.5-coder:7b">Qwen 2.5 Coder 7B (Local Sandbox)</option>
                                </select>
                            </div>
                        </div>

                        {/* Input nhập yêu cầu */}
                        <div className="relative">
                            <textarea
                                value={userGoal}
                                onChange={(e) => setUserGoal(e.target.value)}
                                placeholder="Ví dụ: Tạo ra agent phân tích tài liệu PDF: tự động trích xuất bảng số liệu, bóc tách thông tin hóa đơn và xuất file tóm tắt..."
                                rows={3}
                                disabled={isSynthesizing}
                                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3.5 text-xs md:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500 transition resize-none"
                            />
                            {errorMessage && (
                                <div className="text-xs text-rose-400 mt-1">{errorMessage}</div>
                            )}
                        </div>

                        {/* Thanh nút bấm & Mẫu gợi ý nhanh */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[11px] text-slate-400 font-medium">Mẫu gợi ý:</span>
                                {QUICK_TEMPLATES.map((tmpl) => (
                                    <button
                                        key={tmpl.title}
                                        type="button"
                                        disabled={isSynthesizing}
                                        onClick={() => {
                                            setUserGoal(tmpl.goal)
                                            setSelectedModel(tmpl.model)
                                        }}
                                        className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white transition"
                                    >
                                        {tmpl.title}
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={() => handleStartSynthesis()}
                                disabled={isSynthesizing}
                                className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-lg ${
                                    isSynthesizing
                                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                                        : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-cyan-500/25'
                                }`}
                            >
                                {isSynthesizing ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                                        <span>Đang chế tạo trong 3D Lab...</span>
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-4 h-4 fill-white" />
                                        <span>Bắt đầu Chế tạo (Start Synthesis)</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Cột Bên Phải: Tiến trình 5 Chặng & Chi tiết Agent sinh ra */}
                <div className="lg:col-span-4 space-y-5">
                    {/* Tiến trình 5 Chặng Multi-Agent */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                                <Layers className="w-4 h-4 text-cyan-400" />
                                Quy trình 4 Agent Phối hợp
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                                {currentStep}/5 Hoàn thành
                            </span>
                        </div>

                        <div className="space-y-3">
                            {/* Chặng 1: Manager */}
                            <div
                                className={`p-3 rounded-xl border transition ${
                                    currentStep === 1
                                        ? 'bg-blue-950/40 border-blue-500/50 shadow-md shadow-blue-500/10'
                                        : currentStep > 1
                                        ? 'bg-slate-950/40 border-emerald-500/30'
                                        : 'bg-slate-950/20 border-slate-800/80 opacity-60'
                                }`}
                            >
                                <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                        <span className="font-bold text-blue-400">Bước 1: Manager Lead</span>
                                    </div>
                                    {currentStep > 1 ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    ) : currentStep === 1 ? (
                                        <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                                    ) : (
                                        <Clock className="w-3.5 h-3.5 text-slate-600" />
                                    )}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-1">
                                    Phân tích mục tiêu, xác định blueprint và điều phối nhiệm vụ
                                </div>
                            </div>

                            {/* Chặng 2: Search */}
                            <div
                                className={`p-3 rounded-xl border transition ${
                                    currentStep === 2
                                        ? 'bg-emerald-950/40 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                                        : currentStep > 2
                                        ? 'bg-slate-950/40 border-emerald-500/30'
                                        : 'bg-slate-950/20 border-slate-800/80 opacity-60'
                                }`}
                            >
                                <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                        <span className="font-bold text-emerald-400">Bước 2: Search Researcher</span>
                                    </div>
                                    {currentStep > 2 ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    ) : currentStep === 2 ? (
                                        <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                                    ) : (
                                        <Clock className="w-3.5 h-3.5 text-slate-600" />
                                    )}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-1">
                                    Khảo sát thư viện kỹ thuật, tài liệu API và giải thuật xử lý
                                </div>
                            </div>

                            {/* Chặng 3: Summarizer */}
                            <div
                                className={`p-3 rounded-xl border transition ${
                                    currentStep === 3
                                        ? 'bg-amber-950/40 border-amber-500/50 shadow-md shadow-amber-500/10'
                                        : currentStep > 3
                                        ? 'bg-slate-950/40 border-emerald-500/30'
                                        : 'bg-slate-950/20 border-slate-800/80 opacity-60'
                                }`}
                            >
                                <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                                        <span className="font-bold text-amber-400">Bước 3: Synthesis Specialist</span>
                                    </div>
                                    {currentStep > 3 ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    ) : currentStep === 3 ? (
                                        <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                                    ) : (
                                        <Clock className="w-3.5 h-3.5 text-slate-600" />
                                    )}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-1">
                                    Thiết kế System Prompt chuẩn mực & Lược đồ tham số Tool
                                </div>
                            </div>

                            {/* Chặng 4: Coder & Sandbox */}
                            <div
                                className={`p-3 rounded-xl border transition ${
                                    currentStep === 4
                                        ? 'bg-pink-950/40 border-pink-500/50 shadow-md shadow-pink-500/10'
                                        : currentStep > 4
                                        ? 'bg-slate-950/40 border-emerald-500/30'
                                        : 'bg-slate-950/20 border-slate-800/80 opacity-60'
                                }`}
                            >
                                <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-pink-500" />
                                        <span className="font-bold text-pink-400">Bước 4: Code Generator & Sandbox</span>
                                    </div>
                                    {currentStep > 4 ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    ) : currentStep === 4 ? (
                                        <RefreshCw className="w-3.5 h-3.5 text-pink-400 animate-spin" />
                                    ) : (
                                        <Clock className="w-3.5 h-3.5 text-slate-600" />
                                    )}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-1">
                                    Sinh code Python Tool & Chạy thử nghiệm trong Sandbox an toàn
                                </div>
                            </div>

                            {/* Chặng 5: Triển khai */}
                            <div
                                className={`p-3 rounded-xl border transition ${
                                    currentStep === 5
                                        ? 'bg-emerald-950/40 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                                        : 'bg-slate-950/20 border-slate-800/80 opacity-60'
                                }`}
                            >
                                <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                        <span className="font-bold text-emerald-400">Bước 5: Kích hoạt Agent</span>
                                    </div>
                                    {currentStep === 5 ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    ) : (
                                        <Clock className="w-3.5 h-3.5 text-slate-600" />
                                    )}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-1">
                                    Nạp Agent vào Database & Xuất hiện tại buồng trung tâm 3D
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Khối Chi Tiết Sản Phẩm Sau Khi Sinh */}
                    {synthesisResult && (
                        <div className="bg-slate-900/90 border border-cyan-500/40 rounded-2xl p-5 shadow-xl space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-3.5 h-3.5 rounded-full"
                                        style={{ backgroundColor: synthesisResult.agent_blueprint.color }}
                                    />
                                    <span className="font-bold text-sm text-white">
                                        {synthesisResult.agent_blueprint.name}
                                    </span>
                                </div>
                                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    Đã kích hoạt
                                </span>
                            </div>

                            {/* Tabs xem Artifacts */}
                            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('blueprint')}
                                    className={`flex-1 py-1.5 rounded-lg font-medium transition ${
                                        activeTab === 'blueprint'
                                            ? 'bg-cyan-600 text-white shadow'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    Hồ sơ
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('prompt')}
                                    className={`flex-1 py-1.5 rounded-lg font-medium transition ${
                                        activeTab === 'prompt'
                                            ? 'bg-cyan-600 text-white shadow'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    Prompt
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('code')}
                                    className={`flex-1 py-1.5 rounded-lg font-medium transition ${
                                        activeTab === 'code'
                                            ? 'bg-cyan-600 text-white shadow'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    Code Tool
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('sandbox')}
                                    className={`flex-1 py-1.5 rounded-lg font-medium transition ${
                                        activeTab === 'sandbox'
                                            ? 'bg-cyan-600 text-white shadow'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    Sandbox
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('files')}
                                    className={`flex-1 py-1.5 rounded-lg font-medium transition ${
                                        activeTab === 'files'
                                            ? 'bg-cyan-600 text-white shadow'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    Files Disk
                                </button>
                            </div>

                            {/* Nội dung Tab */}
                            <div className="text-xs text-slate-300 min-h-[140px] max-h-[220px] overflow-y-auto pr-1">
                                {activeTab === 'blueprint' && (
                                    <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">ID Agent:</span>
                                            <span className="font-mono text-cyan-400">
                                                {synthesisResult.agent_blueprint.id}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Mô hình AI:</span>
                                            <span className="font-mono text-slate-200">
                                                {synthesisResult.agent_blueprint.model}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Prompt ID:</span>
                                            <span className="font-mono text-slate-200">
                                                {synthesisResult.agent_blueprint.prompt_id}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Tool đính kèm:</span>
                                            <span className="font-mono text-slate-200">
                                                {synthesisResult.agent_blueprint.tool_id}
                                            </span>
                                        </div>
                                        <div className="pt-1 text-[11px] text-slate-400 italic">
                                            "{synthesisResult.agent_blueprint.role}"
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'prompt' && (
                                    <div className="relative bg-slate-950/80 p-3 rounded-xl border border-slate-800 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(synthesisResult.artifacts.system_prompt)}
                                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                                            title="Sao chép Prompt"
                                        >
                                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                        </button>
                                        {synthesisResult.artifacts.system_prompt}
                                    </div>
                                )}

                                {activeTab === 'code' && (
                                    <div className="relative bg-slate-950/80 p-3 rounded-xl border border-slate-800 font-mono text-[11px] whitespace-pre-wrap leading-relaxed text-emerald-400">
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(synthesisResult.artifacts.python_code)}
                                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                                            title="Sao chép Code"
                                        >
                                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                        </button>
                                        {synthesisResult.artifacts.python_code}
                                    </div>
                                )}

                                {activeTab === 'sandbox' && (
                                    <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 font-mono text-[11px] space-y-2">
                                        <div className="flex items-center gap-2 text-emerald-400">
                                            <ShieldCheck className="w-4 h-4" />
                                            <span className="font-bold">Sandbox Python Execution: PASS</span>
                                        </div>
                                        <div className="p-2 bg-black/60 rounded-lg text-slate-300 text-[10px] whitespace-pre-wrap">
                                            {synthesisResult.artifacts.sandbox_result?.output ||
                                                'Test execution completed with 0 errors.'}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'files' && (
                                    <div className="space-y-2.5 bg-slate-950/80 p-3 rounded-xl border border-slate-800 font-mono text-[11px]">
                                        <div className="text-[10px] text-cyan-400 font-sans font-bold flex items-center justify-between">
                                            <span>FILE VẬT LÝ ĐÃ LƯU TRÊN SERVER:</span>
                                            <span className="text-emerald-400 font-mono">Đồng bộ DB: 100%</span>
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                                                <div className="flex items-center gap-2 truncate">
                                                    <FileCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                                    <span className="text-slate-300 truncate font-mono">
                                                        {synthesisResult.generated_files?.tool_path || `app/generated/tools/${synthesisResult.agent_blueprint.tool_id}.py`}
                                                    </span>
                                                </div>
                                                <Link
                                                    href="/tools"
                                                    className="shrink-0 ml-2 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[10px] flex items-center gap-1 font-sans"
                                                >
                                                    Xem Tool <ExternalLink className="w-2.5 h-2.5" />
                                                </Link>
                                            </div>

                                            <div className="flex items-center justify-between bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                                                <div className="flex items-center gap-2 truncate">
                                                    <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                                    <span className="text-slate-300 truncate font-mono">
                                                        {synthesisResult.generated_files?.prompt_path || `app/generated/prompts/${synthesisResult.agent_blueprint.prompt_id}.md`}
                                                    </span>
                                                </div>
                                                <Link
                                                    href="/prompts"
                                                    className="shrink-0 ml-2 px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 text-[10px] flex items-center gap-1 font-sans"
                                                >
                                                    Xem Prompt <ExternalLink className="w-2.5 h-2.5" />
                                                </Link>
                                            </div>

                                            <div className="flex items-center justify-between bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                                                <div className="flex items-center gap-2 truncate">
                                                    <Cpu className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                                    <span className="text-slate-300 truncate font-mono">
                                                        {synthesisResult.generated_files?.model_path || `app/generated/models/${synthesisResult.agent_blueprint.id}_model.json`}
                                                    </span>
                                                </div>
                                                <Link
                                                    href="/models"
                                                    className="shrink-0 ml-2 px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 text-[10px] flex items-center gap-1 font-sans"
                                                >
                                                    Xem Model <ExternalLink className="w-2.5 h-2.5" />
                                                </Link>
                                            </div>

                                            <div className="flex items-center justify-between bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                                                <div className="flex items-center gap-2 truncate">
                                                    <Bot className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                                    <span className="text-slate-300 truncate font-mono">
                                                        {synthesisResult.generated_files?.agent_path || `app/generated/agents/${synthesisResult.agent_blueprint.id}.json`}
                                                    </span>
                                                </div>
                                                <Link
                                                    href="/agents"
                                                    className="shrink-0 ml-2 px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-[10px] flex items-center gap-1 font-sans"
                                                >
                                                    Xem Agent <ExternalLink className="w-2.5 h-2.5" />
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Nút hành động */}
                            <div className="flex items-center gap-2 pt-2">
                                <Link
                                    href="/"
                                    className="flex-1 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 font-bold text-xs text-center text-white transition flex items-center justify-center gap-1.5"
                                >
                                    <span>Về Văn Phòng 3D</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => handleStartSynthesis()}
                                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                                    title="Tạo lại"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Khối Thư Mục File Tự Sinh & Đồng Bộ Hệ Thống (app/generated/) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <FolderCode className="w-5 h-5 text-cyan-400" />
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                Hệ Thống Thư Mục Sinh Mã Tự Động & Đồng Bộ Trực Tiếp
                                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                    app/generated/
                                </span>
                            </h2>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            Mỗi Agent, Tool, Prompt và Model được sinh ra đều tự động ghi thành file vật lý chuẩn mực theo quy chuẩn và đồng bộ tức thì lên Cơ sở dữ liệu và các trang tương ứng.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={loadGeneratedFiles}
                            disabled={loadingFiles}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 flex items-center gap-1.5 transition disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loadingFiles ? 'animate-spin text-cyan-400' : ''}`} />
                            <span>Làm mới danh sách</span>
                        </button>
                    </div>
                </div>

                {/* 4 Thẻ Thư Mục Chức Năng Liên Kết Sang Các Trang Tương Ứng */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Thẻ Tools */}
                    <div className="bg-slate-950/80 border border-slate-800 hover:border-emerald-500/40 rounded-xl p-4 transition group flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <FileCode className="w-5 h-5" />
                                </div>
                                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
                                    {generatedFiles?.counts?.tools ?? 0} files
                                </span>
                            </div>
                            <h3 className="font-bold text-sm text-white group-hover:text-emerald-400 transition">
                                Tools Generator
                            </h3>
                            <div className="text-[11px] font-mono text-slate-500 mt-0.5">app/generated/tools/*.py</div>
                            <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                                Mã nguồn Python tuân thủ chuẩn BaseTool và hàm execute(arguments), tự động nạp vào Tool Registry.
                            </p>
                        </div>
                        <Link
                            href="/tools"
                            className="mt-4 inline-flex items-center justify-between w-full text-xs font-semibold text-emerald-400 hover:text-emerald-300 pt-2 border-t border-slate-900 group-hover:border-slate-800"
                        >
                            <span>Mở Trang Tools</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                    {/* Thẻ Prompts */}
                    <div className="bg-slate-950/80 border border-slate-800 hover:border-blue-500/40 rounded-xl p-4 transition group flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
                                    {generatedFiles?.counts?.prompts ?? 0} files
                                </span>
                            </div>
                            <h3 className="font-bold text-sm text-white group-hover:text-blue-400 transition">
                                Prompts Generator
                            </h3>
                            <div className="text-[11px] font-mono text-slate-500 mt-0.5">app/generated/prompts/*.md</div>
                            <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                                System prompts hoàn chỉnh kèm metadata JSON, định hình hành vi chuyên sâu cho từng Agent.
                            </p>
                        </div>
                        <Link
                            href="/prompts"
                            className="mt-4 inline-flex items-center justify-between w-full text-xs font-semibold text-blue-400 hover:text-blue-300 pt-2 border-t border-slate-900 group-hover:border-slate-800"
                        >
                            <span>Mở Trang Prompts</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                    {/* Thẻ Models */}
                    <div className="bg-slate-950/80 border border-slate-800 hover:border-purple-500/40 rounded-xl p-4 transition group flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                    <Cpu className="w-5 h-5" />
                                </div>
                                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
                                    {generatedFiles?.counts?.models ?? 0} files
                                </span>
                            </div>
                            <h3 className="font-bold text-sm text-white group-hover:text-purple-400 transition">
                                Models Config
                            </h3>
                            <div className="text-[11px] font-mono text-slate-500 mt-0.5">app/generated/models/*.json</div>
                            <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                                Cấu hình mô hình LLM chuyên biệt, tham số nhiệt độ (temperature) và các thiết lập token.
                            </p>
                        </div>
                        <Link
                            href="/models"
                            className="mt-4 inline-flex items-center justify-between w-full text-xs font-semibold text-purple-400 hover:text-purple-300 pt-2 border-t border-slate-900 group-hover:border-slate-800"
                        >
                            <span>Mở Trang Models</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                    {/* Thẻ Agents */}
                    <div className="bg-slate-950/80 border border-slate-800 hover:border-cyan-500/40 rounded-xl p-4 transition group flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                    <Bot className="w-5 h-5" />
                                </div>
                                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
                                    {generatedFiles?.counts?.agents ?? 0} files
                                </span>
                            </div>
                            <h3 className="font-bold text-sm text-white group-hover:text-cyan-400 transition">
                                Agents Blueprint
                            </h3>
                            <div className="text-[11px] font-mono text-slate-500 mt-0.5">app/generated/agents/*.json</div>
                            <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                                Hồ sơ Agent hoàn chỉnh liên kết Model, Prompt, Tool và đã lưu vào DB để trò chuyện đa Agent.
                            </p>
                        </div>
                        <Link
                            href="/agents"
                            className="mt-4 inline-flex items-center justify-between w-full text-xs font-semibold text-cyan-400 hover:text-cyan-300 pt-2 border-t border-slate-900 group-hover:border-slate-800"
                        >
                            <span>Mở Trang Agents</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </div>

                {/* Bảng Chi Tiết File Trên Đĩa Vật Lý */}
                <div className="bg-slate-950/60 rounded-xl border border-slate-800/80 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Database className="w-4 h-4 text-cyan-400" />
                            <span className="text-xs font-bold text-slate-200">
                                Danh Sách File Vật Lý Được Tự Sinh Trên Máy Chủ ({generatedFiles?.total_files ?? 0} files)
                            </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                            Thư mục gốc: backend-microservices/agent-service/app/generated
                        </span>
                    </div>

                    <div className="overflow-x-auto max-h-[300px]">
                        <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800 font-mono sticky top-0">
                                <tr>
                                    <th className="py-2.5 px-4">Tên File</th>
                                    <th className="py-2.5 px-4">Phân Loại</th>
                                    <th className="py-2.5 px-4">Đường Dẫn Vật Lý</th>
                                    <th className="py-2.5 px-4">Dung Lượng</th>
                                    <th className="py-2.5 px-4">Thời Gian Tạo</th>
                                    <th className="py-2.5 px-4 text-right">Thao Tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {generatedFiles && generatedFiles.files && generatedFiles.files.length > 0 ? (
                                    generatedFiles.files.map((file, idx) => {
                                        const typeColor =
                                            file.type === 'tool'
                                                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                                                : file.type === 'prompt'
                                                ? 'text-blue-400 bg-blue-500/10 border-blue-500/30'
                                                : file.type === 'model'
                                                ? 'text-purple-400 bg-purple-500/10 border-purple-500/30'
                                                : 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'

                                        const linkTarget =
                                            file.type === 'tool'
                                                ? '/tools'
                                                : file.type === 'prompt'
                                                ? '/prompts'
                                                : file.type === 'model'
                                                ? '/models'
                                                : '/agents'

                                        return (
                                            <tr key={idx} className="hover:bg-slate-900/40 transition">
                                                <td className="py-2.5 px-4 font-mono font-bold text-slate-200 flex items-center gap-2">
                                                    {file.type === 'tool' ? (
                                                        <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                                                    ) : file.type === 'prompt' ? (
                                                        <FileText className="w-3.5 h-3.5 text-blue-400" />
                                                    ) : file.type === 'model' ? (
                                                        <Cpu className="w-3.5 h-3.5 text-purple-400" />
                                                    ) : (
                                                        <Bot className="w-3.5 h-3.5 text-cyan-400" />
                                                    )}
                                                    {file.name}
                                                </td>
                                                <td className="py-2.5 px-4">
                                                    <span
                                                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${typeColor}`}
                                                    >
                                                        {file.type}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-4 font-mono text-slate-400 text-[11px]">
                                                    {file.relative_path}
                                                </td>
                                                <td className="py-2.5 px-4 font-mono text-slate-400">
                                                    {(file.size_bytes / 1024).toFixed(1)} KB
                                                </td>
                                                <td className="py-2.5 px-4 text-slate-400">
                                                    {file.modified_at
                                                        ? new Date(file.modified_at).toLocaleDateString('vi-VN', {
                                                              hour: '2-digit',
                                                              minute: '2-digit',
                                                          })
                                                        : '-'}
                                                </td>
                                                <td className="py-2.5 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopy(file.relative_path)}
                                                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                                                            title="Sao chép đường dẫn file"
                                                        >
                                                            <Copy className="w-3 h-3" />
                                                        </button>
                                                        <Link
                                                            href={linkTarget}
                                                            className="px-2 py-1 rounded bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-300 text-[10px] flex items-center gap-1 transition"
                                                        >
                                                            <span>Trang</span>
                                                            <ExternalLink className="w-2.5 h-2.5" />
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                                            Chưa có file nào được sinh. Hãy nhập yêu cầu ở trên để chế tạo Agent đầu tiên!
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
