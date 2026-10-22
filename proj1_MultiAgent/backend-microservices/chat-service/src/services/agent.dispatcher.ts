import axios from "axios";
import { Server as SocketIOServer } from "socket.io";
import { chatService } from "./chat.service";
import { publishAgentPrompt } from "../events/producers";

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8000";

// Map lưu trữ presence user theo roomId: roomId -> Map<userId, { userId, userName, avatar, lastSeen }>
export const roomPresence = new Map<string, Map<string, any>>();

/**
 * Hàm phát tán dữ liệu realtime chuẩn hóa DUY NHẤT qua Socket.IO
 */
export function broadcastToRoom(io: SocketIOServer | null, roomId: string, event: string, data: any) {
    if (io) {
        io.to(roomId).emit(event, data);
    } else {
        console.warn(`[AgentDispatcher] Socket.IO instance not provided for event ${event} in room ${roomId}`);
    }
}

export class AgentDispatcher {
    private io: SocketIOServer | null = null;
    private knownAgentIds = [
        "agent_manager",
        "agent_ml",
        "agent_analyst",
        "agent_search",
        "agent_summarizer",
    ];

    setIO(io: SocketIOServer) {
        this.io = io;
    }

    /**
     * Trích xuất các agent được nhắc tới trong tin nhắn (@agent_id hoặc @all/@team)
     */
    extractMentionedAgents(text: string, activeRoomAgents?: string[]): string[] {
        if (!text) return [];
        const lower = text.toLowerCase();

        const candidateAgents = activeRoomAgents && activeRoomAgents.length > 0
            ? activeRoomAgents
            : this.knownAgentIds;

        if (lower.includes("@all") || lower.includes("@team") || lower.includes("@nhom")) {
            return ["agent_manager"];
        }

        const mentioned: string[] = [];
        for (const agentId of candidateAgents) {
            const shortName = agentId.replace("agent_", "");
            if (
                lower.includes(`@${agentId}`) ||
                lower.includes(`@${shortName}`)
            ) {
                mentioned.push(agentId);
            }
        }

        return Array.from(new Set(mentioned));
    }

    /**
     * Điều phối tin nhắn tới Agent (hỗ trợ cả RabbitMQ và HTTP Direct Fallback)
     */
    async dispatchToAgent(params: {
        agentId: string;
        roomId: string;
        prompt: string;
        senderName: string;
        senderId: string;
        depth?: number;
    }) {
        const { agentId, roomId, prompt, senderName, senderId, depth = 0 } = params;

        if (depth > 3) {
            console.log(`[AgentDispatcher] Handoff depth limit reached (${depth}) for room ${roomId}`);
            return;
        }

        console.log(`[AgentDispatcher] Dispatching to agent '${agentId}' in room '${roomId}' (depth ${depth})`);

        broadcastToRoom(this.io, roomId, "agent_status", {
            roomId,
            agentId,
            status: "thinking",
            speech: `Đang tiếp nhận yêu cầu từ ${senderName}...`,
        });

        let sentViaMQ = false;
        try {
            await publishAgentPrompt({
                agentId,
                roomId,
                userPrompt: prompt,
                userName: senderName,
                userId: senderId,
            });
            sentViaMQ = true;
        } catch (e: any) {
            console.warn(`[AgentDispatcher] RabbitMQ dispatch failed: ${e.message}. Falling back to direct HTTP.`);
        }

        if (!sentViaMQ) {
            this.executeDirectAgentCall({
                agentId,
                roomId,
                prompt,
                senderName,
                senderId,
                depth,
            }).catch((err) => {
                console.error(`[AgentDispatcher] Direct execution error:`, err);
                broadcastToRoom(this.io, roomId, "agent_status", {
                    roomId,
                    agentId,
                    status: "idle",
                    speech: null,
                });
            });
        }
    }

