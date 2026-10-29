import { Request, Response } from "express";
import http from "http";
import { chatService } from "../services/chat.service";
import { memoryService } from "../services/memory.service";
import { publishChatMessage } from "../events/producers";
import { asyncHandler } from "../middlewares/async.middleware";
import { AppError } from "../utils/exceptions";
import { getIO } from "../config/socket";
import { uploadFileToCloudinary } from "../utils/cloudinary.util";
import { syncPresenceToRoomService } from "../gateways/chat.gateway";

function fetchRoomsFromRoomService(): Promise<any[]> {
    return new Promise((resolve) => {
        try {
            const roomServiceUrl = (
                process.env.ROOM_SERVICE_URL || "http://room-service:5002"
            ).replace(/\/$/, "");
            const parsed = new URL(`${roomServiceUrl}/api/v1/rooms/user-user`);
            const req = http.get(
                {
                    hostname: parsed.hostname,
                    port: parsed.port || 5002,
                    path: parsed.pathname,
                    timeout: 3000,
                },
                (res) => {
                    let raw = "";
                    res.on("data", (chunk) => (raw += chunk));
                    res.on("end", () => {
                        try {
                            const json = JSON.parse(raw);
                            resolve(Array.isArray(json?.data) ? json.data : []);
                        } catch {
                            resolve([]);
                        }
                    });
                }
            );
            req.on("error", () => resolve([]));
            req.on("timeout", () => {
                req.destroy();
                resolve([]);
            });
        } catch {
            resolve([]);
        }
    });
}

export class ChatController {
    /**
     * Lấy lịch sử chat của phòng
     */
    getHistory = asyncHandler(async (req: Request, res: Response) => {
        const roomId = req.params.roomId as string;
        const typeChat = req.query.typeChat as string | undefined;
        const targetUserId = req.query.targetUserId as string | undefined;
        const targetAgentId = req.query.targetAgentId as string | undefined;
        const userId = (req.headers["x-user-id"] as string) || (req.query.userId as string);
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 60;

        const history = await chatService.getRoomHistory(roomId, typeChat, limit, {
            userId,
            targetUserId,
            targetAgentId,
        });
        return res.status(200).json({ success: true, data: history });
    });

    /**
     * Danh sách phòng rút gọn dành cho Floating Chat Bubble (kèm tin nhắn cuối + số người Online/Offline)
     * Endpoint: GET /api/v1/chats/bubble/rooms
     */
    getBubbleRooms = asyncHandler(async (_req: Request, res: Response) => {
        const rooms = await fetchRoomsFromRoomService();
        const { roomPresence } = await import("../services/agent.dispatcher");

        const enriched = await Promise.all(
            rooms.map(async (r: any) => {
                const roomId = String(r._id || r.id || "");
                const recent = await chatService.getRoomHistory(roomId, undefined, 1).catch(() => []);
                const lastMessage = recent.length > 0 ? recent[recent.length - 1] : null;

                const chatPresenceMap = roomPresence.get(roomId);
                const chatOnlineUsers = chatPresenceMap ? Array.from(chatPresenceMap.values()) : [];

                // Gộp danh sách online từ cả room-service lẫn chat-service
                const mergedOnlineIds = new Set<string>();
                for (const u of r.onlineUsers || []) {
                    if (u.userId && !String(u.userId).startsWith("agent_")) {
                        mergedOnlineIds.add(String(u.userId));
                    }
                }
                for (const u of chatOnlineUsers) {
                    if (u.userId && !String(u.userId).startsWith("agent_")) {
                        mergedOnlineIds.add(String(u.userId));
                    }
                }

                const humanMembers = (r.members || []).filter(
                    (m: any) => m.memberType !== "agent" && !String(m.memberId).startsWith("agent_")
                );
                const totalMembers = Math.max(humanMembers.length, mergedOnlineIds.size);
                const onlineCount = mergedOnlineIds.size;
                const offlineCount = Math.max(0, totalMembers - onlineCount);

                return {
                    ...r,
                    roomId,
                    totalMembers,
                    onlineCount,
                    offlineCount,
                    lastMessage,
                };
            })
        );

        return res.status(200).json({ success: true, data: enriched });
    });

