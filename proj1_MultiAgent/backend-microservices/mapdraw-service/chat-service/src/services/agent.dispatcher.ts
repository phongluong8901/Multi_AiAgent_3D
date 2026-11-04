import axios from "axios";
import { Server as SocketIOServer } from "socket.io";
import { chatService } from "./chat.service";
import { publishAgentPrompt } from "../events/producers";

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8000";
const ROOM_SERVICE_URL = process.env.ROOM_SERVICE_URL || "http://room-service:5002";
// Thời gian tối đa chờ agent trả lời qua HTTP trực tiếp (LLM + tools có thể chạy lâu)
const AGENT_HTTP_TIMEOUT_MS = parseInt(process.env.AGENT_HTTP_TIMEOUT_MS || "120000");
// Thời gian tối đa chờ reply qua RabbitMQ trước khi báo lỗi cho người dùng
const AGENT_REPLY_TIMEOUT_MS = parseInt(process.env.AGENT_REPLY_TIMEOUT_MS || "180000");
// Giới hạn số bước bàn giao giữa các agent để tránh vòng lặp vô hạn
const MAX_HANDOFF_DEPTH = 4;

export type ChatType = "team" | "direct" | "agent" | "workflow" | "system";

export type AgentWorkflowMode = "solo" | "sequential" | "routing" | "autonomous";

export interface IWorkflowTransition {
    fromAgentId: string;
    toAgentId: string;
    condition?: string;
}

export interface IAgentWorkflow {
    mode: AgentWorkflowMode;
    order?: string[];
    transitions?: IWorkflowTransition[];
    enabled?: boolean;
    description?: string;
}

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

export interface DispatchParams {
    agentId: string;
    roomId: string;
    prompt: string;
    senderName: string;
    senderId: string;
    depth?: number;
    originalTypeChat?: ChatType;
    // Kênh chat gốc nơi người dùng đặt câu hỏi (giữ nguyên qua các bước bàn giao)
    rootTypeChat?: ChatType;
}

export interface AgentReplyPayload {
    agentId: string;
    agentName?: string;
    roomId: string;
    answer: string;
    usedTools?: string[];
    trace?: any;
    depth?: number;
    typeChat?: ChatType;
    rootTypeChat?: ChatType;
    senderId?: string;
    model?: string;
    usage?: any;
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
    // Cache danh sách active agents của từng phòng: roomId -> { agents, expiresAt }
    private roomAgentsCache = new Map<string, { agents: string[]; expiresAt: number }>();
    // Cache cấu hình workflow của từng phòng: roomId -> { workflow, expiresAt }
    private roomWorkflowCache = new Map<string, { workflow?: IAgentWorkflow | null; expiresAt: number }>();
    // Theo dõi các prompt đã gửi qua MQ nhưng chưa có reply: key = roomId:agentId
    private pendingReplies = new Map<string, NodeJS.Timeout>();

    setIO(io: SocketIOServer) {
        this.io = io;
    }

    /**
     * Lấy danh sách các AI Agent đang có mặt trong phòng cụ thể
     */
    async getRoomActiveAgents(roomId: string): Promise<string[]> {
        if (!roomId) return [];
        const cached = this.roomAgentsCache.get(roomId);
        const now = Date.now();
        if (cached && cached.expiresAt > now) {
            return cached.agents;
        }

        try {
            const res = await axios.get(`${ROOM_SERVICE_URL}/api/v1/rooms/user-user/${roomId}`, {
                timeout: 3000,
            });
            const roomData = res.data?.data || res.data || {};
            const active = Array.isArray(roomData.activeAgents) ? roomData.activeAgents : [];
            this.roomAgentsCache.set(roomId, { agents: active, expiresAt: now + 30000 });
            return active;
        } catch (err: any) {
            console.warn(`[AgentDispatcher] Note: couldn't fetch activeAgents for room ${roomId}: ${err.message}`);
            return cached ? cached.agents : [];
        }
    }

    /**
     * Cập nhật cache active agents của room khi có event từ room-service
     */
    updateRoomAgentsCache(roomId: string, activeAgents: string[]) {
        if (!roomId) return;
        this.roomAgentsCache.set(roomId, { agents: activeAgents, expiresAt: Date.now() + 60000 });
    }

