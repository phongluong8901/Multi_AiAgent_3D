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