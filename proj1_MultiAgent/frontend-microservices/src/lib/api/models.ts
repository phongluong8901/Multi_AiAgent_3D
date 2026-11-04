import { request } from '../client'

export type ModelType = 'cloud' | 'local_ollama' | 'local_webgpu' | 'rented_p2p'

export type ProviderId = 'google' | 'openai' | 'anthropic' | 'deepseek' | 'groq' | 'openrouter'

export type TokenStats = {
    totalQuota: number      // Tổng hạn mức token (ví dụ: 1,000,000)
    promptTokens: number    // Token đã dùng cho input prompt
    completionTokens: number // Token đã dùng cho output trả lời
    usedTokens: number      // Tổng prompt + completion đã dùng
    remainingTokens: number // Số token còn lại
    rpmLimit?: number       // Hạn mức requests/phút (ví dụ: 15)
    tpmLimit?: number       // Hạn mức tokens/phút (ví dụ: 1,000,000)
    lastUsedAt?: string
}

export type AIModel = {
    id: string
    name: string
    provider: string
    providerId?: ProviderId | 'ollama' | 'webgpu' | 'seller_p2p'
    type: ModelType
    description?: string
    contextWindow?: string
    sizeBytes?: number
    quantization?: string
    downloadStatus?: 'ready' | 'downloading' | 'not_downloaded'
    downloadProgress?: number // 0 -> 100
    tokenStats?: TokenStats
    isCustomKeyConfigured?: boolean
    // Thông tin phiên thuê Seller P2P nếu có
    rentalSessionId?: string
    nodeId?: string
    nodeName?: string
    boundAgentName?: string
    totalTokensUsed?: number
    totalCoinsSpent?: number
}

export type ProviderConfig = {
    providerId: ProviderId
    name: string
    apiKey: string
    baseUrl?: string
    isConfigured: boolean
    status: 'connected' | 'invalid' | 'untested' | 'no_key'
    models: string[]
    docsUrl: string
}

// Danh sách các mô hình Cloud tiêu chuẩn
export const DEFAULT_CLOUD_MODELS: AIModel[] = [
    {
        id: 'gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash Lite',
        provider: 'Google AI',
        providerId: 'google',
        type: 'cloud',
        description: 'Mặc định - Cực nhanh, tiết kiệm token tối đa, phản hồi tức thì cho tác vụ đa agent',
        contextWindow: '1M tokens',
    },
    {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'Google AI',
        providerId: 'google',
        type: 'cloud',
        description: 'Mô hình đa năng thế hệ mới, hỗ trợ gọi tool thông minh và suy luận sâu',
        contextWindow: '1M tokens',
    },
    {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        provider: 'Google AI',
        providerId: 'google',
        type: 'cloud',
        description: 'Bản Flash 2.0 cân bằng tốc độ, chi phí và độ chính xác',
        contextWindow: '1M tokens',
    },
    {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        provider: 'Google AI',
        providerId: 'google',
        type: 'cloud',
        description: 'Mô hình ổn định cao, dự phòng tin cậy cho toàn bộ hệ sinh thái workflow',
        contextWindow: '1M tokens',
    },
    {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'Google AI',
        providerId: 'google',
        type: 'cloud',
        description: 'Mô hình suy luận hàng đầu, ngữ cảnh 2M tokens, phân tích báo cáo & mã nguồn lớn',
        contextWindow: '2M tokens',
    },
    {
        id: 'gpt-4o',
        name: 'GPT-4o (Omni)',
        provider: 'OpenAI',
        providerId: 'openai',
        type: 'cloud',
        description: 'Mô hình đa thể thức cao cấp của OpenAI, tối ưu cho xử lý hình ảnh và logic phức tạp',
        contextWindow: '128K tokens',
    },
    {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'OpenAI',
        providerId: 'openai',
        type: 'cloud',
        description: 'Bản rút gọn siêu nhanh, chi phí thấp, thay thế xuất sắc cho GPT-3.5',
        contextWindow: '128K tokens',
    },
    {
        id: 'claude-3-5-sonnet',
        name: 'Claude 3.5 Sonnet',
        provider: 'Anthropic',
        providerId: 'anthropic',
        type: 'cloud',
        description: 'Khả năng viết code và suy luận nhân bản số 1 thế giới',
        contextWindow: '200K tokens',
    },
    {
        id: 'deepseek-chat',
        name: 'DeepSeek-V3',
        provider: 'DeepSeek',
        providerId: 'deepseek',
        type: 'cloud',
        description: 'Mô hình mã nguồn mở MoE hàng đầu Trung Quốc, giá cực rẻ, xử lý ngôn ngữ tự nhiên tốt',
        contextWindow: '64K tokens',
    },
    {
        id: 'deepseek-reasoner',
        name: 'DeepSeek-R1 (Reasoning)',
        provider: 'DeepSeek',
        providerId: 'deepseek',
        type: 'cloud',
        description: 'Mô hình chuỗi suy luận (Chain-of-Thought) sánh ngang o1, chuyên giải toán và lập trình',
        contextWindow: '64K tokens',
    },
    {
        id: 'deepseek-coder',
        name: 'DeepSeek Coder V2',
        provider: 'DeepSeek',
        providerId: 'deepseek',
        type: 'cloud',
        description: 'Chuyên biệt cho sinh mã nguồn Python, tối ưu thuật toán và giải quyết bài toán kỹ thuật',
        contextWindow: '128K tokens',
    },
]

