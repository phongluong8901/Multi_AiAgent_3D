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
        totalTokensUsed?: number
        totalRequests: number
        availableCoinsBalance?: number
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
        rentalSessionId?: string
        agentId?: string
        prompt: string
        systemPrompt?: string
    }) => {
        const rentalSessionId = payload.rentalSessionId || payload.rentalId || ''
        return await request<{
            success: boolean
            output: string
            tokens: number
            latencyMs: number
            coinsBilled: number
            nodeName?: string
            modelName?: string
            rentalSession?: {
                id: string
                nodeName: string
                modelName: string
                boundAgentName: string
                totalCoinsSpent: number
            }
        }>('/owner/agents/inference', {
            method: 'POST',
            body: JSON.stringify({
                ...payload,
                rentalId: rentalSessionId,
                rentalSessionId,
            }),
        })
    },

    // 6b. THỰC THI AI STREAMING: Ghép kênh SSE trực tiếp từ Worker lên UI
    runInferenceStream: async (
        payload: {
            rentalId?: string
            rentalSessionId?: string
            agentId?: string
            prompt: string
            systemPrompt?: string
            temperature?: number
            maxTokens?: number
        },
        onChunk: (chunk: string) => void
    ): Promise<{
        success: boolean
        output: string
        tokens: number
        latencyMs: number
        coinsBilled: number
        nodeName?: string
        modelName?: string
    }> => {
        const rentalSessionId = payload.rentalSessionId || payload.rentalId || ''
        const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000'
        const startTime = Date.now()

        const res = await fetch(`${gatewayUrl}/api/v1/owner/agents/inference`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'text/event-stream',
            },
            body: JSON.stringify({
                ...payload,
                rentalId: rentalSessionId,
                rentalSessionId,
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
        let nodeName = ''
        let modelName = ''

        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const text = decoder.decode(value, { stream: true })
            const lines = text.split('\n')
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const json = JSON.parse(line.slice(6))
                        if (json.error) {
                            throw new Error(json.error)
                        }
                        if (json.chunk) {
                            fullOutput += json.chunk
                            onChunk(json.chunk)
                        }
                        if (json.output && !fullOutput) {
                            fullOutput = json.output
                            onChunk(json.output)
                        }
                        if (json.model) modelName = json.model
                        if (json.nodeName) nodeName = json.nodeName
                    } catch (parseErr: any) {
                        if (parseErr.message && !parseErr.message.includes('Unexpected token')) {
                            throw parseErr
                        }
                    }
                }
            }
        }

        const latencyMs = Date.now() - startTime
        const tokens = Math.max(1, Math.round(fullOutput.length / 3.8))
        const coinsBilled = Number(Math.max(0.01, (tokens / 1000) * 0.5).toFixed(4))

        return {
            success: true,
            output: fullOutput,
            tokens,
            latencyMs,
            coinsBilled,
            nodeName,
            modelName,
        }
    },

    // 7. Lấy dashboard tổng quan của Owner
    getOwnerDashboard: async (renterId?: string) => {
        const query = renterId
            ? `?ownerId=${encodeURIComponent(renterId)}&renterId=${encodeURIComponent(renterId)}`
            : ''
        return await request<{ success: boolean } & OwnerDashboardData>(
            `/owner/dashboard${query}`
        )
    },

    // 8. Lấy toàn bộ các phiên kết nối Seller ⇄ Owner đang truyền tải LLM
    getActiveConnections: async () => {
        return await request<{ success: boolean; count: number; sessions: RentalSessionData[] }>(
            '/owner/connections/active'
        )
    },
}