    /**
     * Gửi tin nhắn qua REST API (Hỗ trợ cả Room Page lẫn Floating Chat Bubble ở ngoài)
     */
    sendMessage = asyncHandler(async (req: Request, res: Response) => {
        const {
            roomId,
            typeChat,
            senderId,
            senderType,
            senderName,
            message,
            targetUserId,
            targetAgentId,
            attachments,
            metadata,
        } = req.body;
        if (!roomId || !senderId || !message) {
            throw new AppError("Missing required fields", 400);
        }

        let resolvedTypeChat = typeChat;
        if (!resolvedTypeChat) {
            if (targetUserId) resolvedTypeChat = "direct";
            else if (targetAgentId || message.includes("@agent_")) resolvedTypeChat = "agent";
            else resolvedTypeChat = "team";
        }

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

        const { broadcastToRoom, agentDispatcher } = await import("../services/agent.dispatcher");
        const io = getIO();
        broadcastToRoom(io, roomId, "receive_message", saved);
        io.emit("bubble_new_message", saved);

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

        if (!metadata?.skipAgentDispatch) {
            const targetAgents = await agentDispatcher.resolveTargetAgents({
                roomId,
                message,
                chatType: resolvedTypeChat,
                senderType: senderType || "user",
                targetAgentId,
            });

            if (targetAgents.length > 0) {
                for (const agentId of targetAgents) {
                    agentDispatcher
                        .dispatchToAgent({
                            agentId,
                            roomId,
                            prompt: message,
                            senderName: senderName || "User",
                            senderId,
                            depth: 0,
                            originalTypeChat: resolvedTypeChat,
                            rootTypeChat: resolvedTypeChat,
                            initiatorAgentId: agentId,
                            userGoal: message,
                            visitedAgents: [agentId],
                        })
                        .catch((err) => {
                            console.error(`[ChatController] Error dispatching to ${agentId}:`, err);
                        });
                }
            }
        }

        return res.status(201).json({ success: true, data: saved });
    });

    /**
     * API upload file đính kèm (Ảnh, CSV, Excel, PDF) lên Cloudinary
     */
    uploadAttachment = asyncHandler(async (req: Request, res: Response) => {
        const file = req.file;
        if (!file) {
            throw new AppError("Không tìm thấy file tải lên", 400);
        }

        const uploadResult = await uploadFileToCloudinary(file);

        return res.status(200).json({
            success: true,
            data: uploadResult,
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
        return res.status(200).json({
            success: true,
            data: {
                roomId,
                onlineUsers,
                onlineCount: onlineUsers.length,
            },
        });
    });

    /**
     * Cập nhật sự hiện diện của User qua REST API & đồng bộ sang room-service
     */
    updatePresence = asyncHandler(async (req: Request, res: Response) => {
        const roomId = req.params.roomId as string;
        const { user, status } = req.body;
        if (!user || !user.id) {
            throw new AppError("user object with id is required", 400);
        }

        const { roomPresence, broadcastToRoom } = await import("../services/agent.dispatcher");
        if (!roomPresence.has(roomId)) {
            roomPresence.set(roomId, new Map());
        }
        const roomMap = roomPresence.get(roomId)!;

        if (status === "offline") {
            roomMap.delete(user.id);
            syncPresenceToRoomService(roomId, user, "offline");
        } else {
            roomMap.set(user.id, {
                userId: user.id,
                userName: user.name || "User",
                avatar: user.avatar || "",
                color: user.color || "#3b82f6",
                joinedAt: new Date(),
                lastSeen: Date.now(),
            });
            syncPresenceToRoomService(roomId, user, "online");
        }

        const onlineUsers = Array.from(roomMap.values());
        broadcastToRoom(getIO(), roomId, "room_presence", {
            roomId,
            onlineUsers,
            onlineCount: onlineUsers.length,
        });

        return res.status(200).json({
            success: true,
            data: { roomId, onlineUsers, onlineCount: onlineUsers.length },
        });
    });

    getShortMemory = asyncHandler(async (req: Request, res: Response) => {
        const roomId = req.params.roomId as string;
        const turns = req.query.turns ? parseInt(req.query.turns as string) : 10;
        const memory = await memoryService.getShortTermMemory(roomId, turns);
        return res.status(200).json({ success: true, data: memory });
    });

    getLongMemory = asyncHandler(async (req: Request, res: Response) => {
        const agentId = req.params.agentId as string;
        const roomId = req.query.room_id as string | undefined;
        const memories = await memoryService.getLongTermMemories(agentId, roomId);
        return res.status(200).json({ success: true, data: memories });
    });

    addLongMemory = asyncHandler(async (req: Request, res: Response) => {
        const agentId = req.params.agentId as string;
        const { content, memory_type, room_id } = req.body;
        if (!content) {
            throw new AppError("Content is required", 400);
        }
        const saved = await memoryService.addLongTermMemory(agentId, {
            content,
            memory_type,
            room_id,
        });
        return res.status(201).json({ success: true, data: saved });
    });

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
