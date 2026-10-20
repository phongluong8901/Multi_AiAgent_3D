import { request } from './client'

export type Tool = {
    id: string
    name: string
    description?: string | null
}

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
        request(`/tools/${id}`, { method: 'DELETE' }),

    execute: (tool_id: string, arguments_: Record<string, unknown> = {}) =>
        request('/tools/execute', {
            method: 'POST',
            body: JSON.stringify({ tool_id, arguments: arguments_ }),
        }),
}