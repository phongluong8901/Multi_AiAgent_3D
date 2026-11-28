import { request } from '../client'
import { CustomMapDesign } from '../maps/mapEditorTypes'

export interface CloudMapDesign extends CustomMapDesign {
    mapId: string
    userId?: string
    userName?: string
    isPublic?: boolean
    tags?: string[]
    createdAt?: string
    updatedAt: string
}

export const mapsApi = {
    // 1. Lưu hoặc Cập nhật bản đồ
    saveMap: async (mapData: Partial<CloudMapDesign> & { name: string }): Promise<{ success: boolean; message: string; data: CloudMapDesign }> => {
        return request<{ success: boolean; message: string; data: CloudMapDesign }>('/maps', {
            method: 'POST',
            body: JSON.stringify(mapData),
        })
    },

    // 2. Lấy danh sách bản đồ
    getMaps: async (params?: { userId?: string; search?: string }): Promise<{ success: boolean; count: number; data: CloudMapDesign[] }> => {
        const query = new URLSearchParams()
        if (params?.userId) query.set('userId', params.userId)
        if (params?.search) query.set('search', params.search)
        const qs = query.toString() ? `?${query.toString()}` : ''
        return request<{ success: boolean; count: number; data: CloudMapDesign[] }>(`/maps${qs}`)
    },

    // 3. Lấy chi tiết 1 bản đồ
    getMapById: async (mapId: string): Promise<{ success: boolean; data: CloudMapDesign }> => {
        return request<{ success: boolean; data: CloudMapDesign }>(`/maps/${mapId}`)
    },

    // 4. Xóa bản đồ
    deleteMap: async (mapId: string): Promise<{ success: boolean; message: string }> => {
        return request<{ success: boolean; message: string }>(`/maps/${mapId}`, {
            method: 'DELETE',
        })
    },

    // 5. Nhân bản bản đồ
    cloneMap: async (mapId: string, payload?: { newName?: string; userId?: string }): Promise<{ success: boolean; message: string; data: CloudMapDesign }> => {
        return request<{ success: boolean; message: string; data: CloudMapDesign }>(`/maps/${mapId}/clone`, {
            method: 'POST',
            body: JSON.stringify(payload || {}),
        })
    },
}
