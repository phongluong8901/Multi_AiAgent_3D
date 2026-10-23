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
        request<{ tool_id: string; execution_result: string | any }>('/tools/execute', {
            method: 'POST',
            body: JSON.stringify({ tool_id, arguments: arguments_ }),
        }),

    executeCode: (
        code: string,
        arguments_: Record<string, unknown> = {},
        env_vars?: Record<string, string> | string
    ) =>
        request<{ tool_id: string; execution_result: string | any }>('/tools/execute', {
            method: 'POST',
            body: JSON.stringify({ code, arguments: arguments_, env_vars }),
        }),
}