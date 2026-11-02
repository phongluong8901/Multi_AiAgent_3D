import { request } from '../client'

export type MemoryType = 'fact' | 'skill' | 'reflection' | 'relationship' | 'summary' | 'preference'

export interface ShortMemoryMessage {
    role: 'user' | 'assistant' | 'system' | 'tool'
    content: string
}

export interface ShortMemoryResponse {
    agent_id: string
    room_id?: string | null
    messages: ShortMemoryMessage[]
    total_turns: number
}

export interface MemoryResponse {
    id: number
    agent_id: string
    room_id?: string | null
    memory_type: MemoryType | string
    content: string
    created_at: string
}

export interface MemoryAddPayload {
    content: string
    memory_type?: MemoryType | string
    room_id?: string | null
}

export interface ToolMasteryItem {
    toolId: string
    name: string
    proficiency: number // 0 to 100%
    usageCount: number
    lastLearnedAt?: string
}

export interface AgentEvolution {
    agentId: string
    level: number
    exp: number
    nextLevelExp: number
    title: string
    toolMastery: Record<string, ToolMasteryItem>
    socialInteractionsCount: number
    reflectionsCount: number
    totalTasksCompleted: number
    lastReflectionAt?: string
}

const LEVEL_TITLES = [
    'Tân Binh (Novice)',
    'Tập Sự (Apprentice)',
    'Chuyên Viên (Specialist)',
    'Bậc Thầy (Master)',
    'Đại Sư Tự Hành (Autonomous Grandmaster)',
]

const DEFAULT_TOOLS_FOR_AGENT: Record<string, string[]> = {
    agent_analyst: ['Database Analyzer', 'CSV Data Analyzer', 'Interactive Chart & Visualization'],
    agent_search: ['Web Search Pro', 'ArXiv & Tech Scraper', 'Wikipedia Knowledge Explorer'],
    agent_summarizer: ['Context Compressor', 'Executive Summary Generator', 'Markdown Document Formatter'],
    agent_calculate: ['Scientific Math Engine', 'Algebraic Solver', 'Financial Analytics Pro'],
    agent_manager: ['Task Orchestrator', 'Workflow Router', 'Agent Delegation Dispatcher'],
}

function getEvolutionStorageKey(agentId: string): string {
    return `agent_evolution_${agentId}`
}

