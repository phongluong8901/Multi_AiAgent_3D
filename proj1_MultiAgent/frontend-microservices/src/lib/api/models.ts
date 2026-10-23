import { request } from '../client'

export type AIModel = {
    id: string
    name: string
    provider: string
    description?: string
}

export async function listModels(): Promise<AIModel[]> {
    try {
        return await request<AIModel[]>('/models')
    } catch {
        return [
            {
                id: 'gemini-2.5-flash-lite',
                name: 'Gemini 2.5 Flash Lite',
                provider: 'Google AI',
                description: 'Mặc định - Cực nhanh, tiết kiệm token, phản hồi tức thì',
            },
            {
                id: 'gemini-2.5-flash',
                name: 'Gemini 2.5 Flash',
                provider: 'Google AI',
                description: 'Thông minh, hỗ trợ đa nhiệm, tool calling sâu và phân tích logic',
            },
            {
                id: 'gemini-2.0-flash',
                name: 'Gemini 2.0 Flash',
                provider: 'Google AI',
                description: 'Bản Flash thế hệ 2 cân bằng giữa tốc độ và độ chuẩn xác',
            },
            {
                id: 'gemini-1.5-flash',
                name: 'Gemini 1.5 Flash',
                provider: 'Google AI',
                description: 'Độ ổn định cao, dự phòng tin cậy cho các tác vụ nhóm',
            },
            {
                id: 'gemini-1.5-pro',
                name: 'Gemini 1.5 Pro',
                provider: 'Google AI',
                description: 'Mô hình suy luận lớn 1M tokens, tổng hợp báo cáo chuyên sâu',
            },
        ]
    }
}