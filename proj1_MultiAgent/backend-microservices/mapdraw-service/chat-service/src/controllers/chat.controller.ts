import { Request, Response } from "express";
import { chatService } from "../services/chat.service";
import { memoryService } from "../services/memory.service";
import { publishChatMessage } from "../events/producers";
import { asyncHandler } from "../middlewares/async.middleware";
import { AppError } from "../utils/exceptions";
import { getIO } from "../config/socket"; // Lấy Socket.IO instance để broadcast realtime
import { uploadFileToCloudinary } from "../utils/cloudinary.util"; // Import hàm upload Cloudinary đã tách 2 thư mục

export class ChatController {
    /**
     * Lấy lịch sử chat của phòng (Có hỗ trợ lọc theo typeChat tùy chọn qua query params)
     * Ví dụ: GET /api/v1/chats/history/:roomId?typeChat=team&limit=50
     */
    getHistory = asyncHandler(async (req: Request, res: Response) => {
        const roomId = req.params.roomId as string;
        const typeChat = req.query.typeChat as string | undefined; // Lấy thêm tham số lọc typeChat nếu có
        const targetUserId = req.query.targetUserId as string | undefined;
        const targetAgentId = req.query.targetAgentId as string | undefined;
        const userId = (req.headers["x-user-id"] as string) || (req.query.userId as string);
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 60;

        // Gọi service lấy lịch sử với tham số typeChat và filter truyền vào
        const history = await chatService.getRoomHistory(roomId, typeChat, limit, {
            userId,
            targetUserId,
            targetAgentId,
        });
        return res.status(200).json({ success: true, data: history });
    });

    /**
     * Gửi tin nhắn qua REST API (Dự phòng cho HTTP client - Hỗ trợ cả attachments & typeChat: team, direct, agent, workflow)
     */
    sendMessage = asyncHandler(async (req: Request, res: Response) => {
        const { roomId, typeChat, senderId, senderType, senderName, message, targetUserId, targetAgentId, attachments, metadata } = req.body;
        if (!roomId || !senderId || !message) {
            throw new AppError("Missing required fields", 400);
        }

        // Tự động nhận diện typeChat
        let resolvedTypeChat = typeChat;
        if (!resolvedTypeChat) {
            if (targetUserId) resolvedTypeChat = "direct";
            else if (targetAgentId || message.includes("@agent_")) resolvedTypeChat = "agent";
            else resolvedTypeChat = "team";
        }

        // 1. Lưu tin nhắn vào MongoDB
        const saved = await chatService.saveMessage({
            roomId,
            typeChat: resolvedTypeChat,
            senderId,
            senderType: senderType || "user",
            senderName: senderName || "Anonymous",
            message,
            targetUserId,
            targetAgentId,
            attachments: attachments || [],
            metadata,
        });

        // 2. Broadcast tin nhắn tới client trong phòng qua Socket.IO
        const { broadcastToRoom, agentDispatcher } = await import("../services/agent.dispatcher");
        broadcastToRoom(getIO(), roomId, "receive_message", saved);

        // 3. Publish event lên RabbitMQ
        await publishChatMessage({
            messageId: (saved as any)._id?.toString() || "",
            roomId,
            typeChat: resolvedTypeChat,
            senderId,
            senderName: senderName || "Anonymous",
            senderType: senderType || "user",
            message,
            attachments: attachments || [],
            targetAgentId,
            createdAt: (saved as any).createdAt,
        });

        // 4. Phân tích đối tượng nhận tin và Dispatch tới Agent nếu có mention hoặc là chat agent
        const targetAgents = await agentDispatcher.resolveTargetAgents({
            roomId,
            message,
            chatType: resolvedTypeChat,
            senderType: senderType || "user",
            targetAgentId,
        });

        if (targetAgents.length > 0) {
            for (const agentId of targetAgents) {
                agentDispatcher.dispatchToAgent({
                    agentId,
                    roomId,
                    prompt: message,
                    senderName: senderName || "User",
                    senderId,
                    depth: 0,
                    originalTypeChat: resolvedTypeChat,
                    rootTypeChat: resolvedTypeChat,
                }).catch((err) => {
                    console.error(`[ChatController] Error dispatching to ${agentId}:`, err);
                });
            }
        }

        return res.status(201).json({ success: true, data: saved });
    });

    /**
     * API upload file đính kèm (Ảnh, CSV, Excel, PDF) lên Cloudinary
     * Endpoint: POST /api/v1/chats/upload
     */
    uploadAttachment = asyncHandler(async (req: Request, res: Response) => {
        const file = req.file;
        if (!file) {
            throw new AppError("Không tìm thấy file tải lên", 400);
        }

        // Gọi utility đẩy buffer lên Cloudinary (tự phân loại vào MultiAgent3dChatImg hoặc MultiAgent3dChatDoc)
        const uploadResult = await uploadFileToCloudinary(file);

        return res.status(200).json({
            success: true,
            data: uploadResult, // Trả về { fileUrl, fileName, fileSize, category, extension }
        });
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