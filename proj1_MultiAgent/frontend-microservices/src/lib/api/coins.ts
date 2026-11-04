// src/lib/api/coins.ts
const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000'

export interface UserWallet {
    userId: string
    userName: string
    balance: number
    totalEarned: number
    totalSpent: number
    updatedAt: string
}

export interface PlanTaskItem {
    code: string
    title: string
    description: string
    category: 'map_creation' | 'iot_devices' | 'robotics' | 'engagement'
    rewardCoins: number
    icon: string
    targetCount: number
    unit: string
    currentProgress: number
    isCompleted: boolean
    isClaimed: boolean
}

export interface CoinTransaction {
    transactionId: string
    userId: string
    amount: number
    type: string
    reason: string
    source: string
    metadata?: any
    createdAt: string
}

export const coinsApi = {
    // 1. Lấy ví của user
    async getWallet(userId: string, userName?: string): Promise<UserWallet | null> {
        try {
            const query = userName ? `?userName=${encodeURIComponent(userName)}` : ''
            const res = await fetch(`${GATEWAY_URL}/api/v1/coins/wallet/${userId}${query}`)
            const data = await res.json()
            if (data.success) return data.data
            return null
        } catch (err) {
            console.error('Lỗi getWallet:', err)
            return null
        }
    },

    // 2. Vòi nhận coin thử nghiệm (+500 Coins)
    async faucet(userId: string): Promise<{ success: boolean; message: string; wallet?: UserWallet }> {
        try {
            const res = await fetch(`${GATEWAY_URL}/api/v1/coins/faucet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, amount: 500 }),
            })
            return await res.json()
        } catch (err: any) {
            return { success: false, message: err.message || 'Lỗi nhận coin faucet' }
        }
    },

    // 3. Lấy danh sách nhiệm vụ Plan Tasks
    async getTasks(userId: string): Promise<PlanTaskItem[]> {
        try {
            const res = await fetch(`${GATEWAY_URL}/api/v1/coins/tasks/${userId}`)
            const data = await res.json()
            if (data.success && Array.isArray(data.data)) {
                return data.data
            }
            return []
        } catch (err) {
            console.error('Lỗi getTasks:', err)
            return []
        }
    },

    // 4. Nhận thưởng từ nhiệm vụ đã hoàn thành
    async claimTask(userId: string, taskCode: string): Promise<{ success: boolean; message: string; rewardCoins?: number; wallet?: UserWallet }> {
        try {
            const res = await fetch(`${GATEWAY_URL}/api/v1/coins/tasks/claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, taskCode }),
            })
            return await res.json()
        } catch (err: any) {
            return { success: false, message: err.message || 'Lỗi nhận thưởng' }
        }
    },

    // 5. Lịch sử giao dịch
    async getTransactions(userId: string): Promise<CoinTransaction[]> {
        try {
            const res = await fetch(`${GATEWAY_URL}/api/v1/coins/transactions/${userId}`)
            const data = await res.json()
            if (data.success && Array.isArray(data.data)) {
                return data.data
            }
            return []
        } catch (err) {
            console.error('Lỗi getTransactions:', err)
            return []
        }
    },
}
