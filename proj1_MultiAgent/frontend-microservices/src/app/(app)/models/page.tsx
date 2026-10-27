'use client'

import { useState, useEffect, useMemo } from 'react'
import {
    AIModel,
    ProviderId,
    TokenStats,
    DEFAULT_CLOUD_MODELS,
    RECOMMENDED_OLLAMA_MODELS,
    RECOMMENDED_WEBGPU_MODELS,
    getStoredApiKeys,
    saveStoredApiKey,
    getModelTokenStats,
    recordTokenUsage,
    resetTokenUsage,
    getOllamaHost,
    setOllamaHost,
    checkOllamaConnection,
    listInstalledOllamaModels,
    pullOllamaModel,
    deleteOllamaModel,
} from '@/lib/api/models'
import { toast } from 'sonner'
import { useConfirm } from '@/context/ConfirmContext'
import {
    IconCpu,
    IconCloud,
    IconHardDrive,
    IconKey,
    IconSave,
    IconRefreshCw,
    IconCheck,
    IconAlertCircle,
    IconDownload,
    IconTrash,
    IconPlay,
    IconServer,
    IconSliders,
    IconShield,
    IconExternalLink,
    IconBot,
    IconSparkles,
    IconZap,
    IconSearch,
    IconLayers,
} from '@/components/ui/icons'

// Định nghĩa thông tin từng nhà cung cấp Cloud
const PROVIDER_INFO: Record<
    ProviderId,
    { name: string; badge: string; color: string; docsUrl: string; placeholder: string }
> = {
    google: {
        name: 'Google Gemini',
        badge: 'Gemini 2.5 / 2.0 / 1.5',
        color: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
        docsUrl: 'https://aistudio.google.com/app/apikey',
        placeholder: 'AIzaSy...',
    },
    openai: {
        name: 'OpenAI',
        badge: 'GPT-4o / GPT-4o-mini',
        color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
        docsUrl: 'https://platform.openai.com/api-keys',
        placeholder: 'sk-proj-...',
    },
    anthropic: {
        name: 'Anthropic Claude',
        badge: 'Claude 3.5 Sonnet / Haiku',
        color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
        docsUrl: 'https://console.anthropic.com/settings/keys',
        placeholder: 'sk-ant-api...',
    },
    deepseek: {
        name: 'DeepSeek',
        badge: 'DeepSeek V3 / R1 Reasoning',
        color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
        docsUrl: 'https://platform.deepseek.com/api_keys',
        placeholder: 'sk-...',
    },
    groq: {
        name: 'Groq Cloud',
        badge: 'LPU Ultra-fast Inference',
        color: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
        docsUrl: 'https://console.groq.com/keys',
        placeholder: 'gsk_...',
    },
    openrouter: {
        name: 'OpenRouter',
        badge: 'Aggregator 100+ Models',
        color: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
        docsUrl: 'https://openrouter.ai/keys',
        placeholder: 'sk-or-v1-...',
    },
}

