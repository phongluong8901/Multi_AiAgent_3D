import { request } from '../client'

export type HardwareReport = {
    cpuCores: number
    deviceMemoryGB: number
    hasWebGPU: boolean
    gpuName?: string
    vramGB?: number
    os?: string
    arch?: string
    diskFreeGB?: number
}

export type RentConfiguration = {
    allocatedCores: number
    allocatedRAMGB: number
    enableGPU: boolean
    gpuSharePercent: number
    availabilitySchedule: string
    minPricePerHourCoin: number
    autoStartWithOS?: boolean
    maxTokens?: number
    contextLength?: number
    temperature?: number
    defaultModel?: string
    maxConcurrentTasks?: number
}

export type LLMActivityStats = {
    total_requests: number
    active_requests: number
    total_tokens: number
    prompt_tokens: number
    completion_tokens: number
    tokens_per_sec: number
    last_latency_ms: number
    current_model: string
    is_busy: boolean
    status: string
}

export type ModelRecommendation = {
    modelId: string
    modelName: string
    category: string
    role?: string
    hardwareTier?: string
    tierLabel?: string
    isEligible: boolean
    matchPercent: number
    estimatedTokensPerS: number
    coinsPerHour: number
    downloadUrl?: string
    downloadSizeGB?: number
    downloadFormat?: string
    ollamaModel?: string
    runCommand?: string
    setupInstructions?: string
    setupScriptUrl?: string
    contextLength?: number
    missingRequirements?: string[]
    recommendedRentAlloc: {
        cores: number
        ramGB: number
        gpu: boolean
    }
}


export type BenchmarkResult = {
    hardware: HardwareReport
    eligibleModels: ModelRecommendation[]
    tierName: string
    tierScore: number
    estimatedMaxCoinsPerHour: number
    summaryAdvice: string
}

export type AppPackageInfo = {
    appName: string
    version: string
    releaseDate: string
    platform: string
    arch: string
    fileSizeMB: number
    downloadUrl: string
    fallbackZipUrl: string
    components: string[]
    minOSVersion: string
    installationDoc: string
}

export type PartnerNodeData = {
    id: string
    userId?: string
    username?: string
    nodeName?: string
    email?: string
    status: 'IDLE' | 'BUSY' | 'OFFLINE' | 'REGISTERED'
    hardware: HardwareReport
    rentConfig: RentConfiguration
    compatibleModels: string[]
    activeModel?: string
    totalCoinsEarned: number
    uptimeSeconds: number
    lastTelemetry?: {
        cpu_percent: number
        ram_percent: number
        disk_percent: number
        gpu_percent?: number
        timestamp: string
    }
    authToken: string
    llmStats?: LLMActivityStats
    createdAt: string
    updatedAt: string
}

