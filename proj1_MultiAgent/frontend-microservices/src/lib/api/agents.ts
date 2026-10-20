import { request } from '../client'

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