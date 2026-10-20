import { request } from './client'

export const sellerApi = {
    registerNode: async (nodeData: any) => {
        const res = await request<{ success: boolean; data: any }>('/seller/register-node', {
            method: 'POST',
            body: JSON.stringify(nodeData),
        })
        return res.data ?? res
    },

    pingHeartbeat: async () => {
        const res = await request<{ success: boolean; data: any }>('/seller/heartbeat', {
            method: 'POST',
        })
        return res.data ?? res
    },

    getNodeDetails: async () => {
        const res = await request<{ success: boolean; data: any }>('/seller/node')
        return res.data ?? res
    },
}