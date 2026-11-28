import { request } from '../client'

/**
 * Cấu trúc dữ liệu System Prompt chỉ dẫn vai trò và hành vi cho AI Agent.
 */
export type Prompt = {
    id: string
    title: string
    content: string
}

/**
 * Module API quản lý danh sách System Prompts (Liệt kê, Tạo mới, Cập nhật, Xóa).
 */
export const promptsApi = {
    /** Lấy toàn bộ danh sách System Prompts hiện có */
    list: () => request<Prompt[]>('/prompts'),

    /** Tạo mới một System Prompt */
    create: (data: { id: string; title: string; content: string }) =>
        request<Prompt>('/prompts', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    /** Cập nhật tiêu đề hoặc nội dung của System Prompt theo ID */
    update: (id: string, data: { title?: string; content?: string }) =>
        request<Prompt>(`/prompts/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    /** Xóa một System Prompt khỏi hệ thống */
    remove: (id: string) =>
        request(`/prompts/${id}`, { method: 'DELETE' }),
}
