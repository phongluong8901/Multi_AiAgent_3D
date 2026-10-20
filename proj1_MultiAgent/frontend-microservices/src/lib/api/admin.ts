import { request } from './client'

export const adminApi = {
    getUsers: async (params?: { page?: number; limit?: number; search?: string }) => {
        const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
        const res = await request<{ success: boolean; data: any }>(`/admin/users${query}`)
        return res.data ?? res
    },

    getUserById: async (userId: string) => {
        const res = await request<{ success: boolean; data: any }>(`/admin/users/${userId}`)
        return res.data ?? res
    },

    updateUserRole: async (payload: { userId: string; role: string }) => {
        const res = await request<{ success: boolean; data: any }>('/admin/users/role', {
            method: 'PATCH',
            body: JSON.stringify(payload),
        })
        return res.data ?? res
    },

    deleteUser: async (userId: string) => {
        const res = await request<{ success: boolean; data: any }>(`/admin/users/${userId}`, {
            method: 'DELETE',
        })
        return res.data ?? res
    },

    getHardwareNodes: async () => {
        const res = await request<{ success: boolean; data: any }>('/admin/hardware-nodes')
        return res.data ?? res
    },
}