    /**
     * Lấy cấu hình Workflow Agent của phòng (nếu có)
     */
    async getRoomWorkflow(roomId: string): Promise<IAgentWorkflow | null> {
        if (!roomId) return null;
        const cached = this.roomWorkflowCache.get(roomId);
        const now = Date.now();
        if (cached && cached.expiresAt > now) {
            return cached.workflow || null;
        }

        try {
            const res = await axios.get(`${ROOM_SERVICE_URL}/api/v1/rooms/user-user/${roomId}`, {
                timeout: 3000,
            });
            const roomData = res.data?.data || res.data || {};
            const workflow = (roomData.workflow as IAgentWorkflow) || null;
            this.roomWorkflowCache.set(roomId, { workflow, expiresAt: now + 30000 });
            return workflow;
        } catch (err: any) {
            return cached?.workflow || null;
        }
    }

    /**
     * Cập nhật cache workflow của room khi có event từ room-service
     */
    updateRoomWorkflowCache(roomId: string, workflow?: IAgentWorkflow | null, activeAgents?: string[]) {
        if (!roomId) return;
        if (workflow !== undefined) {
            this.roomWorkflowCache.set(roomId, { workflow, expiresAt: Date.now() + 60000 });
        }
        if (activeAgents && Array.isArray(activeAgents)) {
            this.updateRoomAgentsCache(roomId, activeAgents);
        }
    }

    /**
     * Trích xuất các agent được nhắc tới trong tin nhắn (@agent_id hoặc @all/@team)
     * Ưu tiên tìm trong danh sách các agent thực tế của phòng
     */
    extractMentionedAgents(text: string, activeRoomAgents?: string[]): string[] {
        if (!text) return [];
        const lower = text.toLowerCase();

        const candidateAgents = activeRoomAgents && activeRoomAgents.length > 0
            ? activeRoomAgents
            : this.knownAgentIds;

        if (lower.includes("@all") || lower.includes("@team") || lower.includes("@nhom")) {
            const lead = candidateAgents.find(a => a.includes("manager") || a.includes("lead")) || candidateAgents[0];
            return lead ? [lead] : [];
        }

        const mentioned: string[] = [];
        for (const agentId of candidateAgents) {
            const shortName = agentId.replace(/^agent_/, "");
            if (
                lower.includes(`@${agentId.toLowerCase()}`) ||
                (shortName && lower.includes(`@${shortName.toLowerCase()}`))
            ) {
                mentioned.push(agentId);
            }
        }

        return Array.from(new Set(mentioned));
    }

    /**
     * Xác định danh sách agent cần trả lời tin nhắn của người dùng trong phòng hiện tại:
     * - Chỉ sử dụng các agent thực tế đang có mặt trong phòng đó (room.activeAgents).
     * - Ưu tiên agent được chọn (targetAgentId) + agent được @mention trong phòng.
     * - Nếu không chọn và không mention: Tự động giao cho Agent trưởng nhóm (manager/lead) hoặc Agent đầu tiên trong phòng.
     * - Nếu phòng không có agent nào: Không kích hoạt để tránh lỗi.
     */
    async resolveTargetAgents(params: {
        roomId: string;
        message: string;
        chatType: ChatType;
        senderType: "user" | "agent" | "system";
        targetAgentId?: string;
    }): Promise<string[]> {
        const { roomId, message, chatType, senderType, targetAgentId } = params;
        const roomAgents = await this.getRoomActiveAgents(roomId);

        const targets: string[] = [];
        if (targetAgentId) targets.push(targetAgentId);

        for (const ag of this.extractMentionedAgents(message, roomAgents)) {
            if (!targets.includes(ag)) targets.push(ag);
        }

        if (targets.length > 0 || senderType !== "user") return targets;

        // Nếu phòng này chưa có bất kỳ AI agent nào được thêm vào, không gọi agent
        if (roomAgents.length === 0) {
            return [];
        }

        const workflow = await this.getRoomWorkflow(roomId);

        // Nếu phòng đang bật workflow tuần tự (sequential) và không chỉ định agent:
        // Khởi động từ agent đầu tiên trong pipeline có mặt trong phòng
        if (workflow?.enabled && workflow.mode === "sequential" && Array.isArray(workflow.order) && workflow.order.length > 0) {
            const firstActive = workflow.order.find(ag => roomAgents.includes(ag));
            if (firstActive) {
                console.log(`[AgentDispatcher] Sequential workflow in room ${roomId}: starting with first agent '${firstActive}'`);
                return [firstActive];
            }
        }

        // Chọn agent trưởng nhóm (có chữ manager hoặc lead) hoặc agent đầu tiên trong phòng
        const defaultAgent = roomAgents.find(a => a.includes("manager") || a.includes("lead")) || roomAgents[0];

        if (chatType === "agent" || chatType === "workflow") {
            return defaultAgent ? [defaultAgent] : [];
        }

        if (chatType === "team") {
            const text = (message || "").trim().toLowerCase();
            const keywords = [
                "?", "hãy", "giúp", "check", "tìm", "tính", "phân tích", "tóm tắt",
                "thời tiết", "xử lý", "nhóm", "team",
            ];
            if (text.startsWith("/") || keywords.some((k) => text.includes(k))) {
                console.log(`[AgentDispatcher] Auto-assigning team request in room ${roomId} to '${defaultAgent}'`);
                return defaultAgent ? [defaultAgent] : [];
            }
        }

        return [];
    }

