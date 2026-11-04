import { request } from '../client'

export type Tool = {
    id: string
    name: string
    description?: string | null
    code?: string | null
    parameters?: string | null
    category?: string | null
    env_vars?: string | null
}

export type ToolTestResult = {
    tool_id: string
    tool_name?: string
    success: boolean
    status: 'healthy' | 'error'
    latency_ms: number
    error?: string | null
    arguments_used?: Record<string, unknown>
    execution_result: string | any
    parsed_result?: any
}

export type BatchToolHealthItem = {
    id: string
    name: string
    category?: string
    is_custom: boolean
    success: boolean
    status: 'healthy' | 'error'
    latency_ms: number
    sample_args?: Record<string, any>
    error?: string | null
    preview?: string
}

export type BatchHealthCheckResult = {
    total: number
    healthy_count: number
    error_count: number
    results: BatchToolHealthItem[]
}

export const toolsApi = {
    list: () => request<Tool[]>('/tools'),

    create: (data: {
        id: string
        name: string
        description?: string
        code?: string
        parameters?: string
        category?: string
        env_vars?: string
    }) =>
        request<Tool>('/tools', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    update: (
        id: string,
        data: {
            name?: string
            description?: string
            code?: string
            parameters?: string
            category?: string
            env_vars?: string
        }
    ) =>
        request<Tool>(`/tools/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    remove: (id: string) =>
        request(`/tools/${id}`, { method: 'DELETE' }),

    execute: (tool_id: string, arguments_: Record<string, unknown> = {}) =>
        request<ToolTestResult>('/tools/execute', {
            method: 'POST',
            body: JSON.stringify({ tool_id, arguments: arguments_ }),
        }),

    test: (tool_id: string, arguments_?: Record<string, unknown>) =>
        request<ToolTestResult>(`/tools/${tool_id}/test`, {
            method: 'POST',
            body: JSON.stringify({ arguments: arguments_ ?? null }),
        }),

    testAll: () =>
        request<BatchHealthCheckResult>('/tools/test-all', {
            method: 'POST',
        }),

    executeCode: (
        code: string,
        arguments_: Record<string, unknown> = {},
        env_vars?: Record<string, string> | string
    ) =>
        request<ToolTestResult>('/tools/execute', {
            method: 'POST',
            body: JSON.stringify({ code, arguments: arguments_, env_vars }),
        }),
}
