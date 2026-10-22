import { Request, Response } from "express";
import { chatService } from "../services/chat.service";
import { memoryService } from "../services/memory.service";
import { publishChatMessage } from "../events/producers";
import { asyncHandler } from "../middlewares/async.middleware";
import { AppError } from "../utils/exceptions";
import { getIO } from "../config/socket"; // Lấy Socket.IO instance để broadcast realtime

export class ChatController {
    /**
     * Lấy lịch sử chat của phòng
     */
    getHistory = asyncHandler(async (req: Request, res: Response) => {
        const roomId = req.params.roomId as string;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
        const history = await chatService.getRoomHistory(roomId, limit);
        return res.status(200).json({ success: true, data: history });
    });

    /**
     * Gửi tin nhắn qua REST API (Dự phòng cho HTTP client)
     */
    sendMessage = asyncHandler(async (req: Request, res: Response) => {
        const { roomId, senderId, senderType, senderName, message, targetAgentId, metadata } = req.body;
        if (!roomId || !senderId || !message) {
            throw new AppError("Missing required fields", 400);
        }

        const saved = await chatService.saveMessage({
            roomId,
            senderId,
            senderType: senderType || "user",
            senderName: senderName || "Anonymous",
            message,
            metadata,
        });

        // 1. Broadcast tin nhắn tới client trong phòng qua Socket.IO
        const { broadcastToRoom, agentDispatcher } = await import("../services/agent.dispatcher");
        broadcastToRoom(getIO(), roomId, "receive_message", saved);

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

        // 3. Phân tích đối tượng nhận tin
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
    });

    /**
     * Lấy danh sách users online trong phòng
     */
    getPresence = asyncHandler(async (req: Request, res: Response) => {
        const roomId = req.params.roomId as string;
        const { roomPresence } = await import("../services/agent.dispatcher");
        const map = roomPresence.get(roomId);
        const onlineUsers = map ? Array.from(map.values()) : [];
        return res.status(200).json({ success: true, data: { roomId, onlineUsers } });
    });

    /**
     * Cập nhật sự hiện diện của User qua REST API
     */
    updatePresence = asyncHandler(async (req: Request, res: Response) => {
        const roomId = req.params.roomId as string;
        const { user } = req.body;
        if (!user || !user.id) {
            throw new AppError("user object with id is required", 400);
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
        broadcastToRoom(getIO(), roomId, "room_presence", { roomId, onlineUsers });

        return res.status(200).json({ success: true, data: { roomId, onlineUsers } });
    });

    /**
     * Lấy Short-term memory
     */
    getShortMemory = asyncHandler(async (req: Request, res: Response) => {
        const roomId = req.params.roomId as string;
        const turns = req.query.turns ? parseInt(req.query.turns as string) : 10;
        const memory = await memoryService.getShortTermMemory(roomId, turns);
        return res.status(200).json({ success: true, data: memory });
    });

    /**
     * Lấy Long-term memory của agent
     */
    getLongMemory = asyncHandler(async (req: Request, res: Response) => {
        const agentId = req.params.agentId as string;
        const roomId = req.query.room_id as string | undefined;
        const memories = await memoryService.getLongTermMemories(agentId, roomId);
        return res.status(200).json({ success: true, data: memories });
    });

    /**
     * Lưu Long-term memory mới cho agent
     */
    addLongMemory = asyncHandler(async (req: Request, res: Response) => {
        const agentId = req.params.agentId as string;
        const { content, memory_type, room_id } = req.body;
        if (!content) {
            throw new AppError("Content is required", 400);
        }
        const saved = await memoryService.addLongTermMemory(agentId, { content, memory_type, room_id });
        return res.status(201).json({ success: true, data: saved });
    });

    /**
     * Lấy tổng hợp context (Short + Long memory) để nạp cho Agent
     */
    getAgentContext = asyncHandler(async (req: Request, res: Response) => {
        const agentId = req.params.agentId as string;
        const roomId = req.query.room_id as string;
        if (!roomId) {
            throw new AppError("room_id is required", 400);
        }
        const context = await memoryService.buildAgentContext(agentId, roomId);
        return res.status(200).json({ success: true, data: context });
    });
}

export const chatController = new ChatController();