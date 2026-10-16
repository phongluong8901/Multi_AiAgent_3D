import axios from "axios";
import { chatRepository } from "../repositories/chat.repository";

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8000";

export class MemoryService {
    /**
     * Tách và lấy Short-term Memory (Sliding Window):
     * Lấy N tin nhắn gần nhất từ Chat Database để làm context hội thoại cho Agent.
     */
    async getShortTermMemory(roomId: string, turns: number = 10) {
        const messages = await chatRepository.findByRoomId(roomId, turns * 2);
        // Format theo chuẩn LLM chat completion
        return messages.map((m: any) => ({
            role: m.senderType === "agent" ? "assistant" : m.senderType === "system" ? "system" : "user",
            name: m.senderName,
            content: m.message,
            timestamp: m.createdAt,
        }));
    }

    /**
     * Đồng bộ short-term memory sang agent-service (Redis cache)
     */
    async syncShortMemoryToAgent(agentId: string, roomId: string, role: string, content: string) {
        try {
            await axios.post(`${AGENT_SERVICE_URL}/api/v1/agents/${agentId}/memory/short`, {
                agent_id: agentId,
                room_id: roomId,
                role: role,
                content: content,
            });
        } catch (error: any) {
            console.warn(`[MemoryService] Failed to sync short memory to agent-service: ${error.message}`);
        }
    }

    /**
     * Lấy Long-term Memory của Agent từ Agent-Service (PostgreSQL)
     */
    async getLongTermMemories(agentId: string, roomId?: string) {
        try {
            const url = `${AGENT_SERVICE_URL}/api/v1/agents/${agentId}/memory/long${roomId ? `?room_id=${roomId}` : ""}`;
            const response = await axios.get(url);
            return response.data?.data || [];
        } catch (error: any) {
            console.warn(`[MemoryService] Failed to get long memories: ${error.message}`);
            return [];
        }
    }

    /**
     * Thêm Fact/Knowledge vào Long-term Memory của Agent
     */
    async addLongTermMemory(agentId: string, payload: {
        content: string;
        memory_type?: "fact" | "rule" | "user_preference" | "summary";
        room_id?: string;
    }) {
        try {
            const url = `${AGENT_SERVICE_URL}/api/v1/agents/${agentId}/memory/long`;
            const response = await axios.post(url, {
                agent_id: agentId,
                room_id: payload.room_id,
                memory_type: payload.memory_type || "fact",
                content: payload.content,
            });
            return response.data;
        } catch (error: any) {
            console.error(`[MemoryService] Failed to save long memory: ${error.message}`);
            throw error;
        }
    }

    /**
     * Tổng hợp Memory Context hoàn chỉnh (gồm cả Short + Long memory) để nạp cho Agent Prompt
     */
    async buildAgentContext(agentId: string, roomId: string) {
        const [shortMem, longMem] = await Promise.all([
            this.getShortTermMemory(roomId, 10),
            this.getLongTermMemories(agentId, roomId),
        ]);

        return {
            agentId,
            roomId,
            shortMemory: shortMem,
            longMemory: longMem,
        };
    }
}

export const memoryService = new MemoryService();
