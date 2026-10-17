const API_BASE =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

// ─── Types ───────────────────────────────────────────────

export type AgentStatus = 'idle' | 'working' | 'meeting' | 'blocked'

export type Agent = {
    id: string
    name: string
    color: string
    status: AgentStatus
    speech: string | null
    position: [number, number, number]
    prompt_id?: string | null
    tools?: unknown[]
    ownerName?: string
}

export type AgentCreate = {
    id: string
    name: string
    color?: string
    status?: string
    speech?: string | null
    pos_x?: number
    pos_y?: number
    pos_z?: number
    prompt_id?: string | null
    tool_ids?: string[]
}

export type AgentUpdate = Partial<{
    name: string
    color: string
    status: string
    speech: string | null
    pos_x: number
    pos_y: number
    pos_z: number
    prompt_id: string | null
    tool_ids: string[]
}>

export type Prompt = {
    id: string
    title: string
    content: string
}

export type Tool = {
    id: string
    name: string
    description?: string | null
}

export type AIModel = {
    id: string
    name: string
    provider: string
    description?: string
}

export type RoomMember = {
    memberId: string
    memberType: 'user' | 'agent'
    role: 'owner' | 'participant' | 'observer'
    name?: string
    color?: string
    avatar?: string
    status?: string
    joinedAt?: string
}

export type RoomSettings = {
    allowCrossCommands: boolean
    autonomousHandoff: boolean
    maxAutoTurns: number
}

export type UserAgentBinding = {
    userId: string
    userName: string
    userColor?: string
    agentId: string
    agentName?: string
    assignedAt?: string
}

export type WorkflowTraceNode = {
    id: string
    name: string
    type: 'input' | 'retriever' | 'llm' | 'tool' | 'output' | 'error'
    status: 'completed' | 'running' | 'error' | 'pending'
    inputs?: any
    outputs?: any
    error?: string
    stackTrace?: string
    latencyMs?: number
    tool_calls?: any[]
}

export type WorkflowTrace = {
    traceId: string
    agentId: string
    agentName: string
    roomId?: string
    userMessage: string
    status: 'completed' | 'running' | 'error'
    startTime: string
    totalLatencyMs: number
    error?: string | null
    errorNode?: string | null
    nodes: WorkflowTraceNode[]
}

export type Room = {
    _id?: string
    id?: string
    name: string
    description?: string
    maxCapacity: number
    activeAgents: string[]
    userAgents?: UserAgentBinding[]
    settings: RoomSettings
    members: RoomMember[]
    createdAt?: string
    updatedAt?: string
}

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

import { getToken } from './auth'

export type UserPresence = {
    userId: string
    userName: string
    avatar?: string
    color?: string
    joinedAt?: string
    lastSeen?: number
}

export type UserProfile = {
    id: string
    name: string
    email: string
    avatar?: string
    bio?: string
    role?: string
    color?: string
    ownedAgents?: string[]
}

// ─── Request helper ──────────────────────────────────────

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const token = getToken()
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options?.headers as any ?? {}),
        },
    })

    if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
    }

    if (res.status === 204) return undefined as T
    return res.json()
}

// ─── Agents ──────────────────────────────────────────────