// Danh sách mô hình Ollama Local khuyên dùng (Phương án A)
export const RECOMMENDED_OLLAMA_MODELS: AIModel[] = [
    {
        id: 'qwen2.5-coder:7b',
        name: 'Qwen 2.5 Coder (7B)',
        provider: 'Alibaba (Ollama)',
        providerId: 'ollama',
        type: 'local_ollama',
        description: 'Chuyên gia sinh mã nguồn Python, tự động fix lỗi và viết unit test chuẩn mực',
        contextWindow: '128K tokens',
        sizeBytes: 4.7 * 1024 * 1024 * 1024,
        quantization: 'Q4_K_M',
    },
    {
        id: 'llama3.2-vision:11b',
        name: 'Llama 3.2 Vision (11B)',
        provider: 'Meta (Ollama)',
        providerId: 'ollama',
        type: 'local_ollama',
        description: 'Mô hình Multimodal cục bộ: nhận diện ảnh, đọc chữ OCR và phân loại vật thể ngoại tuyến',
        contextWindow: '128K tokens',
        sizeBytes: 7.9 * 1024 * 1024 * 1024,
        quantization: 'Q4_K_M',
    },
    {
        id: 'llama3.2:1b',
        name: 'Llama 3.2 (1B)',
        provider: 'Meta (Ollama)',
        providerId: 'ollama',
        type: 'local_ollama',
        description: 'Siêu nhẹ, tải nhanh (1.3GB), chạy mượt trên máy RAM 4GB hoặc không có GPU rời',
        contextWindow: '128K tokens',
        sizeBytes: 1.3 * 1024 * 1024 * 1024,
        quantization: 'Q4_K_M',
    },
    {
        id: 'llama3.2:3b',
        name: 'Llama 3.2 (3B)',
        provider: 'Meta (Ollama)',
        providerId: 'ollama',
        type: 'local_ollama',
        description: 'Lựa chọn cân bằng hoàn hảo giữa tốc độ và trí tuệ (2.0GB), khuyên dùng cho RAM 8GB',
        contextWindow: '128K tokens',
        sizeBytes: 2.0 * 1024 * 1024 * 1024,
        quantization: 'Q4_K_M',
    },
    {
        id: 'qwen2.5:1.5b',
        name: 'Qwen 2.5 (1.5B)',
        provider: 'Alibaba (Ollama)',
        providerId: 'ollama',
        type: 'local_ollama',
        description: 'Rất giỏi tiếng Việt và toán học/coding (1.1GB), xử lý câu từ tự nhiên nhất',
        contextWindow: '32K tokens',
        sizeBytes: 1.1 * 1024 * 1024 * 1024,
        quantization: 'Q4_K_M',
    },
    {
        id: 'deepseek-r1:1.5b',
        name: 'DeepSeek R1 (1.5B Reasoning)',
        provider: 'DeepSeek (Ollama)',
        providerId: 'ollama',
        type: 'local_ollama',
        description: 'Mô hình suy luận từng bước cục bộ chạy hoàn toàn offline, phân tích logic bài bản',
        contextWindow: '32K tokens',
        sizeBytes: 1.1 * 1024 * 1024 * 1024,
        quantization: 'Q4_K_M',
    },
    {
        id: 'mistral:7b',
        name: 'Mistral (7B)',
        provider: 'Mistral AI (Ollama)',
        providerId: 'ollama',
        type: 'local_ollama',
        description: 'Mô hình 7B tiêu chuẩn công nghiệp (4.1GB), khuyên dùng cho máy có RAM 16GB hoặc RTX GPU',
        contextWindow: '32K tokens',
        sizeBytes: 4.1 * 1024 * 1024 * 1024,
        quantization: 'Q4_0',
    },
    {
        id: 'gemma2:2b',
        name: 'Gemma 2 (2B)',
        provider: 'Google (Ollama)',
        providerId: 'ollama',
        type: 'local_ollama',
        description: 'Mô hình gọn nhẹ của Google (1.6GB), phản hồi chuẩn xác cho các tác vụ trả lời ngắn',
        contextWindow: '8K tokens',
        sizeBytes: 1.6 * 1024 * 1024 * 1024,
        quantization: 'Q4_K_M',
    },
]