    private async executeDirectAgentCall(params: {
        agentId: string;
        roomId: string;
        prompt: string;
        senderName: string;
        senderId: string;
        depth: number;
    }) {
        const { agentId, roomId, prompt, senderName, senderId, depth } = params;

        try {
            broadcastToRoom(this.io, roomId, "agent_status", {
                roomId,
                agentId,
                status: "working",
                speech: "Đang phân tích và xử lý...",
            });

            const res = await axios.post(`${AGENT_SERVICE_URL}/api/v1/agents/${agentId}/chat`, {
                message: prompt,
                room_id: roomId,
            }, { timeout: 45000 });

            const data = res.data;
            const answer = data.answer || data.reply || data.content || "Tôi đã nhận được thông tin.";
            const usedTools = data.used_tools || data.toolsUsed || [];
            const trace = data.workflow_trace || data.trace || data.workflowTrace;

            // Nếu depth > 0 thì đây là luồng tự động bàn giao (workflow), ngược lại là team chat thông thường
            const chatType = depth > 0 ? "workflow" : "team";

            // Lưu tin nhắn phản hồi của Agent với typeChat phù hợp
            const savedMessage = await chatService.saveMessage({
                roomId,
                typeChat: chatType,
                senderId: agentId,
                senderType: "agent",
                senderName: this.getAgentDisplayName(agentId),
                message: answer,
                metadata: {
                    usedTools,
                    depth,
                    targetUserId: senderId,
                    workflowTrace: trace,
                },
            });

            broadcastToRoom(this.io, roomId, "receive_message", savedMessage);

            // Nếu có workflow trace thì bắn riêng để client vẽ biểu đồ LangGraph
            if (trace) {
                broadcastToRoom(this.io, roomId, "workflow_trace", trace);
            }

            broadcastToRoom(this.io, roomId, "agent_status", {
                roomId,
                agentId,
                status: "speaking",
                speech: answer.slice(0, 100),
            });

            setTimeout(() => {
                broadcastToRoom(this.io, roomId, "agent_status", {
                    roomId,
                    agentId,
                    status: "idle",
                    speech: null,
                });
            }, 4000);

            // Kiểm tra xem agent có mention (gọi tên) agent khác để bàn giao tiếp không
            const nextAgents = this.extractMentionedAgents(answer);
            for (const nextAgent of nextAgents) {
                if (nextAgent !== agentId) {
                    console.log(`[AgentDispatcher] Autonomous team handoff: ${agentId} -> ${nextAgent}`);
                    await this.dispatchToAgent({
                        agentId: nextAgent,
                        roomId,
                        prompt: `[Bàn giao nhiệm vụ từ ${this.getAgentDisplayName(agentId)}]:\n${answer}`,
                        senderName: this.getAgentDisplayName(agentId),
                        senderId: agentId,
                        depth: depth + 1,
                    });
                }
            }

        } catch (error: any) {
            console.error(`[AgentDispatcher] Failed direct call to ${agentId}:`, error.message);
            const errorMessage = await chatService.saveMessage({
                roomId,
                typeChat: "system", // Lưu dạng thông báo lỗi hệ thống
                senderId: agentId,
                senderType: "agent",
                senderName: this.getAgentDisplayName(agentId),
                message: `[Lỗi phản hồi]: Không thể kết nối với Agent Service: ${error.message}`,
            });
            broadcastToRoom(this.io, roomId, "receive_message", errorMessage);
            broadcastToRoom(this.io, roomId, "agent_status", {
                roomId,
                agentId,
                status: "idle",
                speech: null,
            });
        }
    }

    private getAgentDisplayName(agentId: string): string {
        const names: Record<string, string> = {
            agent_manager: "Manager Agent",
            agent_ml: "ML Expert",
            agent_analyst: "Data Analyst",
            agent_search: "Search Expert",
            agent_summarizer: "Summarizer Agent",
        };
        return names[agentId] || agentId;
    }
}

export const agentDispatcher = new AgentDispatcher();