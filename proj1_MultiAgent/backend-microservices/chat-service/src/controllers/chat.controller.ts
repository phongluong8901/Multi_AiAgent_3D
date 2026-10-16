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
     * Gửi tin nhắn qua REST API
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

            if (targetAgentId && senderType === "user") {
                await publishAgentPrompt({
                    agentId: targetAgentId,
                    roomId,
                    userPrompt: message,
                    userName: senderName || "User",
                    userId: senderId,
                });
            }

            return res.status(201).json({ success: true, data: saved });
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