// Danh sách mô hình WebGPU In-Browser (Phương án B)
export const RECOMMENDED_WEBGPU_MODELS: AIModel[] = [
    {
        id: 'SmolLM2-135M-Instruct-q4f16',
        name: 'SmolLM2 (135M WebGPU)',
        provider: 'Hugging Face (In-Browser)',
        providerId: 'webgpu',
        type: 'local_webgpu',
        description: 'Cực nhẹ (~90MB), tải và chạy trực tiếp 100% trong trình duyệt qua card GPU người dùng',
        contextWindow: '2K tokens',
        sizeBytes: 90 * 1024 * 1024,
        quantization: 'q4f16',
    },
    {
        id: 'Qwen2.5-0.5B-Instruct-q4f16',
        name: 'Qwen 2.5 (0.5B WebGPU)',
        provider: 'Alibaba (In-Browser)',
        providerId: 'webgpu',
        type: 'local_webgpu',
        description: 'Mô hình nhỏ gọn (~350MB), hỗ trợ tốt tiếng Việt cơ bản ngay trên tab trình duyệt',
        contextWindow: '4K tokens',
        sizeBytes: 350 * 1024 * 1024,
        quantization: 'q4f16',
    },
    {
        id: 'Llama-3.2-1B-Instruct-q4f16',
        name: 'Llama 3.2 (1B WebGPU)',
        provider: 'Meta (In-Browser)',
        providerId: 'webgpu',
        type: 'local_webgpu',
        description: 'Mô hình 1 tỷ tham số chạy trực tiếp bằng WebGPU (~850MB), bảo mật tuyệt đối 0% gửi dữ liệu ra ngoài',
        contextWindow: '8K tokens',
        sizeBytes: 850 * 1024 * 1024,
        quantization: 'q4f16',
    },
]

// --- QUẢN LÝ LƯU TRỮ API KEYS (LOCALSTORAGE) ---
const STORAGE_KEY_API_KEYS = 'ai_agent_user_api_keys'
const STORAGE_KEY_TOKEN_USAGE = 'ai_agent_token_usage_stats'
const STORAGE_KEY_OLLAMA_HOST = 'ai_agent_ollama_host'

export function getStoredApiKeys(): Record<ProviderId, string> {
    if (typeof window === 'undefined') return {} as Record<ProviderId, string>
    try {
        const raw = localStorage.getItem(STORAGE_KEY_API_KEYS)
        return raw ? JSON.parse(raw) : ({} as Record<ProviderId, string>)
    } catch {
        return {} as Record<ProviderId, string>
    }
}

