import { request, API_BASE } from '../client'

export type AgentStatus =
    | 'idle'
    | 'working'
    | 'meeting'
    | 'blocked'
    | 'speaking'
    | 'thinking'
    | 'error'

export type Agent = {
    id: string
    name: string
    color: string
    status: AgentStatus
    speech: string | null
    position: [number, number, number]
    model?: string
    prompt_id?: string | null
    tools?: unknown[]
    ownerName?: string
    form?: 'humanoid' | 'duck' | 'amr' | 'drone'
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
    model?: string
    prompt_id?: string | null
    tool_ids?: string[]
    form?: 'humanoid' | 'duck' | 'amr' | 'drone'
}

export type AgentUpdate = Partial<{
    name: string
    color: string
    status: string
    speech: string | null
    pos_x: number
    pos_y: number
    pos_z: number
    model: string
    prompt_id: string | null
    tool_ids: string[]
    form: 'humanoid' | 'duck' | 'amr' | 'drone'
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

    chatStream: async (
        id: string,
        message: string,
        room_id?: string,
        onEvent?: (event: AgentStreamEvent) => void,
        options?: { activeAgents?: string[]; context?: Record<string, any> }
    ): Promise<string> => {
        const { getToken, getUser } = await import('@/lib/auth')
        const token = getToken()
        const user = getUser()

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
        }
        if (token) headers['Authorization'] = `Bearer ${token}`
        if (user?.id) headers['x-user-id'] = user.id

        const res = await fetch(`${API_BASE}/agents/${id}/chat/stream`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                message,
                room_id,
                active_agents: options?.activeAgents,
                context: options?.context,
            }),
        })

        if (!res.ok) {
            const err = await res.text()
            throw new Error(err || `HTTP ${res.status}`)
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error('No readable stream available')

        const decoder = new TextDecoder()
        let fullAnswer = ''
        let buffer = ''

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
                const trimmed = line.trim()
                if (trimmed.startsWith('data:')) {
                    try {
                        const jsonStr = trimmed.replace(/^data:\s*/, '')
                        const event: AgentStreamEvent = JSON.parse(jsonStr)
                        if (event.type === 'token' && event.content) {
                            fullAnswer += event.content
                        } else if (event.type === 'done' && event.answer) {
                            fullAnswer = event.answer
                        }
                        onEvent?.(event)
                    } catch {
                        // ignore malformed SSE line
                    }
                }
            }
        }

        return fullAnswer
    },
}

export interface AgentStreamEvent {
    type: 'status' | 'thinking' | 'tool_start' | 'tool_end' | 'token' | 'done' | 'error'
    step?: number
    tool?: string
    args?: any
    result?: string
    message?: string
    content?: string
    answer?: string
    tools_used?: string[]
}