    /**
     * Điều phối tin nhắn tới Agent (hỗ trợ cả RabbitMQ và HTTP Direct Fallback)
     */
    async dispatchToAgent(params: DispatchParams) {
        const { agentId, roomId, prompt, senderName, senderId, depth = 0, originalTypeChat = "agent" } = params;
        const rootTypeChat = params.rootTypeChat || originalTypeChat;
        const typeChat: ChatType = depth > 0 ? "workflow" : originalTypeChat;

        if (depth > MAX_HANDOFF_DEPTH) {
            console.log(`[AgentDispatcher] Handoff depth limit reached (${depth}) for room ${roomId}`);
            return;
        }

        console.log(`[AgentDispatcher] Dispatching to agent '${agentId}' in room '${roomId}' (depth ${depth}, type ${typeChat})`);

        broadcastToRoom(this.io, roomId, "agent_status", {
            roomId,
            agentId,
            status: "thinking",
            speech: `Đang tiếp nhận yêu cầu từ ${senderName}...`,
        });

        let sentViaMQ = false;
        const roomAgents = await this.getRoomActiveAgents(roomId);
        const workflow = await this.getRoomWorkflow(roomId);
        try {
            await publishAgentPrompt({
                agentId,
                roomId,
                userPrompt: prompt,
                userName: senderName,
                userId: senderId,
                depth,
                context: { depth, typeChat, rootTypeChat, senderId, senderName, activeAgents: roomAgents, workflow },
            });
            sentViaMQ = true;
            this.startPendingTimer(roomId, agentId);
        } catch (e: any) {
            console.warn(`[AgentDispatcher] RabbitMQ dispatch failed: ${e.message}. Falling back to direct HTTP.`);
        }

        if (!sentViaMQ) {
            this.executeDirectAgentCall({ ...params, depth, originalTypeChat: typeChat, rootTypeChat }).catch((err) => {
                console.error(`[AgentDispatcher] Direct execution error:`, err);
                this.setIdle(roomId, agentId);
            });
        }
    }

