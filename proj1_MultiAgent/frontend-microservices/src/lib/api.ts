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

// ─── Request helper ──────────────────────────────────────

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options?.headers ?? {}),
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