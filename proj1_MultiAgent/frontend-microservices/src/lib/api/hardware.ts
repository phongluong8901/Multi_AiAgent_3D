import { request } from '../client'

export type HardwareReport = {
    cpuCores: number
    deviceMemoryGB: number
    hasWebGPU: boolean
    gpuName?: string
    recommendedModels: string[]
    canRunAI: boolean
    status?: 'IDLE' | 'BUSY' | 'OFFLINE'
    lastSeen?: string
}

export const hardwareApi = {
    // Lấy thông tin phần cứng node hiện tại của user
    getNode: async () => {
        return await request<{ success: boolean; data: HardwareReport }>('/users/me/hardware-node')
    },

    // Đăng ký hoặc cập nhật phần cứng node
    registerNode: async (data: HardwareReport) => {
        const res = await request<{ success: boolean; message: string; hardwareNode: HardwareReport }>('/users/me/hardware-node', {
            method: 'POST',
            body: JSON.stringify(data),
        })
        return res.hardwareNode ?? res
    },
}