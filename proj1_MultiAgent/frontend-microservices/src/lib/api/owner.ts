import { request } from '../client'
import { SellerNodeData } from './seller'

export interface RentalSessionData {
    id?: string
    sessionId?: string
    _id?: string
    renterId: string
    renterName?: string
    nodeId: string
    nodeName: string
    sellerId?: string
    sellerName?: string
    modelId?: string
    modelKey?: string
    modelDisplayName: string
    pricingMode?: 'hourly' | 'pay_per_token'
    hourlyRate?: number
    tokenRate?: number
    coinsPerHour?: number
    coinsPer1kTokens?: number
    status: 'ACTIVE' | 'PAUSED' | 'COMPLETED'
    boundAgentId?: string
    boundAgentName?: string
    assignedAgentId?: string
    totalRequests?: number
    totalTokensUsed: number
    totalCoinsSpent: number
    startedAt?: string
    startTime?: string
    lastUsedAt?: string
    endedAt?: string
}

export interface AgentInferenceRecordData {
    id: string
    rentalId: string
    nodeId: string
    nodeName: string
    modelId: string
    agentName: string
    prompt: string
    response: string
    tokens: number
    latencyMs: number
    coinsDeducted: number
    timestamp: string
}

export interface OwnerDashboardData {
    summary: {
        activeRentalsCount: number
        totalRentalsCount: number
        totalCoinsSpent: number
        totalTokensConsumed: number
        totalRequests: number
    }
    activeRentals: RentalSessionData[]
    recentInferences: AgentInferenceRecordData[]
}

export const ownerApi = {
    // 1. Duyệt danh sách máy cho thuê trên Marketplace
    getMarketplace: async (params?: { model?: string; maxPrice?: number; lng?: number; lat?: number; radiusKm?: number }) => {
        const query = new URLSearchParams()
        if (params?.model) query.append('model', params.model)
        if (params?.maxPrice !== undefined) query.append('maxPrice', params.maxPrice.toString())
        if (params?.lng !== undefined) query.append('lng', params.lng.toString())
        if (params?.lat !== undefined) query.append('lat', params.lat.toString())
        if (params?.radiusKm !== undefined) query.append('radiusKm', params.radiusKm.toString())
        return await request<{ success: boolean; count: number; nodes: SellerNodeData[] }>(
            `/owner/marketplace?${query.toString()}`
        )
    },

    // 2. Bắt đầu thuê 1 Node máy tính của Seller
    startRental: async (payload: {
        renterId?: string
        renterName?: string
        nodeId: string
        nodeName: string
        sellerId: string
        sellerName: string
        modelId: string
        modelDisplayName: string
        pricingMode?: 'hourly' | 'pay_per_token'
        hourlyRate: number
        tokenRate: number
        agentId?: string
        agentName?: string
    }) => {
        return await request<{ success: boolean; message: string; rental: RentalSessionData }>(
            '/owner/rentals/start',
            {
                method: 'POST',
                body: JSON.stringify(payload),
            }
        )
    },

    // 3. Dừng phiên thuê
    stopRental: async (rentalId: string) => {
        return await request<{ success: boolean; message: string; rental: RentalSessionData }>(
            `/owner/rentals/${rentalId}/stop`,
            {
                method: 'POST',
            }
        )
    },

    // 4. Lấy danh sách các máy đang/đã thuê của tôi
    getMyRentals: async (renterId?: string) => {
        const query = renterId ? `?renterId=${encodeURIComponent(renterId)}` : ''
        return await request<{ success: boolean; count: number; rentals: RentalSessionData[] }>(
            `/owner/rentals/my${query}`
        )
    },

    // 5. Gán mô hình thuê vào 1 Agent cụ thể
    bindAgent: async (rentalId: string, agentId: string, agentName?: string) => {
        return await request<{ success: boolean; message: string; rental: RentalSessionData }>(
            '/owner/agents/bind',
            {
                method: 'POST',
                body: JSON.stringify({ rentalId, agentId, agentName }),
            }
        )
    },

    // 6. THỰC THI AI: Agent gửi prompt qua máy tính Seller
    runInference: async (payload: {
        rentalId?: string
        prompt: string
        systemPrompt?: string
    }) => {
        return await request<{
            success: boolean
            output: string
            tokens: number
            latencyMs: number
            coinsBilled: number
            rentalSession: {
                id: string
                nodeName: string
                modelName: string
                boundAgentName: string
                totalCoinsSpent: number
            }
        }>('/owner/agents/inference', {
            method: 'POST',
            body: JSON.stringify(payload),
        })
    },

    // 7. Lấy dashboard tổng quan của Owner
    getOwnerDashboard: async (renterId?: string) => {
        const query = renterId ? `?renterId=${encodeURIComponent(renterId)}` : ''
        return await request<{ success: boolean } & OwnerDashboardData>(
            `/owner/dashboard${query}`
        )
    },
}