export function saveStoredApiKey(provider: ProviderId, key: string): void {
    if (typeof window === 'undefined') return
    try {
        const current = getStoredApiKeys()
        if (key.trim()) {
            current[provider] = key.trim()
        } else {
            delete current[provider]
        }
        localStorage.setItem(STORAGE_KEY_API_KEYS, JSON.stringify(current))
    } catch (e) {
        console.error('Không thể lưu API Key vào LocalStorage:', e)
    }
}

// --- QUẢN LÝ THEO DÕI TOKEN USAGE ---
export function getTokenUsageMap(): Record<string, TokenStats> {
    if (typeof window === 'undefined') return {}
    try {
        const raw = localStorage.getItem(STORAGE_KEY_TOKEN_USAGE)
        return raw ? JSON.parse(raw) : {}
    } catch {
        return {}
    }
}

export function getModelTokenStats(modelId: string, defaultQuota = 1000000): TokenStats {
    const map = getTokenUsageMap()
    if (map[modelId]) {
        return map[modelId]
    }
    // Mặc định cho model mới: 1.000.000 tokens quota free tier
    const initial: TokenStats = {
        totalQuota: defaultQuota,
        promptTokens: 0,
        completionTokens: 0,
        usedTokens: 0,
        remainingTokens: defaultQuota,
        rpmLimit: 15,
        tpmLimit: 1000000,
    }
    return initial
}

export function recordTokenUsage(
    modelId: string,
    promptTokens: number,
    completionTokens: number
): TokenStats {
    const map = getTokenUsageMap()
    const current = map[modelId] || getModelTokenStats(modelId)
    const newPrompt = (current.promptTokens || 0) + promptTokens
    const newCompletion = (current.completionTokens || 0) + completionTokens
    const newUsed = newPrompt + newCompletion
    const newRemaining = Math.max(0, current.totalQuota - newUsed)

    const updated: TokenStats = {
        ...current,
        promptTokens: newPrompt,
        completionTokens: newCompletion,
        usedTokens: newUsed,
        remainingTokens: newRemaining,
        lastUsedAt: new Date().toISOString(),
    }

    map[modelId] = updated
    if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_TOKEN_USAGE, JSON.stringify(map))
    }
    return updated
}

export function resetTokenUsage(modelId: string, newQuota?: number): TokenStats {
    const map = getTokenUsageMap()
    const current = map[modelId] || getModelTokenStats(modelId)
    const totalQuota = newQuota !== undefined ? newQuota : current.totalQuota
    const resetStats: TokenStats = {
        totalQuota,
        promptTokens: 0,
        completionTokens: 0,
        usedTokens: 0,
        remainingTokens: totalQuota,
        lastUsedAt: undefined,
    }
    map[modelId] = resetStats
    if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_TOKEN_USAGE, JSON.stringify(map))
    }
    return resetStats
}

// --- QUẢN LÝ OLLAMA LOCAL HOST ---
export function getOllamaHost(): string {
    if (typeof window === 'undefined') return 'http://localhost:11434'
    return localStorage.getItem(STORAGE_KEY_OLLAMA_HOST) || 'http://localhost:11434'
}

export function setOllamaHost(host: string): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_KEY_OLLAMA_HOST, host.trim())
}

/** Kiểm tra kết nối tới máy chủ Ollama trên máy người dùng */
export async function checkOllamaConnection(host = getOllamaHost()): Promise<{
    connected: boolean
    version?: string
    error?: string
}> {
    try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 2500)
        const res = await fetch(`${host}/api/version`, {
            method: 'GET',
            signal: controller.signal,
        })
        clearTimeout(timeoutId)
        if (res.ok) {
            const data = await res.json()
            return { connected: true, version: data.version || '0.x' }
        }
        return { connected: false, error: `HTTP ${res.status}` }
    } catch (err: any) {
        return { connected: false, error: err.message || 'Không thể kết nối đến Ollama' }
    }
}

/** Lấy danh sách các model đã cài sẵn trên máy người dùng qua Ollama */
export async function listInstalledOllamaModels(host = getOllamaHost()): Promise<AIModel[]> {
    try {
        const res = await fetch(`${host}/api/tags`, { method: 'GET' })
        if (!res.ok) return []
        const data = await res.json()
        const models = data.models || []
        return models.map((m: any) => ({
            id: m.name,
            name: m.name,
            provider: 'Ollama (Local Machine)',
            providerId: 'ollama',
            type: 'local_ollama' as ModelType,
            description: `Model cục bộ • Kích thước: ${(m.size / (1024 * 1024 * 1024)).toFixed(2)} GB`,
            sizeBytes: m.size,
            quantization: m.details?.quantization_level || 'Q4',
            downloadStatus: 'ready' as const,
            downloadProgress: 100,
        }))
    } catch {
        return []
    }
}