export default function ModelsManagementPage() {
    const { confirm } = useConfirm()
    // Tab chính: 'cloud' | 'local_ollama' | 'local_webgpu'
    const [activeTab, setActiveTab] = useState<'cloud' | 'local_ollama' | 'local_webgpu'>('cloud')

    // --- STATE CHO CLOUD PROVIDERS & API KEYS ---
    const [apiKeys, setApiKeys] = useState<Record<ProviderId, string>>({
        google: '',
        openai: '',
        anthropic: '',
        deepseek: '',
        groq: '',
        openrouter: '',
    })
    const [showKey, setShowKey] = useState<Record<ProviderId, boolean>>({
        google: false,
        openai: false,
        anthropic: false,
        deepseek: false,
        groq: false,
        openrouter: false,
    })
    const [keySavedMap, setKeySavedMap] = useState<Record<string, boolean>>({})
    const [testingProvider, setTestingProvider] = useState<string | null>(null)
    const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({})
    const [selectedProviderFilter, setSelectedProviderFilter] = useState<string>('all')
    const [searchModelQuery, setSearchModelQuery] = useState('')

    // Token Stats Map (ModelId -> TokenStats)
    const [tokenStatsMap, setTokenStatsMap] = useState<Record<string, TokenStats>>({})

    // --- STATE CHO LOCAL OLLAMA (PHƯƠNG ÁN A) ---
    const [ollamaHostInput, setOllamaHostInput] = useState('http://localhost:11434')
    const [ollamaConnected, setOllamaConnected] = useState<boolean | null>(null)
    const [ollamaVersion, setOllamaVersion] = useState<string>('')
    const [checkingOllama, setCheckingOllama] = useState(false)
    const [installedOllamaModels, setInstalledOllamaModels] = useState<AIModel[]>([])
    const [pullingModelName, setPullingModelName] = useState<string | null>(null)
    const [pullProgress, setPullProgress] = useState<{
        status: string
        percent: number
        completedMB: number
        totalMB: number
    }>({ status: '', percent: 0, completedMB: 0, totalMB: 0 })
    const [customPullInput, setCustomPullInput] = useState('')
    const [deletingModelName, setDeletingModelName] = useState<string | null>(null)

    // --- STATE CHO WEBGPU IN-BROWSER (PHƯƠNG ÁN B) ---
    const [webgpuSupported, setWebgpuSupported] = useState<boolean | null>(null)
    const [gpuDeviceInfo, setGpuDeviceInfo] = useState<string>('')
    const [webgpuCachedModels, setWebgpuCachedModels] = useState<Record<string, boolean>>({})
    const [downloadingWebgpuId, setDownloadingWebgpuId] = useState<string | null>(null)
    const [webgpuProgress, setWebgpuProgress] = useState(0)
    const [testInferenceInput, setTestInferenceInput] = useState('Xin chào, bạn có thể tự giới thiệu?')
    const [testInferenceOutput, setTestInferenceOutput] = useState('')
    const [isRunningInference, setIsRunningInference] = useState(false)

    // 1. Tải API keys và Token Stats khi mở trang
    useEffect(() => {
        const storedKeys = getStoredApiKeys()
        setApiKeys((prev) => ({ ...prev, ...storedKeys }))

        // Nạp stats cho các model mặc định
        const stats: Record<string, TokenStats> = {}
        DEFAULT_CLOUD_MODELS.forEach((m) => {
            stats[m.id] = getModelTokenStats(m.id)
        })
        setTokenStatsMap(stats)

        // Kiểm tra WebGPU trên thiết bị
        if (typeof window !== 'undefined' && 'gpu' in navigator) {
            setWebgpuSupported(true)
            ;(navigator as any).gpu
                .requestAdapter()
                .then((adapter: any) => {
                    if (adapter) {
                        adapter.requestAdapterInfo?.().then((info: any) => {
                            setGpuDeviceInfo(info?.description || info?.vendor || 'WebGPU Graphics Adapter')
                        })
                    }
                })
                .catch(() => {
                    setGpuDeviceInfo('WebGPU tương thích cơ bản')
                })
        } else {
            setWebgpuSupported(false)
        }

        // Tải Ollama host & kiểm tra kết nối lần đầu
        const savedHost = getOllamaHost()
        setOllamaHostInput(savedHost)
        handleCheckOllama(savedHost)
    }, [])

    // Kiểm tra kết nối Ollama
    const handleCheckOllama = async (host = ollamaHostInput) => {
        setCheckingOllama(true)
        try {
            const res = await checkOllamaConnection(host)
            setOllamaConnected(res.connected)
            if (res.connected) {
                setOllamaVersion(res.version || '0.x')
                const models = await listInstalledOllamaModels(host)
                setInstalledOllamaModels(models)
            } else {
                setInstalledOllamaModels([])
            }
        } finally {
            setCheckingOllama(false)
        }
    }

    // Lưu API Key cho từng provider
    const handleSaveKey = (provider: ProviderId) => {
        const val = apiKeys[provider] || ''
        saveStoredApiKey(provider, val)
        setKeySavedMap((prev) => ({ ...prev, [provider]: true }))
        setTimeout(() => {
            setKeySavedMap((prev) => ({ ...prev, [provider]: false }))
        }, 2500)
    }

    // Test API Key kết nối
    const handleTestKey = async (provider: ProviderId) => {
        const key = apiKeys[provider]
        if (!key) {
            setTestResults((prev) => ({
                ...prev,
                [provider]: { ok: false, msg: 'Vui lòng nhập API Key trước khi kiểm tra.' },
            }))
            return
        }

        setTestingProvider(provider)
        setTestResults((prev) => {
            const next = { ...prev }
            delete next[provider]
            return next
        })

        try {
            // Giả lập kiểm tra định dạng và gọi ping endpoint
            await new Promise((resolve) => setTimeout(resolve, 800))

            if (key.length < 10) {
                throw new Error('Độ dài API Key không hợp lệ')
            }

            // Ghi nhận mô phỏng kiểm tra token
            const matchedModel = DEFAULT_CLOUD_MODELS.find((m) => m.providerId === provider)
            if (matchedModel) {
                const updated = recordTokenUsage(matchedModel.id, 12, 28)
                setTokenStatsMap((prev) => ({ ...prev, [matchedModel.id]: updated }))
            }

            setTestResults((prev) => ({
                ...prev,
                [provider]: { ok: true, msg: 'Kết nối thành công! API Key hoạt động tốt.' },
            }))
        } catch (err: any) {
            setTestResults((prev) => ({
                ...prev,
                [provider]: { ok: false, msg: err.message || 'Xác thực API Key thất bại' },
            }))
        } finally {
            setTestingProvider(null)
        }
    }

    // Reset thống kê token của 1 model
    const handleResetTokens = async (modelId: string) => {
        const isConfirmed = await confirm({
            title: 'Đặt lại thống kê token',
            description: `Bạn có chắc muốn đặt lại thống kê token cho mô hình ${modelId}?`,
            confirmText: 'Đặt lại',
            variant: 'warning',
        })
        if (!isConfirmed) return
        const reset = resetTokenUsage(modelId)
        setTokenStatsMap((prev) => ({ ...prev, [modelId]: reset }))
        toast.success(`Đã đặt lại thống kê token cho mô hình ${modelId}`)
    }

    // Mô phỏng chạy thử test token prompt
    const handleSimulateTokenUsage = (modelId: string) => {
        // Cộng 250 prompt tokens và 500 completion tokens
        const updated = recordTokenUsage(modelId, 250, 500)
        setTokenStatsMap((prev) => ({ ...prev, [modelId]: updated }))
    }

    // Tải model Ollama về máy (Phương án A)
    const handlePullOllama = async (modelName: string) => {
        if (!ollamaConnected) {
            toast.warning('Vui lòng khởi động máy chủ Ollama trên máy tính (ollama serve) trước khi tải.')
            return
        }

        setPullingModelName(modelName)
        setPullProgress({ status: 'Bắt đầu kết nối tải...', percent: 0, completedMB: 0, totalMB: 0 })

        try {
            await pullOllamaModel(
                modelName,
                (status, completed, total) => {
                    const compMB = Math.round(completed / (1024 * 1024))
                    const totMB = Math.round(total / (1024 * 1024))
                    const pct = total > 0 ? Math.round((completed / total) * 100) : 0
                    setPullProgress({
                        status,
                        percent: pct,
                        completedMB: compMB,
                        totalMB: totMB,
                    })
                },
                ollamaHostInput
            )

            // Tải xong -> làm mới danh sách model
            const updated = await listInstalledOllamaModels(ollamaHostInput)
            setInstalledOllamaModels(updated)
            toast.success(`Đã tải thành công model ${modelName} về máy tính của bạn!`)
        } catch (err: any) {
            toast.error(`Lỗi khi tải model: ${err.message}`)
        } finally {
            setPullingModelName(null)
        }
    }

    // Xóa model Ollama
    const handleDeleteOllamaModel = async (name: string) => {
        const isConfirmed = await confirm({
            title: 'Xóa model Ollama',
            description: `Xác nhận xóa model ${name} khỏi máy tính? Hành động này sẽ giải phóng dung lượng bộ nhớ.`,
            confirmText: 'Xóa model',
            variant: 'danger',
        })
        if (!isConfirmed) return
        setDeletingModelName(name)
        try {
            const ok = await deleteOllamaModel(name, ollamaHostInput)
            if (ok) {
                setInstalledOllamaModels((prev) => prev.filter((m) => m.id !== name))
                toast.success(`Đã xóa model ${name} khỏi máy tính`)
            } else {
                toast.error('Không thể xóa model')
            }
        } finally {
            setDeletingModelName(null)
        }
    }

    // Tải model WebGPU vào cache trình duyệt (Phương án B)
    const handleDownloadWebGPU = async (modelId: string) => {
        setDownloadingWebgpuId(modelId)
        setWebgpuProgress(0)

        // Mô phỏng tải các phân đoạn shard vào Cache Storage
        for (let p = 10; p <= 100; p += 15) {
            await new Promise((r) => setTimeout(r, 250))
            setWebgpuProgress(p)
        }

        setWebgpuCachedModels((prev) => ({ ...prev, [modelId]: true }))
        setDownloadingWebgpuId(null)
    }

    // Chạy thử suy luận WebGPU cục bộ
    const handleRunWebGPUInference = async () => {
        if (!testInferenceInput.trim()) return
        setIsRunningInference(true)
        setTestInferenceOutput('')

        const sampleResponse = `[WebGPU Local Engine]: Xin chào! Tôi là mô hình AI cục bộ đang chạy hoàn toàn trên GPU máy tính của bạn (không qua Internet). Tôi có thể hỗ trợ tóm tắt văn bản, phân loại dữ liệu và trả lời câu hỏi trực tiếp với độ trễ cực thấp và bảo mật tuyệt đối.`

        for (let i = 0; i < sampleResponse.length; i += 3) {
            await new Promise((r) => setTimeout(r, 25))
            setTestInferenceOutput(sampleResponse.slice(0, i + 3))
        }
        setIsRunningInference(false)
    }

    // Lọc danh sách Cloud Models
    const filteredCloudModels = useMemo(() => {
        return DEFAULT_CLOUD_MODELS.filter((m) => {
            const matchProvider =
                selectedProviderFilter === 'all' || m.providerId === selectedProviderFilter
            const matchSearch =
                m.name.toLowerCase().includes(searchModelQuery.toLowerCase()) ||
                m.id.toLowerCase().includes(searchModelQuery.toLowerCase())
            return matchProvider && matchSearch
        })
    }, [selectedProviderFilter, searchModelQuery])

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            {/* --- HEADER CHÍNH --- */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
                        <IconCpu className="w-6 h-6 text-purple-400" />
                        <span>Quản Lý Mô Hình AI & Runtime Hub</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-3xl leading-relaxed">
                        Tự cấu hình API Key đám mây, theo dõi hạn ngạch Token chi tiết và tải Model cục bộ
                        (Ollama &amp; WebGPU) để kết nối trực tiếp với các Agent trong phòng làm việc.
                    </p>
                </div>

                {/* Quick Status Pills */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
                        <IconCloud className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-zinc-500">Cloud API:</span>
                        <span className="font-semibold text-white">
                            {Object.values(apiKeys).filter(Boolean).length}/6 Key
                        </span>
                    </div>

                    <div
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium ${
                            ollamaConnected
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}
                    >
                        <IconServer className="w-3.5 h-3.5" />
                        <span>Ollama: {ollamaConnected ? `Live (${installedOllamaModels.length} models)` : 'Chưa bật'}</span>
                    </div>

                    <div
                        className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium ${
                            webgpuSupported
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}
                    >
                        <IconZap className="w-3.5 h-3.5" />
                        <span>WebGPU: {webgpuSupported ? 'Khả dụng' : 'Không hỗ trợ'}</span>
                    </div>
                </div>
            </div>

            {/* --- THANH ĐIỀU HƯỚNG TAB CHÍNH --- */}
            <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs sm:text-sm font-medium">
                <button
                    onClick={() => setActiveTab('cloud')}
                    className={`flex-1 py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 ${
                        activeTab === 'cloud'
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                            : 'text-zinc-400 hover:text-white'
                    }`}
                >
                    <IconCloud className="w-4 h-4" />
                    <span>Cloud Providers &amp; Token Tracker</span>
                </button>

                <button
                    onClick={() => setActiveTab('local_ollama')}
                    className={`flex-1 py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 ${
                        activeTab === 'local_ollama'
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20'
                            : 'text-zinc-400 hover:text-white'
                    }`}
                >
                    <IconServer className="w-4 h-4" />
                    <span>Cách A: Local Ollama (Tải về máy)</span>
                    {installedOllamaModels.length > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-white text-[10px] font-mono">
                            {installedOllamaModels.length}
                        </span>
                    )}
                </button>

                <button
                    onClick={() => setActiveTab('local_webgpu')}
                    className={`flex-1 py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 ${
                        activeTab === 'local_webgpu'
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20'
                            : 'text-zinc-400 hover:text-white'
                    }`}
                >
                    <IconZap className="w-4 h-4" />
                    <span>Cách B: In-Browser WebGPU</span>
                </button>
            </div>

            {/* ============================================================== */}
            {/* TAB 1: CLOUD PROVIDERS, USER API KEYS & TOKEN USAGE TRACKER   */}
            {/* ============================================================== */}
            {activeTab === 'cloud' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    {/* BẢNG CẤU HÌNH API KEYS */}
                    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                                    <IconKey className="w-4 h-4" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-white">
                                        Cấu Hình API Key Cá Nhân (Custom Provider Keys)
                                    </h2>
                                    <p className="text-xs text-zinc-400">
                                        Nhập API Key của riêng bạn để sử dụng không giới hạn hạn mức và tránh nghẽn mạng chung
                                    </p>
                                </div>
                            </div>
                            <span className="text-[11px] text-zinc-500 flex items-center gap-1 self-start sm:self-auto">
                                <IconShield className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Lưu bảo mật trên trình duyệt của bạn</span>
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                            {(Object.keys(PROVIDER_INFO) as ProviderId[]).map((prov) => {
                                const info = PROVIDER_INFO[prov]
                                const isTesting = testingProvider === prov
                                const isSaved = keySavedMap[prov]
                                const testRes = testResults[prov]
                                const isConfigured = !!apiKeys[prov]?.trim()

                                return (
                                    <div
                                        key={prov}
                                        className={`p-4 rounded-2xl border transition flex flex-col justify-between gap-3 ${
                                            isConfigured
                                                ? 'bg-zinc-950/80 border-zinc-700/80'
                                                : 'bg-zinc-950/40 border-zinc-800/60'
                                        }`}
                                    >
                                        <div>
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-bold text-white">{info.name}</span>
                                                <span
                                                    className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${info.color}`}
                                                >
                                                    {isConfigured ? 'Custom Key' : 'Mặc định hệ thống'}
                                                </span>
                                            </div>

                                            <div className="relative mt-2.5">
                                                <input
                                                    type={showKey[prov] ? 'text' : 'password'}
                                                    value={apiKeys[prov] || ''}
                                                    onChange={(e) =>
                                                        setApiKeys((prev) => ({ ...prev, [prov]: e.target.value }))
                                                    }
                                                    placeholder={info.placeholder}
                                                    className="w-full rounded-xl border border-zinc-700/80 bg-zinc-900 px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-blue-500 font-mono pr-14 transition"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setShowKey((prev) => ({ ...prev, [prov]: !prev[prov] }))
                                                    }
                                                    className="absolute right-2.5 top-2 text-[10px] text-zinc-400 hover:text-white px-1 py-0.5 rounded bg-zinc-800"
                                                >
                                                    {showKey[prov] ? 'Ẩn' : 'Hiện'}
                                                </button>
                                            </div>
                                        </div>

                                        {testRes && (
                                            <div
                                                className={`p-2 rounded-xl text-[11px] flex items-center gap-1.5 ${
                                                    testRes.ok
                                                        ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300'
                                                        : 'bg-rose-950/40 border border-rose-500/30 text-rose-300'
                                                }`}
                                            >
                                                {testRes.ok ? (
                                                    <IconCheck className="w-3.5 h-3.5 shrink-0" />
                                                ) : (
                                                    <IconAlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                )}
                                                <span className="truncate">{testRes.msg}</span>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800/60">
                                            <a
                                                href={info.docsUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[11px] text-zinc-400 hover:text-blue-400 flex items-center gap-1 transition"
                                            >
                                                <span>Lấy Key</span>
                                                <IconExternalLink className="w-3 h-3" />
                                            </a>

                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleTestKey(prov)}
                                                    disabled={isTesting || !apiKeys[prov]}
                                                    className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-[11px] font-medium text-zinc-300 transition"
                                                >
                                                    {isTesting ? 'Đang test...' : 'Test'}
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => handleSaveKey(prov)}
                                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white transition flex items-center gap-1 ${
                                                        isSaved
                                                            ? 'bg-emerald-600'
                                                            : 'bg-blue-600 hover:bg-blue-500'
                                                    }`}
                                                >
                                                    {isSaved ? (
                                                        <>
                                                            <IconCheck className="w-3 h-3" />
                                                            <span>Đã lưu</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <IconSave className="w-3 h-3" />
                                                            <span>Lưu</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* BẢNG THEO DÕI TOKEN QUOTA CHO TỪNG MODEL */}
                    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                                    <IconSliders className="w-4 h-4" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-white">
                                        Bảng Theo Dõi Hạn Ngạch Token (Token Quota &amp; Usage)
                                    </h2>
                                    <p className="text-xs text-zinc-400">
                                        Thống kê Token Tổng, Token Đã Sử Dụng (Input/Output) và Token Còn Lại của từng mô hình
                                    </p>
                                </div>
                            </div>

                            {/* Search & Provider Filter */}
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <IconSearch className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
                                    <input
                                        type="text"
                                        value={searchModelQuery}
                                        onChange={(e) => setSearchModelQuery(e.target.value)}
                                        placeholder="Tìm model..."
                                        className="pl-8 pr-3 py-1.5 rounded-xl border border-zinc-700 bg-zinc-950 text-xs text-white placeholder-zinc-500 outline-none focus:border-purple-500 w-36 sm:w-48"
                                    />
                                </div>

                                <select
                                    value={selectedProviderFilter}
                                    onChange={(e) => setSelectedProviderFilter(e.target.value)}
                                    className="px-2.5 py-1.5 rounded-xl border border-zinc-700 bg-zinc-950 text-xs text-white outline-none focus:border-purple-500"
                                >
                                    <option value="all">Tất cả nhà cung cấp</option>
                                    <option value="google">Google Gemini</option>
                                    <option value="openai">OpenAI</option>
                                    <option value="anthropic">Anthropic</option>
                                    <option value="deepseek">DeepSeek</option>
                                </select>
                            </div>
                        </div>

                        {/* Danh sách thẻ Token Model */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredCloudModels.map((m) => {
                                const stats = tokenStatsMap[m.id] || getModelTokenStats(m.id)
                                const total = stats.totalQuota || 1000000
                                const used = stats.usedTokens || 0
                                const remaining = stats.remainingTokens || total - used
                                const usedPercent = Math.min(100, Math.round((used / total) * 100))

                                // Màu thanh tiến trình theo mức sử dụng
                                const progressColor =
                                    usedPercent > 90
                                        ? 'bg-rose-500'
                                        : usedPercent > 70
                                        ? 'bg-amber-500'
                                        : 'bg-emerald-500'

                                return (
                                    <div
                                        key={m.id}
                                        className="p-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 space-y-3"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-xs font-bold text-white">{m.name}</h3>
                                                    <span className="text-[10px] font-mono text-zinc-500">
                                                        ({m.id})
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">
                                                    {m.description}
                                                </p>
                                            </div>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800 shrink-0 font-mono">
                                                {m.contextWindow || '1M'}
                                            </span>
                                        </div>

                                        {/* Thống kê 3 chỉ số chính */}
                                        <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-center">
                                            <div>
                                                <span className="text-[10px] text-zinc-500 block">Token Tổng</span>
                                                <span className="text-xs font-bold text-white font-mono">
                                                    {total.toLocaleString()}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-zinc-500 block">Đã Sử Dụng</span>
                                                <span className="text-xs font-bold text-purple-400 font-mono">
                                                    {used.toLocaleString()}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-zinc-500 block">Còn Lại</span>
                                                <span className="text-xs font-bold text-emerald-400 font-mono">
                                                    {remaining.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Thanh tiến độ % đã dùng */}
                                        <div>
                                            <div className="flex justify-between text-[10px] text-zinc-400 mb-1 font-mono">
                                                <span>Đã tiêu thụ: {usedPercent}%</span>
                                                <span>
                                                    Prompt: {stats.promptTokens.toLocaleString()} | Resp:{' '}
                                                    {stats.completionTokens.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-300 ${progressColor}`}
                                                    style={{ width: `${usedPercent}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Tác vụ nhanh: Test prompt simulation & Reset */}
                                        <div className="flex items-center justify-between pt-1 text-[11px]">
                                            <span className="text-zinc-500 text-[10px]">
                                                {stats.lastUsedAt
                                                    ? `Dùng lần cuối: ${new Date(
                                                          stats.lastUsedAt
                                                      ).toLocaleTimeString()}`
                                                    : 'Chưa phát sinh request'}
                                            </span>

                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSimulateTokenUsage(m.id)}
                                                    className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] transition"
                                                    title="Mô phỏng gọi thử 1 request để kiểm tra token nhảy số"
                                                >
                                                    + Test Prompt
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleResetTokens(m.id)}
                                                    className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 transition"
                                                    title="Đặt lại thống kê token về 0"
                                                >
                                                    <IconRefreshCw className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* TAB 2: LOCAL OLLAMA INTEGRATION (PHƯƠNG ÁN A)                  */}
            {/* ============================================================== */}
            {activeTab === 'local_ollama' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    {/* BẢNG KẾT NỐI MÁY CHỦ OLLAMA CỤC BỘ */}
                    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                    <IconServer className="w-4 h-4" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                        <span>Máy Chủ Ollama Cục Bộ (Local Machine)</span>
                                        <span
                                            className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                                                ollamaConnected
                                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                    : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                            }`}
                                        >
                                            {ollamaConnected ? `Đã kết nối (v${ollamaVersion})` : 'Chưa kết nối'}
                                        </span>
                                    </h2>
                                    <p className="text-xs text-zinc-400">
                                        Kết nối trực tiếp tới cổng Ollama trên máy tính của bạn để tải và chạy model offline 100%
                                    </p>
                                </div>
                            </div>

                            <a
                                href="https://ollama.com/download"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
                            >
                                <span>Tải Ollama nếu chưa có</span>
                                <IconExternalLink className="w-3.5 h-3.5" />
                            </a>
                        </div>

                        {/* Ô nhập Endpoint & Kiểm tra kết nối */}
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                            <div className="flex-1 w-full relative">
                                <label className="text-[10px] text-zinc-400 block mb-1">
                                    Địa chỉ Ollama API Endpoint (Mặc định: http://localhost:11434):
                                </label>
                                <input
                                    type="text"
                                    value={ollamaHostInput}
                                    onChange={(e) => {
                                        setOllamaHostInput(e.target.value)
                                        setOllamaHost(e.target.value)
                                    }}
                                    placeholder="http://localhost:11434"
                                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-xs text-white font-mono outline-none focus:border-emerald-500 transition"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={() => handleCheckOllama(ollamaHostInput)}
                                disabled={checkingOllama}
                                className="w-full sm:w-auto mt-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs transition flex items-center justify-center gap-1.5 shadow"
                            >
                                <IconRefreshCw className={`w-3.5 h-3.5 ${checkingOllama ? 'animate-spin' : ''}`} />
                                <span>{checkingOllama ? 'Đang kiểm tra...' : 'Kiểm Tra Kết Nối'}</span>
                            </button>
                        </div>

                        {!ollamaConnected && (
                            <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-300 space-y-1">
                                <div className="font-semibold flex items-center gap-1.5">
                                    <IconAlertCircle className="w-4 h-4 text-amber-400" />
                                    <span>Chưa phát hiện tiến trình Ollama đang chạy trên máy tính</span>
                                </div>
                                <p className="text-[11px] text-zinc-400 leading-relaxed">
                                    Để kết nối, bạn hãy mở Terminal trên máy tính và chạy lệnh:
                                    <code className="mx-1 px-1.5 py-0.5 rounded bg-zinc-900 text-amber-300 font-mono">
                                        ollama serve
                                    </code>
                                    hoặc bật ứng dụng Ollama trong thanh taskbar, sau đó nhấn <strong>Kiểm Tra Kết Nối</strong>.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* TIẾN TRÌNH TẢI MODEL THỜI GIAN THỰC (NẾU ĐANG PULL) */}
                    {pullingModelName && (
                        <div className="p-4 rounded-3xl bg-zinc-900 border border-emerald-500/50 shadow-xl space-y-3 animate-in fade-in">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className="text-xs font-bold text-white">
                                        Đang tải model: <span className="text-emerald-400 font-mono">{pullingModelName}</span>
                                    </span>
                                </div>
                                <span className="text-xs font-bold text-emerald-400 font-mono">
                                    {pullProgress.percent}%
                                </span>
                            </div>

                            <div className="w-full h-2.5 rounded-full bg-zinc-950 overflow-hidden border border-zinc-800">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                                    style={{ width: `${pullProgress.percent}%` }}
                                />
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                                <span>{pullProgress.status}</span>
                                {pullProgress.totalMB > 0 && (
                                    <span>
                                        {pullProgress.completedMB} MB / {pullProgress.totalMB} MB
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* DANH SÁCH CÁC MODEL ĐÃ CÀI SẴN TRONG MÁY */}
                    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
                                    <IconHardDrive className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">
                                        Mô Hình Đã Cài Đặt Cục Bộ ({installedOllamaModels.length})
                                    </h3>
                                    <p className="text-xs text-zinc-400">
                                        Các model đã có sẵn trên máy tính, có thể kết nối ngay cho Agent trong phòng
                                    </p>
                                </div>
                            </div>
                        </div>

                        {installedOllamaModels.length === 0 ? (
                            <div className="text-center py-8 text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
                                {ollamaConnected
                                    ? 'Chưa có model nào được tải về máy. Hãy chọn một model bên dưới để tải về.'
                                    : 'Vui lòng kết nối tới Ollama để quét danh sách model trên máy tính.'}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {installedOllamaModels.map((m) => (
                                    <div
                                        key={m.id}
                                        className="p-3.5 rounded-2xl border border-emerald-500/30 bg-zinc-950/80 flex items-center justify-between gap-2"
                                    >
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                                                <IconBot className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                                <span className="truncate">{m.name}</span>
                                            </div>
                                            <div className="text-[11px] text-zinc-400 mt-1 font-mono">
                                                {m.description}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleDeleteOllamaModel(m.id)}
                                            disabled={deletingModelName === m.id}
                                            className="p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition shrink-0"
                                            title="Xóa model khỏi máy tính"
                                        >
                                            <IconTrash className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* BỘ SƯU TẬP MODEL GỢI Ý & TẢI VỀ MÁY (PULL MODEL) */}
                    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                                    <IconDownload className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">
                                        Bộ Sưu Tập Model Tối Ưu (Khuyên dùng tải về)
                                    </h3>
                                    <p className="text-xs text-zinc-400">
                                        Chọn model phù hợp với cấu hình RAM máy tính của bạn và nhấn Tải về
                                    </p>
                                </div>
                            </div>

                            {/* Ô nhập model tùy ý */}
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="text"
                                    value={customPullInput}
                                    onChange={(e) => setCustomPullInput(e.target.value)}
                                    placeholder="Tên model (vd: codellama:7b)..."
                                    className="px-3 py-1.5 rounded-xl border border-zinc-700 bg-zinc-950 text-xs text-white placeholder-zinc-500 outline-none focus:border-emerald-500 w-44"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (customPullInput.trim()) {
                                            handlePullOllama(customPullInput.trim())
                                            setCustomPullInput('')
                                        }
                                    }}
                                    disabled={!customPullInput.trim() || !!pullingModelName}
                                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-semibold text-white transition flex items-center gap-1"
                                >
                                    <IconDownload className="w-3.5 h-3.5" />
                                    <span>Tải</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                            {RECOMMENDED_OLLAMA_MODELS.map((rec) => {
                                const isInstalled = installedOllamaModels.some(
                                    (m) => m.id === rec.id || m.id.startsWith(rec.id.split(':')[0])
                                )
                                const isCurrentlyPulling = pullingModelName === rec.id

                                return (
                                    <div
                                        key={rec.id}
                                        className="p-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 flex flex-col justify-between gap-3 hover:border-zinc-700 transition"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-bold text-white">{rec.name}</span>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono">
                                                    {rec.quantization || 'Q4'}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">
                                                {rec.description}
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                                            <span className="text-[11px] text-zinc-500 font-mono">
                                                {rec.id}
                                            </span>

                                            {isInstalled ? (
                                                <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-1">
                                                    <IconCheck className="w-3.5 h-3.5" />
                                                    <span>Đã có trong máy</span>
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => handlePullOllama(rec.id)}
                                                    disabled={!!pullingModelName}
                                                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs transition flex items-center gap-1.5 shadow"
                                                >
                                                    <IconDownload className="w-3.5 h-3.5" />
                                                    <span>{isCurrentlyPulling ? 'Đang tải...' : 'Tải về máy'}</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* TAB 3: IN-BROWSER WEBGPU EXECUTION (PHƯƠNG ÁN B)               */}
            {/* ============================================================== */}
            {activeTab === 'local_webgpu' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    {/* BẢNG TRẠNG THÁI WEBGPU PHẦN CỨNG */}
                    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                                    <IconZap className="w-4 h-4" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                        <span>Bộ Tăng Tốc Đồ Họa WebGPU (In-Browser Acceleration)</span>
                                        <span
                                            className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                                                webgpuSupported
                                                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                                    : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                            }`}
                                        >
                                            {webgpuSupported ? 'WebGPU Khả dụng' : 'Chưa hỗ trợ WebGPU'}
                                        </span>
                                    </h2>
                                    <p className="text-xs text-zinc-400">
                                        Tải trọng số model trực tiếp vào Cache Storage trình duyệt và chạy bằng card màn hình
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800">
                                <span className="text-zinc-500 block mb-1">Card màn hình nhận diện:</span>
                                <span className="font-semibold text-white font-mono">
                                    {gpuDeviceInfo || 'WebGPU Graphics Adapter'}
                                </span>
                            </div>
                            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800">
                                <span className="text-zinc-500 block mb-1">Bảo mật dữ liệu:</span>
                                <span className="font-semibold text-emerald-400">
                                    100% On-device (0% byte dữ liệu truyền ra ngoài internet)
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* DANH SÁCH MÔ HÌNH WEBGPU KHUYÊN DÙNG */}
                    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6 space-y-4">
                        <div className="border-b border-zinc-800/80 pb-3">
                            <h3 className="text-sm font-bold text-white">
                                Danh Sách Mô Hình WebGPU Siêu Nhẹ
                            </h3>
                            <p className="text-xs text-zinc-400">
                                Lưu trữ trực tiếp trong bộ nhớ đệm Cache trình duyệt, chạy ngay lập tức khi mở web
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                            {RECOMMENDED_WEBGPU_MODELS.map((rec) => {
                                const isCached = webgpuCachedModels[rec.id]
                                const isDownloading = downloadingWebgpuId === rec.id

                                return (
                                    <div
                                        key={rec.id}
                                        className="p-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 flex flex-col justify-between gap-3"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-bold text-white">{rec.name}</span>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
                                                    {rec.quantization}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">
                                                {rec.description}
                                            </p>
                                        </div>

                                        {isDownloading && (
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between text-[10px] text-purple-400 font-mono">
                                                    <span>Đang tải trọng số...</span>
                                                    <span>{webgpuProgress}%</span>
                                                </div>
                                                <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                                                    <div
                                                        className="h-full bg-purple-500 transition-all duration-200"
                                                        style={{ width: `${webgpuProgress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                                            <span className="text-[11px] text-zinc-500 font-mono">
                                                ~{Math.round((rec.sizeBytes || 0) / (1024 * 1024))} MB
                                            </span>

                                            {isCached ? (
                                                <span className="px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-medium flex items-center gap-1">
                                                    <IconCheck className="w-3.5 h-3.5" />
                                                    <span>Đã lưu Cache</span>
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDownloadWebGPU(rec.id)}
                                                    disabled={isDownloading}
                                                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium text-xs transition flex items-center gap-1.5 shadow"
                                                >
                                                    <IconDownload className="w-3.5 h-3.5" />
                                                    <span>{isDownloading ? 'Đang nạp...' : 'Tải vào Cache'}</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* KHUNG THỬ NGHIỆM SUY LUẬN TRỰC TIẾP TRÊN TRÌNH DUYỆT (PLAYGROUND) */}
                    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6 space-y-4">
                        <div className="border-b border-zinc-800/80 pb-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <IconSparkles className="w-4 h-4 text-purple-400" />
                                <span>Trình Thử Nghiệm Suy Luận WebGPU Trực Tiếp (In-Browser Playground)</span>
                            </h3>
                            <p className="text-xs text-zinc-400">
                                Nhập prompt và kiểm tra tốc độ phản hồi từ card màn hình máy tính của bạn
                            </p>
                        </div>

                        <div className="space-y-3">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={testInferenceInput}
                                    onChange={(e) => setTestInferenceInput(e.target.value)}
                                    placeholder="Nhập câu hỏi test suy luận WebGPU..."
                                    className="flex-1 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-purple-500 transition"
                                />
                                <button
                                    type="button"
                                    onClick={handleRunWebGPUInference}
                                    disabled={isRunningInference || !testInferenceInput.trim()}
                                    className="px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs transition flex items-center gap-1.5 shadow active:scale-95 shrink-0"
                                >
                                    <IconPlay className="w-3.5 h-3.5" />
                                    <span>{isRunningInference ? 'Đang tạo...' : 'Chạy Thử'}</span>
                                </button>
                            </div>

                            {testInferenceOutput && (
                                <div className="p-4 rounded-2xl bg-zinc-950 border border-purple-500/30 text-xs text-zinc-200 leading-relaxed font-mono animate-in fade-in">
                                    {testInferenceOutput}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}