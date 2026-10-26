import { request, API_BASE } from '../client'
import { getToken } from '../auth'
import type { WorkflowTrace } from './types'

// Kiểu dữ liệu file đính kèm (Ảnh và Tài liệu/CSV/Excel)
export type ChatAttachment = {
    fileUrl: string
    fileName: string
    fileSize?: number
    category: 'image' | 'document'
    extension: string
}

export type ChatType = 'team' | 'direct' | 'agent' | 'system' | 'workflow' | 'meeting'

export type ChatMessage = {
    _id?: string
    id?: string
    roomId: string
    typeChat?: ChatType // Phân loại luồng chat: team, direct (1-1 user), agent (user-agent), workflow, system
    senderId: string
    senderType: 'user' | 'agent' | 'system'
    senderName: string
    message: string
    targetUserId?: string // Dành cho chat direct 1-1 người dùng
    targetAgentId?: string // Dành cho chat hỏi đáp với agent
    attachments?: ChatAttachment[] // Danh sách file đính kèm
    metadata?: {
        usedTools?: string[]
        depth?: number
        model?: string
        targetUserId?: string
        workflowTrace?: WorkflowTrace
        [key: string]: any
    }
    createdAt?: string
}

export type UserPresence = {
    userId: string
    userName: string
    avatar?: string
    color?: string
    joinedAt?: string
    lastSeen?: number
}

export const chatsApi = {
    getHistory: async (
        roomId: string,
        typeChat?: string,
        limit = 60,
        options?: { targetUserId?: string; targetAgentId?: string }
    ): Promise<ChatMessage[]> => {
        const query = new URLSearchParams()
        if (typeChat) query.append('typeChat', typeChat)
        if (options?.targetUserId) query.append('targetUserId', options.targetUserId)
        if (options?.targetAgentId) query.append('targetAgentId', options.targetAgentId)
        query.append('limit', limit.toString())

        const res = await request<{ success: boolean; data: ChatMessage[] }>(
            `/chats/history/${roomId}?${query.toString()}`
        )
        return res?.data ?? []
    },

    send: async (data: {
        roomId: string
        typeChat?: ChatType
        senderId: string
        senderName: string
        senderType?: 'user' | 'agent' | 'system'
        message: string
        targetUserId?: string
        targetAgentId?: string
        attachments?: ChatAttachment[]
        metadata?: any
    }): Promise<ChatMessage> => {
        const res = await request<{ success: boolean; data: ChatMessage }>('/chats/send', {
            method: 'POST',
            body: JSON.stringify(data),
        })
        return res.data
    },

    // API upload file lên Cloudinary thông qua chat-service
    uploadFile: async (file: File): Promise<ChatAttachment> => {
        const formData = new FormData()
        formData.append('file', file)

        const token = getToken()
        const response = await fetch(`${API_BASE}/chats/upload`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
        })

        let result: any
        try {
            result = await response.json()
        } catch {
            throw new Error(`Upload thất bại với mã HTTP ${response.status}`)
        }

        if (!response.ok || !result.success) {
            throw new Error(result?.message || `Upload file thất bại (HTTP ${response.status})`)
        }
        return result.data
    },

    getPresence: async (
        roomId: string
    ): Promise<{ roomId: string; onlineUsers: UserPresence[] }> => {
        const res = await request<{
            success: boolean
            data: { roomId: string; onlineUsers: UserPresence[] }
        }>(`/chats/presence/${roomId}`)
        return res.data
    },

    updatePresence: async (
        roomId: string,
        user: { id: string; name: string; avatar?: string; color?: string }
    ): Promise<void> => {
        await request(`/chats/presence/${roomId}`, {
            method: 'POST',
            body: JSON.stringify({ user }),
        })
    },
}