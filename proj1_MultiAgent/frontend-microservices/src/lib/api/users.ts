import { request, API_BASE } from './client'
import { getToken, getUser } from '@/lib/auth'
import type { HardwareReport } from './hardware' // 👈 Import type từ hardware.ts

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
    hardwareNode?: HardwareReport // 👈 Dùng lại type HardwareReport
}

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

export const usersApi = {
    getProfile: async (): Promise<UserProfile> => {
        const res = await request<{ success: boolean; data: any }>('/users/me')
        return normalizeProfile(res.data ?? res)
    },

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

    updateStatus: async (status: 'online' | 'offline' | 'busy') => {
        const res = await request<{ success: boolean; data: any }>('/users/me/status', {
            method: 'PUT',
            body: JSON.stringify({ status }),
        })
        return res.data ?? res
    },

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

    getMyAgents: async (): Promise<string[]> => {
        const res = await request<{ success: boolean; data: any }>('/users/me/agents')
        const d = res?.data ?? res
        if (Array.isArray(d)) return d
        if (d?.ownedAgentIds) return d.ownedAgentIds
        if (d?.ownedAgents) return d.ownedAgents
        return []
    },

    addMyAgent: async (agentId: string) => {
        const res = await request<{ success: boolean; data: any }>(
            `/users/me/agents/${agentId}`,
            { method: 'POST' }
        )
        return res.data
    },

    removeMyAgent: async (agentId: string) => {
        const res = await request<{ success: boolean; data: any }>(
            `/users/me/agents/${agentId}`,
            { method: 'DELETE' }
        )
        return res.data
    },
}