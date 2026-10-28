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
}