/** Tải model về máy qua Ollama stream */
export async function pullOllamaModel(
    modelName: string,
    onProgress: (status: string, completed: number, total: number) => void,
    host = getOllamaHost()
): Promise<boolean> {
    try {
        const res = await fetch(`${host}/api/pull`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName, stream: true }),
        })

        if (!res.ok || !res.body) {
            throw new Error(`Ollama pull error: ${res.statusText}`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
                if (!line.trim()) continue
                try {
                    const parsed = JSON.parse(line)
                    const status = parsed.status || 'Đang tải...'
                    const completed = parsed.completed || 0
                    const total = parsed.total || 0
                    onProgress(status, completed, total)
                } catch {
                    // ignore malformed line
                }
            }
        }
        return true
    } catch (err: any) {
        console.error('Lỗi tải model Ollama:', err)
        throw err
    }
}

/** Xóa model khỏi Ollama trên máy người dùng */
export async function deleteOllamaModel(modelName: string, host = getOllamaHost()): Promise<boolean> {
    try {
        const res = await fetch(`${host}/api/delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName }),
        })
        return res.ok
    } catch {
        return false
    }
}

/** Lấy danh sách model tổng hợp (Cloud + Backend + Rented Seller P2P) */
export async function listModels(): Promise<AIModel[]> {
    let result: AIModel[] = []
    try {
        const backendModels = await request<AIModel[]>('/models')
        if (Array.isArray(backendModels) && backendModels.length > 0) {
            result = backendModels.map((m) => ({
                ...m,
                type: m.type || 'cloud',
                tokenStats: getModelTokenStats(m.id),
            }))
        }
    } catch {
        result = DEFAULT_CLOUD_MODELS.map((m) => ({
            ...m,
            tokenStats: getModelTokenStats(m.id),
        }))
    }

    if (result.length === 0) {
        result = DEFAULT_CLOUD_MODELS.map((m) => ({
            ...m,
            tokenStats: getModelTokenStats(m.id),
        }))
    }

    // Tích hợp các mô hình mà Owner đang thuê từ Seller (P2P Mesh Network)
    try {
        const rentalsRes = await request<{ success: boolean; count?: number; rentals?: any[]; activeRentals?: any[] }>('/owner/rentals/my')
        const activeList = (rentalsRes?.rentals || rentalsRes?.activeRentals || []).filter((r: any) => r.status === 'ACTIVE')
        if (activeList.length > 0) {
            const rentedModels: AIModel[] = activeList.map((r: any) => {
                const sId = r.sessionId || r.id || r._id || ''
                return {
                    id: `rented:${sId}`,
                    name: `[P2P Thuê] ${r.nodeName} - ${r.modelDisplayName || r.modelKey || 'Local AI'}`,
                    provider: `Seller Trạm: ${r.nodeName}`,
                    providerId: 'seller_p2p' as any,
                    type: 'rented_p2p' as ModelType,
                    description: `Mô hình chạy trực tiếp trên máy Seller (${r.nodeName}). Đã dùng ${(r.totalTokensUsed || 0).toLocaleString()} tokens.`,
                    contextWindow: '32k',
                    rentalSessionId: sId,
                    nodeId: r.nodeId,
                    nodeName: r.nodeName,
                    boundAgentName: r.boundAgentName || r.assignedAgentId,
                    totalTokensUsed: r.totalTokensUsed || 0,
                    totalCoinsSpent: r.totalCoinsSpent || 0,
                }
            })
            // Đưa các model P2P đã thuê lên đầu danh sách để ưu tiên chọn cho Agent
            result = [...rentedModels, ...result]
        }
    } catch {
        // Không chặn nếu offline hoặc chưa thuê máy
    }

    return result
}