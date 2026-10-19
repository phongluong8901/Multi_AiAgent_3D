import { request } from './client'

export type Prompt = {
    id: string
    title: string
    content: string
}

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
        request(`/prompts/${id}`, { method: 'DELETE' }),
}