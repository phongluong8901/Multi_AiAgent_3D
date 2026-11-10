import { request, API_BASE } from '../client'

/**
 * Các trạng thái hoạt động chuẩn của AI Agent trong không gian 3D và phòng cộng tác.
 */
export type AgentStatus =
    | 'idle'
    | 'working'
    | 'meeting'
    | 'blocked'
    | 'speaking'
    | 'thinking'
    | 'error'

/**
 * Cấu trúc dữ liệu chi tiết của một AI Agent (bao gồm cấu hình LLM, Tools, Prompt và Hình thái Robot 3D).
 */
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
    form?: 'humanoid' | 'duck' | 'amr' | 'drone' | 'custom'
    body_id?: string | null
    bodyId?: string | null
}

/**
 * Payload khởi tạo mới một AI Agent.
 */
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
    form?: 'humanoid' | 'duck' | 'amr' | 'drone' | 'custom'
    body_id?: string | null
    bodyId?: string | null
}

/**
 * Payload cập nhật thông tin cấu hình của AI Agent.
 */
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
    form: 'humanoid' | 'duck' | 'amr' | 'drone' | 'custom'
    body_id: string | null
    bodyId: string | null
}>

/**
 * Module API giao tiếp với `agent-service` để quản lý vòng đời Agent và thực thi hội thoại SSE Streaming.
 */
export const agentsApi = {
    /** Lấy danh sách toàn bộ AI Agents trong hệ thống */
    list: () => request<Agent[]>('/agents'),

    /** Lấy thông tin chi tiết của một AI Agent theo ID */
    get: (id: string) => request<Agent>(`/agents/${id}`),

    /** Khởi tạo một AI Agent mới */
    create: (data: AgentCreate) =>
        request<Agent>('/agents', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    /** Cập nhật thông số cấu hình (Model, Prompt, Tools, Hình thái 3D) cho Agent */
    update: (id: string, data: AgentUpdate) =>
        request<Agent>(`/agents/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    /** Xóa vĩnh viễn một AI Agent khỏi hệ thống */
    remove: (id: string) =>
        request<{ success: boolean }>(`/agents/${id}`, {
            method: 'DELETE',
        }),

    /** Gửi tin nhắn hội thoại đồng bộ tới một Agent cụ thể */
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

    /**
     * Hội thoại trực tiếp với Agent theo luồng Server-Sent Events (SSE Streaming).
     * Cho phép cập nhật từng token, trạng thái suy nghĩ (thinking) và tiến trình gọi công cụ (tool_start / tool_end).
     */
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
                        // Bỏ qua các dòng SSE không phải JSON hợp lệ
                    }
                }
            }
        }

        return fullAnswer
    },
}

/**
 * Sự kiện thời gian thực phát ra từ luồng SSE khi Agent suy luận và gọi công cụ.
 */
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