    /**
     * Xử lý reply từ agent (dùng chung cho cả luồng RabbitMQ và HTTP trực tiếp):
     * lưu MongoDB -> broadcast Socket.IO -> cập nhật trạng thái 3D -> bàn giao cho agent tiếp theo nếu có.
     */
    async handleAgentReply(reply: AgentReplyPayload) {
        const { agentId, roomId } = reply;
        const depth = reply.depth || 0;
        const answer = String(reply.answer || "").trim() || "Tôi đã nhận được thông tin.";
        const agentName = reply.agentName && reply.agentName !== agentId
            ? reply.agentName
            : this.getAgentDisplayName(agentId);
        const chatType: ChatType = depth > 0 ? "workflow" : (reply.typeChat || "agent");
        const rootTypeChat: ChatType = reply.rootTypeChat || chatType;

        this.clearPendingTimer(roomId, agentId);

        const savedMessage = await chatService.saveMessage({
            roomId,
            typeChat: chatType,
            senderId: agentId,
            senderType: "agent",
            senderName: agentName,
            message: answer,
            targetAgentId: agentId,
            metadata: {
                model: reply.model,
                usage: reply.usage,
                usedTools: reply.usedTools || [],
                depth,
                rootTypeChat,
                targetUserId: reply.senderId,
                workflowTrace: reply.trace,
            },
        });

        broadcastToRoom(this.io, roomId, "receive_message", savedMessage);

        // Nếu có workflow trace thì bắn riêng để client vẽ biểu đồ LangGraph
        if (reply.trace) {
            broadcastToRoom(this.io, roomId, "workflow_trace", reply.trace);
        }

        broadcastToRoom(this.io, roomId, "agent_status", {
            roomId,
            agentId,
            status: "speaking",
            speech: answer.slice(0, 100),
        });
        setTimeout(() => this.setIdle(roomId, agentId), 4000);

        // Lấy danh sách agent thực tế và cấu hình workflow của phòng
        const roomAgents = await this.getRoomActiveAgents(roomId);
        const workflow = await this.getRoomWorkflow(roomId);

        // 1. CHẾ ĐỘ ĐƠN LẺ (SOLO): Dừng ngay lập tức, không chuyển tiếp cho agent nào khác
        if (workflow?.enabled && workflow.mode === "solo") {
            console.log(`[AgentDispatcher] Room ${roomId} workflow is 'solo'. Stopping handoff after '${agentId}'.`);
            return;
        }

        // 2. CHẾ ĐỘ TUẦN TỰ (SEQUENTIAL PIPELINE): Chuyển tiếp theo thứ tự chuỗi pipeline
        if (workflow?.enabled && workflow.mode === "sequential" && Array.isArray(workflow.order) && workflow.order.length > 0) {
            const currentIndex = workflow.order.indexOf(agentId);
            if (currentIndex >= 0 && currentIndex < workflow.order.length - 1) {
                const nextAgent = workflow.order[currentIndex + 1];
                if (roomAgents.includes(nextAgent)) {
                    const stepNum = currentIndex + 2;
                    const totalSteps = workflow.order.length;
                    console.log(`[AgentDispatcher] Sequential pipeline in room ${roomId}: ${agentId} -> ${nextAgent} (Step ${stepNum}/${totalSteps})`);

                    broadcastToRoom(this.io, roomId, "agent_status", {
                        roomId,
                        agentId,
                        status: "speaking",
                        speech: `Chuyển tiếp bước ${stepNum}/${totalSteps} cho ${this.getAgentDisplayName(nextAgent)}...`,
                    });

                    await this.dispatchToAgent({
                        agentId: nextAgent,
                        roomId,
                        prompt: `[Chuỗi tuần tự Bước ${stepNum}/${totalSteps} - Bàn giao từ ${agentName}]:\n${answer}`,
                        senderName: agentName,
                        senderId: agentId,
                        depth: depth + 1,
                        originalTypeChat: "workflow",
                        rootTypeChat,
                    });
                    return;
                }
            } else if (currentIndex === workflow.order.length - 1) {
                console.log(`[AgentDispatcher] Sequential pipeline completed in room ${roomId} at last agent '${agentId}'.`);
                return;
            }
        }

        // 3. CHẾ ĐỘ ĐỊNH TUYẾN THEO QUY TẮC (ROUTING / CUSTOM DAG)
        if (workflow?.enabled && workflow.mode === "routing" && Array.isArray(workflow.transitions) && workflow.transitions.length > 0) {
            const matchedTransitions = workflow.transitions.filter(
                t => t.fromAgentId === agentId && t.toAgentId && t.toAgentId !== "end" && t.toAgentId !== agentId
            );

            if (matchedTransitions.length > 0) {
                for (const t of matchedTransitions) {
                    const targetAgent = t.toAgentId;
                    if (roomAgents.includes(targetAgent)) {
                        const condText = t.condition ? ` (${t.condition})` : "";
                        console.log(`[AgentDispatcher] Routing workflow in room ${roomId}: ${agentId} -> ${targetAgent}${condText}`);

                        broadcastToRoom(this.io, roomId, "agent_status", {
                            roomId,
                            agentId,
                            status: "speaking",
                            speech: `Chuyển tiếp theo quy tắc cho ${this.getAgentDisplayName(targetAgent)}...`,
                        });

                        await this.dispatchToAgent({
                            agentId: targetAgent,
                            roomId,
                            prompt: `[Định tuyến luồng công việc${condText} - Bàn giao từ ${agentName}]:\n${answer}`,
                            senderName: agentName,
                            senderId: agentId,
                            depth: depth + 1,
                            originalTypeChat: "workflow",
                            rootTypeChat,
                        });
                    }
                }
                return;
            } else {
                console.log(`[AgentDispatcher] Routing workflow: No next transition for '${agentId}' in room ${roomId}. Workflow ended.`);
                return;
            }
        }

        // 4. CHẾ ĐỘ TỰ DO (AUTONOMOUS / DEFAULT): Dựa trên @mention trong nội dung trả lời
        const nextAgents = this.extractMentionedAgents(answer, roomAgents).filter((a) => a !== agentId);
        for (const nextAgent of nextAgents) {
            console.log(`[AgentDispatcher] Autonomous team handoff: ${agentId} -> ${nextAgent} (depth ${depth + 1})`);

            broadcastToRoom(this.io, roomId, "agent_status", {
                roomId,
                agentId,
                status: "speaking",
                speech: `Đã bàn giao tiếp cho ${this.getAgentDisplayName(nextAgent)}...`,
            });

            await this.dispatchToAgent({
                agentId: nextAgent,
                roomId,
                prompt: `[Bàn giao nhiệm vụ từ ${agentName}]:\n${answer}`,
                senderName: agentName,
                senderId: agentId,
                depth: depth + 1,
                originalTypeChat: "workflow",
                rootTypeChat,
            });
        }
    }

