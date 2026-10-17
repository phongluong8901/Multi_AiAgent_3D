import { Request, Response } from "express";
import { chatService } from "../services/chat.service";
import { memoryService } from "../services/memory.service";
import { publishChatMessage, publishAgentPrompt } from "../events/producers";

export class ChatController {
    /**
     * Lấy lịch sử chat của phòng
     */
    async getHistory(req: Request, res: Response) {
        try {
            const roomId = req.params.roomId as string;
            const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
            const history = await chatService.getRoomHistory(roomId, limit);
            return res.status(200).json({ success: true, data: history });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Gửi tin nhắn qua REST API (tương đương Socket.IO send_message)
     */
    async sendMessage(req: Request, res: Response) {
        try {
            const { roomId, senderId, senderType, senderName, message, targetAgentId, metadata } = req.body;
            if (!roomId || !senderId || !message) {
                return res.status(400).json({ success: false, message: "Missing required fields" });
            }

            const saved = await chatService.saveMessage({
                roomId,
                senderId,
                senderType: senderType || "user",
                senderName: senderName || "Anonymous",
                message,
                metadata,
            });

            // 1. Phát tán tin nhắn tới toàn bộ client trong phòng (Socket.IO + SSE)
            const { broadcastToRoom, agentDispatcher } = await import("../services/agent.dispatcher");
            broadcastToRoom(null, roomId, "receive_message", saved);

            // 2. Publish event lên RabbitMQ
            await publishChatMessage({
                messageId: (saved as any)._id?.toString() || "",
                roomId,
                senderId,
                senderName: senderName || "Anonymous",
                senderType: senderType || "user",
                message,
                targetAgentId,
                createdAt: (saved as any).createdAt,
            });

            // 3. Phân tích đối tượng nhận tin (targetAgentId hoặc @mentions)
            const targetAgents: string[] = [];
            if (targetAgentId) targetAgents.push(targetAgentId);

            const mentioned = agentDispatcher.extractMentionedAgents(message);
            for (const ag of mentioned) {
                if (!targetAgents.includes(ag)) targetAgents.push(ag);
            }

            // 4. Dispatch tới Agent
            if (targetAgents.length > 0) {
                for (const agentId of targetAgents) {
                    agentDispatcher.dispatchToAgent({
                        agentId,
                        roomId,
                        prompt: message,
                        senderName: senderName || "User",
                        senderId,
                        depth: 0,
                    }).catch((err) => {
                        console.error(`[ChatController] Error dispatching to ${agentId}:`, err);
                    });
                }
            }

            return res.status(201).json({ success: true, data: saved });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Server-Sent Events (SSE) Stream: Cho phép Frontend nhận realtime events 
     * (tin nhắn mới, agent status, presence) qua Native Browser EventSource.
     */
    async streamEvents(req: Request, res: Response) {
        const roomId = req.params.roomId as string;
        if (!roomId) {
            return res.status(400).send("roomId is required");
        }

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders();

        const { sseClients } = await import("../services/agent.dispatcher");
        if (!sseClients.has(roomId)) {
            sseClients.set(roomId, new Set());
        }
        const clientSet = sseClients.get(roomId)!;
        clientSet.add(res);

        // Gửi initial ping
        res.write(`event: connected\ndata: ${JSON.stringify({ roomId, connectedAt: new Date().toISOString() })}\n\n`);

        const keepAliveTimer = setInterval(() => {
            try {
                res.write(`: ping\n\n`);
            } catch {
                clearInterval(keepAliveTimer);
            }
        }, 15000);

        req.on("close", () => {
            clearInterval(keepAliveTimer);
            clientSet.delete(res);
            if (clientSet.size === 0) {
                sseClients.delete(roomId);
            }
        });
    }

    /**
     * Lấy danh sách users online và agents trong phòng
     */
    async getPresence(req: Request, res: Response) {
        try {
            const roomId = req.params.roomId as string;
            const { roomPresence } = await import("../services/agent.dispatcher");
            const map = roomPresence.get(roomId);
            const onlineUsers = map ? Array.from(map.values()) : [];
            return res.status(200).json({ success: true, data: { roomId, onlineUsers } });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Cập nhật / báo cáo sự hiện diện của User trong phòng qua REST API
     */
    async updatePresence(req: Request, res: Response) {
        try {
            const roomId = req.params.roomId as string;
            const { user } = req.body;
            if (!user || !user.id) {
                return res.status(400).json({ success: false, message: "user object with id is required" });
            }

            const { roomPresence, broadcastToRoom } = await import("../services/agent.dispatcher");
            if (!roomPresence.has(roomId)) {
                roomPresence.set(roomId, new Map());
            }
            const roomMap = roomPresence.get(roomId)!;
            roomMap.set(user.id, {
                userId: user.id,
                userName: user.name || "User",
                avatar: user.avatar || "",
                color: user.color || "#3b82f6",
                joinedAt: new Date(),
                lastSeen: Date.now(),
            });

            const onlineUsers = Array.from(roomMap.values());
            broadcastToRoom(null, roomId, "room_presence", { roomId, onlineUsers });

            return res.status(200).json({ success: true, data: { roomId, onlineUsers } });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Lấy Short-term memory (Sliding window)
     */
    async getShortMemory(req: Request, res: Response) {
        try {
            const roomId = req.params.roomId as string;
            const turns = req.query.turns ? parseInt(req.query.turns as string) : 10;
            const memory = await memoryService.getShortTermMemory(roomId, turns);
            return res.status(200).json({ success: true, data: memory });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Lấy Long-term memory của agent
     */
    async getLongMemory(req: Request, res: Response) {
        try {
            const agentId = req.params.agentId as string;
            const roomId = req.query.room_id as string | undefined;
            const memories = await memoryService.getLongTermMemories(agentId, roomId);
            return res.status(200).json({ success: true, data: memories });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Lưu Long-term memory mới cho agent
     */
    async addLongMemory(req: Request, res: Response) {
        try {
            const agentId = req.params.agentId as string;
            const { content, memory_type, room_id } = req.body;
            if (!content) {
                return res.status(400).json({ success: false, message: "Content is required" });
            }
            const saved = await memoryService.addLongTermMemory(agentId, { content, memory_type, room_id });
            return res.status(201).json({ success: true, data: saved });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Lấy tổng hợp context (Short + Long memory) để nạp cho Agent
     */
    async getAgentContext(req: Request, res: Response) {
        try {
            const agentId = req.params.agentId as string;
            const roomId = req.query.room_id as string;
            if (!roomId) {
                return res.status(400).json({ success: false, message: "room_id is required" });
            }
            const context = await memoryService.buildAgentContext(agentId, roomId);
            return res.status(200).json({ success: true, data: context });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }
}

export const chatController = new ChatController();