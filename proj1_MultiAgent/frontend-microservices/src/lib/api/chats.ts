import { request, API_BASE } from '../client'
import type { WorkflowTrace } from './types'

export type ChatMessage = {
    _id?: string
    id?: string
    roomId: string
    senderId: string
    senderType: 'user' | 'agent' | 'system'
    senderName: string
    message: string
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
    getHistory: async (roomId: string, limit = 50): Promise<ChatMessage[]> => {
        const res = await request<{ success: boolean; data: ChatMessage[] }>(
            `/chats/history/${roomId}?limit=${limit}`
        )
        return res?.data ?? []
    },

    send: async (data: {
        roomId: string
        senderId: string
        senderName: string
        senderType?: 'user' | 'agent' | 'system'
        message: string
        targetAgentId?: string
        metadata?: any
    }): Promise<ChatMessage> => {
        const res = await request<{ success: boolean; data: ChatMessage }>('/chats/send', {
            method: 'POST',
            body: JSON.stringify(data),
        })
        return res.data
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

    getEventStreamUrl: (roomId: string): string =>
        `${API_BASE}/chats/stream/${roomId}`,
}