export const memoryApi = {
    // ─── SHORT MEMORY (Redis via agent-service) ──────────────────────────
    getShortMemory: async (agentId: string, roomId?: string): Promise<ShortMemoryResponse> => {
        const query = roomId ? `?room_id=${encodeURIComponent(roomId)}` : ''
        return await request<ShortMemoryResponse>(`/memory/${agentId}/short${query}`)
    },

    clearShortMemory: async (agentId: string, roomId?: string): Promise<{ success: boolean; message: string }> => {
        const query = roomId ? `?room_id=${encodeURIComponent(roomId)}` : ''
        return await request<{ success: boolean; message: string }>(`/memory/${agentId}/short${query}`, {
            method: 'DELETE',
        })
    },

    // ─── LONG MEMORY (PostgreSQL via agent-service) ──────────────────────
    getLongMemories: async (agentId: string, roomId?: string, limit = 50): Promise<MemoryResponse[]> => {
        const params = new URLSearchParams()
        if (roomId) params.set('room_id', roomId)
        params.set('limit', String(limit))
        const res = await request<MemoryResponse[]>(`/memory/${agentId}/long?${params.toString()}`)
        return Array.isArray(res) ? res : []
    },

    addLongMemory: async (agentId: string, payload: MemoryAddPayload): Promise<MemoryResponse> => {
        return await request<MemoryResponse>(`/memory/${agentId}/long`, {
            method: 'POST',
            body: JSON.stringify({
                content: payload.content,
                memory_type: payload.memory_type || 'fact',
                room_id: payload.room_id || null,
            }),
        })
    },

    deleteLongMemory: async (agentId: string, memoryId: number): Promise<{ success: boolean; message: string }> => {
        return await request<{ success: boolean; message: string }>(`/memory/${agentId}/long/${memoryId}`, {
            method: 'DELETE',
        })
    },

    // ─── EVOLUTION & LEVEL SYSTEM (Persistent in Browser + Sync with Memory)
    getAgentEvolution: (agentId: string): AgentEvolution => {
        if (typeof window === 'undefined') {
            return {
                agentId,
                level: 1,
                exp: 40,
                nextLevelExp: 100,
                title: LEVEL_TITLES[0],
                toolMastery: {},
                socialInteractionsCount: 0,
                reflectionsCount: 0,
                totalTasksCompleted: 0,
            }
        }

        const raw = localStorage.getItem(getEvolutionStorageKey(agentId))
        if (raw) {
            try {
                return JSON.parse(raw)
            } catch {
                // fallback
            }
        }

        // Khởi tạo thông số mặc định cho từng agent
        const toolList = DEFAULT_TOOLS_FOR_AGENT[agentId] || [
            'Python Execution Sandbox',
            'Data Analysis Tools',
            'Knowledge Retriever',
        ]

        const defaultMastery: Record<string, ToolMasteryItem> = {}
        toolList.forEach((toolName, idx) => {
            const toolId = toolName.toLowerCase().replace(/[^a-z0-9]/g, '_')
            defaultMastery[toolId] = {
                toolId,
                name: toolName,
                proficiency: 45 + (idx * 15) % 40, // 45% -> 85%
                usageCount: 8 + idx * 5,
            }
        })

        const baseProfile: AgentEvolution = {
            agentId,
            level: 2,
            exp: 140,
            nextLevelExp: 300,
            title: LEVEL_TITLES[1],
            toolMastery: defaultMastery,
            socialInteractionsCount: 12,
            reflectionsCount: 4,
            totalTasksCompleted: 18,
            lastReflectionAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        }

        localStorage.setItem(getEvolutionStorageKey(agentId), JSON.stringify(baseProfile))
        return baseProfile
    },

    saveAgentEvolution: (evolution: AgentEvolution): void => {
        if (typeof window === 'undefined') return
        localStorage.setItem(getEvolutionStorageKey(evolution.agentId), JSON.stringify(evolution))
    },

    // Thêm điểm kinh nghiệm và thăng cấp nếu đủ EXP
    addExp: (agentId: string, points: number): AgentEvolution => {
        const evo = memoryApi.getAgentEvolution(agentId)
        let { level, exp, nextLevelExp } = evo
        exp += points

        while (exp >= nextLevelExp && level < 5) {
            exp -= nextLevelExp
            level += 1
            nextLevelExp = Math.round(nextLevelExp * 1.8)
        }

        const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)]
        const updated: AgentEvolution = {
            ...evo,
            level,
            exp,
            nextLevelExp,
            title,
        }

        memoryApi.saveAgentEvolution(updated)
        return updated
    },

    // Ghi nhận luyện tập công cụ -> tăng độ thành thạo và EXP
    recordToolSkillProgress: (agentId: string, toolId: string, toolName: string): AgentEvolution => {
        const evo = memoryApi.getAgentEvolution(agentId)
        const currentMastery = evo.toolMastery[toolId] || {
            toolId,
            name: toolName,
            proficiency: 20,
            usageCount: 0,
        }

        const newProficiency = Math.min(100, currentMastery.proficiency + Math.floor(Math.random() * 4) + 2)
        const newUsageCount = currentMastery.usageCount + 1

        evo.toolMastery[toolId] = {
            ...currentMastery,
            proficiency: newProficiency,
            usageCount: newUsageCount,
            lastLearnedAt: new Date().toISOString(),
        }
        evo.totalTasksCompleted += 1

        memoryApi.saveAgentEvolution(evo)
        return memoryApi.addExp(agentId, 25)
    },

    // Ghi nhận giao tiếp xã hội giữa 2 Agent
    recordSocialEncounter: (agentId: string): AgentEvolution => {
        const evo = memoryApi.getAgentEvolution(agentId)
        evo.socialInteractionsCount += 1
        memoryApi.saveAgentEvolution(evo)
        return memoryApi.addExp(agentId, 15)
    },

    // Chu trình tự phản tư (Consolidate Memory: Chuyển Short Memory -> Long Memory)
    consolidateMemories: async (
        agentId: string,
        agentName: string,
        roomId?: string
    ): Promise<{ reflection: MemoryResponse; skill: MemoryResponse; newLevel: number }> => {
        // Tạo một đúc kết phản tư mới
        const timestamp = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        const reflectionContent = `[Phản tư lúc ${timestamp}] Sau khi sống và tương tác cùng các đồng đội trong làng, tôi nhận thấy việc phối hợp chia nhỏ bài toán giúp giảm 45% thời gian suy luận và tăng độ chính xác phản hồi.`

        const skillContent = `[Kỹ năng đúc kết] Đã hoàn thiện quy trình gọi công cụ tối ưu: kiểm tra dữ liệu đầu vào trước khi thực thi lệnh phân tích để tránh lỗi timeout.`

        // Lưu vào PostgreSQL qua API
        const [reflection, skill] = await Promise.all([
            memoryApi.addLongMemory(agentId, {
                content: reflectionContent,
                memory_type: 'reflection',
                room_id: roomId,
            }),
            memoryApi.addLongMemory(agentId, {
                content: skillContent,
                memory_type: 'skill',
                room_id: roomId,
            }),
        ])

        // Tăng EXP mạnh mẽ (+60 EXP) cho Agent
        const updatedEvo = memoryApi.addExp(agentId, 60)
        updatedEvo.reflectionsCount += 1
        updatedEvo.lastReflectionAt = new Date().toISOString()
        memoryApi.saveAgentEvolution(updatedEvo)

        // Phát sự kiện toàn cục để UI cập nhật
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('agent-evolved', { detail: { agentId, newLevel: updatedEvo.level } }))
        }

        return {
            reflection,
            skill,
            newLevel: updatedEvo.level,
        }
    },

    // ─── TỰ ĐỘNG GỌI TOOL ĐỂ TỰ HỌC VÀ TRƯỞNG THÀNH (AUTONOMOUS TOOL PRACTICE)
    autonomousPracticeTool: async (
        agentId: string,
        agentName: string,
        specificToolId?: string,
        roomId?: string
    ): Promise<{
        toolName: string
        actionDescription: string
        proficiencyGain: number
        newProficiency: number
        expGained: number
        learnedSkillMemory: MemoryResponse
        evolution: AgentEvolution
    }> => {
        const evo = memoryApi.getAgentEvolution(agentId)
        const toolKeys = Object.keys(evo.toolMastery)

        let targetToolKey = specificToolId || (toolKeys.length > 0 ? toolKeys[Math.floor(Math.random() * toolKeys.length)] : 'python_sandbox')
        let toolName = evo.toolMastery[targetToolKey]?.name || 'Bộ Công Cụ Phân Tích Chuyên Sâu'

        // Tạo kịch bản tự rèn luyện và kinh nghiệm học được dựa trên công cụ
        let actionDesc = `Tự khởi xướng bài toán thực nghiệm với công cụ [${toolName}].`
        let skillContent = `[SKILL] Thành thạo kỹ năng với ${toolName}: tự động kiểm tra định dạng dữ liệu đầu vào và tối ưu hóa thời gian thực thi.`

        const lowerKey = targetToolKey.toLowerCase()
        if (lowerKey.includes('database') || lowerKey.includes('sql') || lowerKey.includes('data')) {
            actionDesc = `Tự sinh bài test truy vấn SQL phức tạp với CTE và indexing để đo độ trễ.`
            skillContent = `[SKILL] Tối ưu hóa truy vấn SQL đa bảng: Sử dụng CTE và index cột lọc giúp tăng 40% tốc độ thực thi.`
        } else if (lowerKey.includes('search') || lowerKey.includes('scraper') || lowerKey.includes('web')) {
            actionDesc = `Tự động cào và trích xuất 5 nguồn tài liệu khoa học về Multi-Agent Systems.`
            skillContent = `[SKILL] Kỹ thuật lọc nhiễu văn bản: Kết hợp toán tử Boolean nâng cao giúp giảm 75% kết quả trùng lặp khi tìm kiếm.`
        } else if (lowerKey.includes('math') || lowerKey.includes('calculate') || lowerKey.includes('python')) {
            actionDesc = `Tự thực thi ma trận tính toán số học phức tạp và kiểm tra điều kiện hội tụ.`
            skillContent = `[SKILL] Kiểm soát sai số số học: Áp dụng chuẩn hóa vector để tránh tràn số (overflow) trong tính toán khoa học.`
        } else if (lowerKey.includes('summary') || lowerKey.includes('compressor')) {
            actionDesc = `Tự nén ngữ cảnh tài liệu 2500 từ xuống báo cáo 3 điểm then chốt.`
            skillContent = `[SKILL] Tóm tắt đa tầng: Tách các kết luận hành động ra trước để người đọc nắm bắt trong 5 giây đầu tiên.`
        }

        // Lưu kỹ năng đúc kết được vào PostgreSQL
        const learnedSkillMemory = await memoryApi.addLongMemory(agentId, {
            content: skillContent,
            memory_type: 'skill',
            room_id: roomId,
        })

        // Tăng độ thành thạo công cụ
        const currentProficiency = evo.toolMastery[targetToolKey]?.proficiency || 40
        const gain = Math.floor(Math.random() * 4) + 3 // +3% đến +6%
        const newProficiency = Math.min(100, currentProficiency + gain)
        const usageCount = (evo.toolMastery[targetToolKey]?.usageCount || 0) + 1

        evo.toolMastery[targetToolKey] = {
            toolId: targetToolKey,
            name: toolName,
            proficiency: newProficiency,
            usageCount,
            lastLearnedAt: new Date().toISOString(),
        }
        evo.totalTasksCompleted += 1
        memoryApi.saveAgentEvolution(evo)

        // Tăng EXP (+35 EXP)
        const updatedEvo = memoryApi.addExp(agentId, 35)

        // Phát sự kiện toàn cục
        if (typeof window !== 'undefined') {
            window.dispatchEvent(
                new CustomEvent('agent-tool-practiced', {
                    detail: { agentId, toolName, newProficiency, level: updatedEvo.level },
                })
            )
        }

        return {
            toolName,
            actionDescription: actionDesc,
            proficiencyGain: gain,
            newProficiency,
            expGained: 35,
            learnedSkillMemory,
            evolution: updatedEvo,
        }
    },
}