export const agentsApi = {
    list: () => request<Agent[]>('/agents'),

    get: (id: string) => request<Agent>(`/agents/${id}`),

    create: (data: AgentCreate) =>
        request<Agent>('/agents', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    update: (id: string, data: AgentUpdate) =>
        request<Agent>(`/agents/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    remove: (id: string) =>
        request<{ success: boolean }>(`/agents/${id}`, {
            method: 'DELETE',
        }),

    chat: (id: string, message: string, room_id?: string) =>
        request<{
            success: boolean
            answer?: string
            error?: string
            used_tools?: string[]
        }>(`/agents/${id}/chat`, {
            method: 'POST',
            body: JSON.stringify({ message, room_id }),
        }),
}

// ─── Prompts ─────────────────────────────────────────────

export const promptsApi = {
    list: () => request<Prompt[]>('/prompts'),

    create: (data: { id: string; title: string; content: string }) =>
        request<Prompt>('/prompts', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    update: (id: string, data: { title?: string; content?: string }) =>
        request<Prompt>(`/prompts/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    remove: (id: string) =>
        request(`/prompts/${id}`, {
            method: 'DELETE',
        }),
}

// ─── Tools ───────────────────────────────────────────────

export const toolsApi = {
    list: () => request<Tool[]>('/tools'),

    create: (data: { id: string; name: string; description?: string }) =>
        request<Tool>('/tools', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    update: (id: string, data: { name?: string; description?: string }) =>
        request<Tool>(`/tools/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    remove: (id: string) =>
        request(`/tools/${id}`, {
            method: 'DELETE',
        }),

    execute: (tool_id: string, arguments_: Record<string, unknown> = {}) =>
        request('/tools/execute', {
            method: 'POST',
            body: JSON.stringify({ tool_id, arguments: arguments_ }),
        }),
}

// ─── Rooms ───────────────────────────────────────────────

export const roomsApi = {
    list: async (): Promise<Room[]> => {
        const res = await request<{ success: boolean; data: Room[] }>('/rooms')
        return res?.data ?? []
    },

    get: async (id: string): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(`/rooms/${id}`)
        return res.data
    },

    create: async (data: {
        name: string
        description?: string
        maxCapacity?: number
        activeAgents?: string[]
        settings?: Partial<RoomSettings>
    }): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>('/rooms', {
            method: 'POST',
            body: JSON.stringify(data),
        })
        return res.data
    },

    update: async (id: string, data: Partial<Room>): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(`/rooms/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        })
        return res.data
    },

    addMember: async (roomId: string, member: Partial<RoomMember>): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(`/rooms/${roomId}/members`, {
            method: 'POST',
            body: JSON.stringify(member),
        })
        return res.data
    },

    removeMember: async (roomId: string, memberId: string): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(`/rooms/${roomId}/members/${memberId}`, {
            method: 'DELETE',
        })
        return res.data
    },

    syncAgents: async (roomId: string, activeAgents: string[]): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(`/rooms/${roomId}/agents`, {
            method: 'POST',
            body: JSON.stringify({ activeAgents }),
        })
        return res.data
    },

    addAgent: async (roomId: string, agentId: string): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(`/rooms/${roomId}/agents/${agentId}`, {
            method: 'POST',
        })
        return res.data
    },

    removeAgent: async (roomId: string, agentId: string): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(`/rooms/${roomId}/agents/${agentId}`, {
            method: 'DELETE',
        })
        return res.data
    },

    assignUserAgent: async (roomId: string, data: {
        userId: string
        userName: string
        userColor?: string
        agentId: string
        agentName?: string
    }): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(`/rooms/${roomId}/user-agents`, {
            method: 'POST',
            body: JSON.stringify(data),
        })
        return res.data
    },

    removeUserAgent: async (roomId: string, agentId: string): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(`/rooms/${roomId}/user-agents/${agentId}`, {
            method: 'DELETE',
        })
        return res.data
    },
}

// ─── Users & Profiles ────────────────────────────────────

export const usersApi = {
    getProfile: async (): Promise<UserProfile> => {
        const res = await request<{ success: boolean; data: UserProfile }>('/users/me')
        return res.data
    },

    updateProfile: async (data: Partial<UserProfile>): Promise<UserProfile> => {
        const res = await request<{ success: boolean; data: UserProfile }>('/users/me', {
            method: 'PUT',
            body: JSON.stringify(data),
        })
        return res.data
    },

    getMyAgents: async (): Promise<string[]> => {
        const res = await request<{ success: boolean; data: string[] }>('/users/me/agents')
        return res?.data ?? []
    },

    addMyAgent: async (agentId: string): Promise<any> => {
        const res = await request<{ success: boolean; data: any }>(`/users/me/agents/${agentId}`, {
            method: 'POST',
        })
        return res.data
    },

    removeMyAgent: async (agentId: string): Promise<any> => {
        const res = await request<{ success: boolean; data: any }>(`/users/me/agents/${agentId}`, {
            method: 'DELETE',
        })
        return res.data
    },
}

// ─── Chats & Real-Time Presence ──────────────────────────

export const chatsApi = {
    getHistory: async (roomId: string, limit: number = 50): Promise<ChatMessage[]> => {
        const res = await request<{ success: boolean; data: ChatMessage[] }>(`/chats/history/${roomId}?limit=${limit}`)
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

    getPresence: async (roomId: string): Promise<{ roomId: string; onlineUsers: UserPresence[] }> => {
        const res = await request<{ success: boolean; data: { roomId: string; onlineUsers: UserPresence[] } }>(`/chats/presence/${roomId}`)
        return res.data
    },

    updatePresence: async (roomId: string, user: { id: string; name: string; avatar?: string; color?: string }): Promise<void> => {
        await request(`/chats/presence/${roomId}`, {
            method: 'POST',
            body: JSON.stringify({ user }),
        })
    },

    getEventStreamUrl: (roomId: string): string => {
        return `${API_BASE}/chats/stream/${roomId}`
    },
}

// ─── Models ──────────────────────────────────────────────

export async function listModels(): Promise<AIModel[]> {
    try {
        return await request<AIModel[]>('/models')
    } catch {
        return [
            {
                id: 'gpt-4o-mini',
                name: 'GPT-4o Mini',
                provider: 'OpenAI',
                description: 'Nhanh, rẻ — default nhiều setup',
            },
            {
                id: 'gpt-4o',
                name: 'GPT-4o',
                provider: 'OpenAI',
                description: 'Mạnh hơn cho reasoning',
            },
            {
                id: 'claude-sonnet',
                name: 'Claude Sonnet',
                provider: 'Anthropic',
                description: 'Tốt cho code & long context',
            },
            {
                id: 'local-llm',
                name: 'Local LLM',
                provider: 'Ollama / vLLM',
                description: 'Chạy local qua llm_registry',
            },
        ]
    }
}