    private async executeDirectAgentCall(params: DispatchParams & { depth: number; rootTypeChat: ChatType }) {
        const { agentId, roomId, prompt, senderId, depth, originalTypeChat, rootTypeChat } = params;

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
            }, { timeout: AGENT_HTTP_TIMEOUT_MS });

            const data = res.data || {};
            await this.handleAgentReply({
                agentId,
                agentName: data.agent_name || data.agentName,
                roomId,
                answer: data.answer || data.reply || data.content || (data.error ? `⚠️ ${data.error}` : ""),
                usedTools: data.used_tools || data.toolsUsed || [],
                trace: data.workflow_trace || data.trace || data.workflowTrace,
                depth,
                typeChat: originalTypeChat,
                rootTypeChat,
                senderId,
            });
        } catch (error: any) {
            console.error(`[AgentDispatcher] Failed direct call to ${agentId}:`, error.message);
            await this.notifyAgentError(roomId, agentId, `Không thể kết nối với Agent Service: ${error.message}`);
        }
    }

    private async notifyAgentError(roomId: string, agentId: string, reason: string) {
        try {
            const errorMessage = await chatService.saveMessage({
                roomId,
                typeChat: "system", // Lưu dạng thông báo lỗi hệ thống
                senderId: agentId,
                senderType: "system",
                senderName: this.getAgentDisplayName(agentId),
                message: `⚠️ ${this.getAgentDisplayName(agentId)}: ${reason}`,
            });
            broadcastToRoom(this.io, roomId, "receive_message", errorMessage);
        } catch (err: any) {
            console.error(`[AgentDispatcher] Could not save error message:`, err.message);
        }
        this.setIdle(roomId, agentId);
    }

    private setIdle(roomId: string, agentId: string) {
        broadcastToRoom(this.io, roomId, "agent_status", {
            roomId,
            agentId,
            status: "idle",
            speech: null,
        });
    }

    private startPendingTimer(roomId: string, agentId: string) {
        const key = `${roomId}:${agentId}`;
        this.clearPendingTimer(roomId, agentId);
        const timer = setTimeout(() => {
            this.pendingReplies.delete(key);
            console.warn(`[AgentDispatcher] No reply from '${agentId}' in room '${roomId}' after ${AGENT_REPLY_TIMEOUT_MS}ms`);
            this.notifyAgentError(
                roomId,
                agentId,
                `chưa phản hồi sau ${Math.round(AGENT_REPLY_TIMEOUT_MS / 1000)}s. Hãy kiểm tra agent-service và RabbitMQ.`
            );
        }, AGENT_REPLY_TIMEOUT_MS);
        this.pendingReplies.set(key, timer);
    }

    private clearPendingTimer(roomId: string, agentId: string) {
        const key = `${roomId}:${agentId}`;
        const timer = this.pendingReplies.get(key);
        if (timer) {
            clearTimeout(timer);
            this.pendingReplies.delete(key);
        }
    }

    getAgentDisplayName(agentId: string): string {
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