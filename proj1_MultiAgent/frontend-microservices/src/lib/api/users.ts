import { request, API_BASE } from '../client'
import { getToken, getUser } from '@/lib/auth'
import type { HardwareReport } from './hardware'

/**
 * Thông tin hồ sơ người dùng đã chuẩn hóa trên toàn hệ thống.
 */
export type UserProfile = {
    id: string
    name: string
    email: string
    avatar?: string
    avatarUrl?: string
    bio?: string
    role?: string
    color?: string
    status?: 'online' | 'offline' | 'busy'
    ownedAgentIds?: string[]
    ownedAgents?: string[]
    hardwareNode?: HardwareReport
}

/**
 * Thông tin tóm tắt người dùng phục vụ tìm kiếm và mời vào phòng cộng tác.
 */
export type InviteUser = {
    id: string
    username: string
    email: string
    avatarUrl?: string
    status?: string
}

/**
 * Chuẩn hóa dữ liệu hồ sơ người dùng trả về từ Backend (hỗ trợ cả _id và id).
 */
function normalizeProfile(d: any): UserProfile {
    return {
        id: String(d.id || d._id),
        name: d.username || d.name || '',
        email: d.email || '',
        avatar: d.avatarUrl || d.avatar || '',
        avatarUrl: d.avatarUrl || d.avatar || '',
        bio: d.bio || '',
        role: d.role,
        color: d.color,
        status: d.status || 'offline',
        ownedAgentIds: d.ownedAgentIds || d.ownedAgents || [],
        hardwareNode: d.hardwareNode,
    }
}

/**
 * Module API quản lý thông tin tài khoản người dùng, trạng thái hoạt động và danh sách Agent sở hữu.
 */
export const usersApi = {
    /** Lấy thông tin hồ sơ của người dùng hiện tại */
    getProfile: async (): Promise<UserProfile> => {
        const res = await request<{ success: boolean; data: any }>('/users/me')
        return normalizeProfile(res.data ?? res)
    },

    /** Cập nhật tên hiển thị, tiểu sử (bio) hoặc ảnh đại diện */
    updateProfile: async (data: {
        name?: string
        username?: string
        bio?: string
        avatar?: string
        avatarUrl?: string
    }): Promise<UserProfile> => {
        const body = {
            username: data.name || data.username,
            bio: data.bio,
            avatarUrl: data.avatar || data.avatarUrl,
        }
        const res = await request<{ success: boolean; data: any }>('/users/me', {
            method: 'PUT',
            body: JSON.stringify(body),
        })
        return normalizeProfile(res.data ?? res)
    },

    /** Cập nhật trạng thái trực tuyến của người dùng (online | offline | busy) */
    updateStatus: async (status: 'online' | 'offline' | 'busy') => {
        const res = await request<{ success: boolean; data: any }>('/users/me/status', {
            method: 'PUT',
            body: JSON.stringify({ status }),
        })
        return res.data ?? res
    },

    /** Tải lên file ảnh đại diện mới cho tài khoản hiện tại */
    updateAvatar: async (file: File): Promise<string> => {
        const token = getToken()
        const user = getUser()
        const form = new FormData()
        form.append('avatar', file)

        const headers: Record<string, string> = {}
        if (token) headers['Authorization'] = `Bearer ${token}`
        if (user?.id) headers['x-user-id'] = user.id

        const res = await fetch(`${API_BASE}/users/me/avatar`, {
            method: 'PUT',
            headers,
            body: form,
        })
        if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`)
        const json = await res.json()
        const data = json.data ?? json
        return (data.avatarUrl || data.user?.avatarUrl || '') as string
    },

    /** Lấy danh sách ID các Agent thuộc quyền sở hữu của người dùng */
    getMyAgents: async (): Promise<string[]> => {
        const res = await request<{ success: boolean; data: any }>('/users/me/agents')
        const d = res?.data ?? res
        if (Array.isArray(d)) return d
        if (d?.ownedAgentIds) return d.ownedAgentIds
        if (d?.ownedAgents) return d.ownedAgents
        return []
    },

    /** Thêm một Agent vào danh sách sở hữu của người dùng */
    addMyAgent: async (agentId: string) => {
        const res = await request<{ success: boolean; data: any }>(
            `/users/me/agents/${agentId}`,
            { method: 'POST' }
        )
        return res.data
    },

    /** Gỡ một Agent khỏi danh sách sở hữu của người dùng */
    removeMyAgent: async (agentId: string) => {
        const res = await request<{ success: boolean; data: any }>(
            `/users/me/agents/${agentId}`,
            { method: 'DELETE' }
        )
        return res.data
    },

    /** Liệt kê danh sách người dùng đang trực tuyến (hỗ trợ tìm kiếm theo từ khóa) */
    listOnline: async (q?: string): Promise<InviteUser[]> => {
        const qs = q ? `?q=${encodeURIComponent(q)}` : ''
        const res = await request<{ success: boolean; data: InviteUser[] }>(
            `/users/online${qs}`
        )
        return res?.data ?? []
    },
}