export const distributedApi = {
    // 1. Gửi thông số phần cứng để nhận đánh giá và đề xuất model
    benchmarkHardware: async (hardware: HardwareReport) => {
        return await request<{ success: boolean; data: BenchmarkResult }>('/distributed/benchmark', {
            method: 'POST',
            body: JSON.stringify(hardware),
        })
    },

    // 2. Lấy danh mục toàn bộ mô hình AI hỗ trợ tính toán phân tán
    getCatalog: async () => {
        return await request<{ success: boolean; models: any[] }>('/distributed/models/catalog')
    },

    // 3. Đăng ký hoặc cập nhật Đối tác Mô hình & Cấu hình cho thuê tài nguyên
    registerPartnerNode: async (payload: {
        userId?: string
        username?: string
        email?: string
        hardware: HardwareReport
        rentConfig: RentConfiguration
    }) => {
        return await request<{
            success: boolean
            message: string
            node: PartnerNodeData
            benchmark: BenchmarkResult
            clientApp: AppPackageInfo
            configFileUrl: string
            directSetupUrl: string
        }>('/distributed/nodes/register', {
            method: 'POST',
            body: JSON.stringify(payload),
        })
    },

    // 4. Lấy thông tin Node của tài khoản hiện tại
    getMyNode: async (token?: string, userId?: string) => {
        const query = token ? `?token=${token}` : userId ? `?userId=${userId}` : ''
        return await request<{
            success: boolean
            isPartner: boolean
            node?: PartnerNodeData
            message?: string
        }>(`/distributed/nodes/me${query}`)
    },

    // 5. Lấy danh sách toàn bộ các Node trong mạng lưới
    listNodes: async () => {
        return await request<{
            success: boolean
            count: number
            nodes: PartnerNodeData[]
        }>('/distributed/nodes')
    },

    // 5b. Bật hoặc tắt trạng thái chia sẻ tài nguyên Node (ONLINE / OFFLINE)
    toggleNodeStatus: async (nodeId: string, status: 'IDLE' | 'OFFLINE' | 'PAUSED') => {
        return await request<{
            success: boolean
            nodeId: string
            status: string
            message: string
        }>('/distributed/nodes/toggle-status', {
            method: 'POST',
            body: JSON.stringify({ nodeId, status }),
        })
    },

    // 6. Lấy thông tin gói phần mềm Electron Client
    getAppPackageInfo: async () => {
        return await request<{ success: boolean; app: AppPackageInfo }>('/distributed/app/info')
    },

    // 7. Lấy chi tiết thông tin tải về và lệnh chạy nhanh của 1 Model
    getModelDownloadInfo: async (modelId: string) => {
        return await request<{ success: boolean; model: any; scriptUrl: string }>(
            `/distributed/models/download-info?id=${encodeURIComponent(modelId)}`
        )
    },

    // 8. Lấy URL tải script cài đặt tự động (.bat hoặc .sh) cho model
    getModelSetupScriptUrl: (modelId: string, os: string = 'windows') => {
        const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000'
        return `${gatewayUrl}/api/v1/distributed/models/setup-script?id=${encodeURIComponent(modelId)}&os=${os}`
    },

    // URL tải trực tiếp file cài đặt
    getDownloadAppUrl: () => {
        const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000'
        return `${gatewayUrl}/api/v1/distributed/app/download`
    },

    // URL tải file cấu hình cá nhân hóa
    getDownloadConfigFileUrl: (nodeId: string) => {
        const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000'
        return `${gatewayUrl}/api/v1/distributed/app/config-file?nodeId=${encodeURIComponent(nodeId)}`
    },

    // URL WebSocket thời gian thực từ Distributed Service (không dùng polling)
    getDistributedWsUrl: (listenerId: string = 'web_listener_client') => {
        const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000'
        const wsBase = gatewayUrl.replace(/^http/, 'ws')
        return `${wsBase}/api/v1/distributed/ws?nodeId=${encodeURIComponent(listenerId)}`
    },

    // Kiểm tra và test suy luận trực tiếp xuống máy Seller qua WebSocket/SSE stream
    testInferenceStream: async (
        params: {
            nodeId?: string
            model?: string
            prompt: string
            systemPrompt?: string
            temperature?: number
            maxTokens?: number
        },
        onChunk: (chunk: string) => void
    ): Promise<{ success: boolean; output: string; model?: string; error?: string; latencyMs: number }> => {
        const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000'
        const startTime = Date.now()

        const res = await fetch(`${gatewayUrl}/api/v1/distributed/inference`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'text/event-stream',
            },
            body: JSON.stringify({
                nodeId: params.nodeId || '',
                model: params.model || 'qwen2.5-coder:1.5b',
                prompt: params.prompt,
                systemPrompt: params.systemPrompt || 'Bạn là AI Agent thực thi chuyên nghiệp.',
                temperature: params.temperature ?? 0.7,
                maxTokens: params.maxTokens,
                stream: true,
            }),
        })

        if (!res.ok) {
            const errJson = await res.json().catch(() => ({ message: res.statusText }))
            throw new Error(errJson.message || `Lỗi kết nối (${res.status})`)
        }

        const reader = res.body?.getReader()
        if (!reader) {
            throw new Error('Trình duyệt không hỗ trợ đọc stream phản hồi')
        }

        const decoder = new TextDecoder('utf-8')
        let fullOutput = ''
        let finalModel = params.model
        let errorMsg = ''

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const rawText = decoder.decode(value, { stream: true })
            const lines = rawText.split('\n')

            for (const line of lines) {
                const trimmed = line.trim()
                if (!trimmed || !trimmed.startsWith('data:')) continue
                const jsonStr = trimmed.replace(/^data:\s*/, '')
                try {
                    const data = JSON.parse(jsonStr)
                    if (data.error) {
                        errorMsg = data.error
                    }
                    if (data.chunk) {
                        fullOutput += data.chunk
                        onChunk(data.chunk)
                    }
                    if (data.output && !fullOutput) {
                        fullOutput = data.output
                    }
                    if (data.model) {
                        finalModel = data.model
                    }
                } catch {
                    // Ignore parse error on partial boundary
                }
            }
        }

        const latencyMs = Date.now() - startTime
        if (errorMsg && !fullOutput) {
            return { success: false, output: '', error: errorMsg, latencyMs }
        }

        return {
            success: true,
            output: fullOutput,
            model: finalModel,
            latencyMs,
        }
    },
}
