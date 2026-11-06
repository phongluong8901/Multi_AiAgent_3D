import { request } from '../client'

/**
 * Cấu trúc dữ liệu Công cụ (Tool) gắn cho AI Agent.
 * Hỗ trợทั้ง Built-in Tools và Custom Python Sandbox Tools kèm biến môi trường `env_vars`.
 */
export type Tool = {
    id: string
    name: string
    description?: string | null
    code?: string | null
    parameters?: string | null
    category?: string | null
    env_vars?: string | null
}

/**
 * Kết quả kiểm tra thực thi đơn lẻ một Tool (Single Tool Diagnostics).
 */
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

/**
 * Thông tin sức khỏe của từng Tool trong đợt kiểm tra hàng loạt.
 */
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

/**
 * Báo cáo tổng hợp khi chạy kiểm tra sức khỏe toàn bộ Tools (`testAll`).
 */
export type BatchHealthCheckResult = {
    total: number
    healthy_count: number
    error_count: number
    results: BatchToolHealthItem[]
}

/**
 * Module API quản lý và kiểm thử công cụ (Tools) của hệ thống AI Agent.
 */
export const toolsApi = {
    /** Lấy danh sách toàn bộ công cụ (Built-in & Custom Python) */
    list: () => request<Tool[]>('/tools'),

    /** Tạo mới một công cụ tùy chỉnh kèm mã nguồn Python và biến môi trường */
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

    /** Cập nhật thông tin, mã nguồn Python hoặc API Keys của một công cụ */
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

    /** Xóa công cụ khỏi hệ thống theo ID */
    remove: (id: string) =>
        request(`/tools/${id}`, { method: 'DELETE' }),

    /** Thực thi trực tiếp một công cụ đã lưu với bộ tham số đầu vào `arguments_` */
    execute: (tool_id: string, arguments_: Record<string, unknown> = {}) =>
        request<ToolTestResult>('/tools/execute', {
            method: 'POST',
            body: JSON.stringify({ tool_id, arguments: arguments_ }),
        }),

    /** Chạy kiểm thử (Health Check) một công cụ cụ thể theo ID */
    test: (tool_id: string, arguments_?: Record<string, unknown>) =>
        request<ToolTestResult>(`/tools/${tool_id}/test`, {
            method: 'POST',
            body: JSON.stringify({ arguments: arguments_ ?? null }),
        }),

    /** Chạy chẩn đoán sức khỏe hàng loạt cho toàn bộ công cụ trong hệ thống */
    testAll: () =>
        request<BatchHealthCheckResult>('/tools/test-all', {
            method: 'POST',
        }),

    /** Chạy thử mã nguồn Python trực tiếp trên trình soạn thảo Code Studio trước khi lưu */
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
