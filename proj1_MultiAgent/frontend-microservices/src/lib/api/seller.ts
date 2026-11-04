import { request } from '../client'

export interface SellerNodeData {
    id: string
    nodeId?: string
    sellerId: string
    sellerName: string
    nodeName: string
    cpuCores: number
    ramGB: number
    gpuName: string
    vramGB: number
    localEndpoint: string
    hostedModel: string
    modelDisplayName: string
    category?: string
    locationName?: string
    distanceKm?: number
    coinsPerHour?: number
    coinsPer1kTokens?: number
    pricing: {
        coinsPerHour: number
        coinsPer1kTokens: number
    }
    status: 'ONLINE' | 'BUSY' | 'OFFLINE'
    uptimeMinutes?: number
    totalTasksCompleted?: number
    totalTokensServed: number
    totalCoinsEarned: number
    totalInferenceRequests?: number
    rating: number
    createdAt?: string
    lastActive?: string
}

export interface InferenceLogData {
    id: string
    taskId?: string
    nodeId: string
    nodeName: string
    renterId: string
    modelId?: string
    promptSummary?: string
    prompt?: string
    output?: string
    responsePreview?: string
    tokensGenerated?: number
    tokens?: number
    latencyMs: number
    coinsEarned?: number
    coinsBilled?: number
    timestamp?: string
    createdAt?: string
}

export interface SellerDashboardData {
    summary: {
        totalNodes: number
        onlineNodes?: number
        activeNodesCount?: number
        totalCoinsEarned: number
        totalTokensServed: number
        totalTasksCompleted?: number
        totalInferenceRequests?: number
        avgRating?: number
    }
    nodes: SellerNodeData[]
    recentLogs?: InferenceLogData[]
    recentTasks?: InferenceLogData[]
}

export const sellerApi = {
    // 1. Lấy danh sách máy cho thuê trên Marketplace có lọc khoảng cách
    getMarketplaceNodes: async (params?: { model?: string; maxPrice?: number; lng?: number; lat?: number; radiusKm?: number }) => {
        const query = new URLSearchParams()
        if (params?.model) query.append('model', params.model)
        if (params?.maxPrice !== undefined) query.append('maxPrice', params.maxPrice.toString())
        if (params?.lng !== undefined) query.append('lng', params.lng.toString())
        if (params?.lat !== undefined) query.append('lat', params.lat.toString())
        if (params?.radiusKm !== undefined) query.append('radiusKm', params.radiusKm.toString())

        return await request<{ success: boolean; count: number; nodes: SellerNodeData[] }>(
            `/seller/nodes/market?${query.toString()}`
        )
    },

    // 2. Lấy danh sách máy của tôi
    getMyNodes: async (sellerId?: string) => {
        const query = sellerId ? `?sellerId=${encodeURIComponent(sellerId)}` : ''
        return await request<{ success: boolean; count: number; nodes: SellerNodeData[] }>(
            `/seller/nodes/my${query}`
        )
    },

    // 3. Đăng ký máy cho thuê mới
    registerNode: async (payload: Partial<SellerNodeData> & { lng?: number; lat?: number; locationName?: string }) => {
        return await request<{ success: boolean; message: string; node: SellerNodeData }>(
            '/seller/nodes/register',
            {
                method: 'POST',
                body: JSON.stringify(payload),
            }
        )
    },

    // 4. Bật / Tắt trạng thái nhận việc (ONLINE / OFFLINE)
    toggleNodeStatus: async (nodeId: string, status: 'ONLINE' | 'OFFLINE' | 'BUSY') => {
        return await request<{ success: boolean; message: string; node: SellerNodeData }>(
            `/seller/nodes/${nodeId}/status`,
            {
                method: 'PATCH',
                body: JSON.stringify({ status }),
            }
        )
    },

    // 5. Cập nhật giá thuê
    updatePricing: async (nodeId: string, pricing: { coinsPerHour?: number; coinsPer1kTokens?: number }) => {
        return await request<{ success: boolean; message: string; node: SellerNodeData }>(
            `/seller/nodes/${nodeId}/pricing`,
            {
                method: 'PATCH',
                body: JSON.stringify(pricing),
            }
        )
    },

    // 6. Lấy dashboard thống kê
    getSellerDashboard: async (sellerId?: string) => {
        const query = sellerId ? `?sellerId=${encodeURIComponent(sellerId)}` : ''
        return await request<{ success: boolean } & SellerDashboardData>(
            `/seller/dashboard${query}`
        )
    },
}