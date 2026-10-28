import { Server as SocketIOServer, Socket } from "socket.io";
import http from "http";
import { chatService } from "../services/chat.service";
import { publishChatMessage } from "../events/producers";
import { agentDispatcher, broadcastToRoom, roomPresence } from "../services/agent.dispatcher";
import { ChatType } from "../models/chat.model";

const socketUserMap = new Map<
    string,
    { roomId: string; userId: string; userName: string; avatar?: string }
>();

/** Đồng bộ trạng thái Online/Offline sang room-service để hiển thị chính xác trên danh sách Room */
export const syncPresenceToRoomService = (
    roomId: string,
    user: { id: string; name: string; avatar?: string; color?: string },
    status: "online" | "offline" = "online"
) => {
    try {
        const roomServiceUrl = (
            process.env.ROOM_SERVICE_URL || "http://room-service:5002"
        ).replace(/\/$/, "");
        const parsed = new URL(
            `${roomServiceUrl}/api/v1/rooms/user-user/${encodeURIComponent(roomId)}/presence`
        );
        const body = JSON.stringify({ user, status });
        const req = http.request(
            {
                hostname: parsed.hostname,
                port: parsed.port || 5002,
                path: parsed.pathname,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(body),
                },
                timeout: 2000,
            },
            (res) => {
                res.resume();
            }
        );
        req.on("error", () => {});
        req.write(body);
        req.end();
    } catch (_e) {}
};

export const configureSocketChat = (io: SocketIOServer) => {
    agentDispatcher.setIO(io);

    io.on("connection", (socket: Socket) => {
        console.log(`[chat-service] Client connected: ${socket.id}`);

        // --- 1. SỰ KIỆN: JOIN ROOM (Hỗ trợ cả Room Page lẫn Floating Chat Bubble ở ngoài) ---
        socket.on(
            "join_room",
            (
                payload:
                    | string
                    | {
                          roomId: string;
                          userId?: string;
                          userName?: string;
                          avatar?: string;
                          color?: string;
                          user?: { id: string; name: string; avatar?: string; color?: string };
                      }
            ) => {
                const roomId = typeof payload === "string" ? payload : payload?.roomId;
                if (!roomId) return;

                const user =
                    typeof payload === "object" && payload?.user
                        ? payload.user
                        : typeof payload === "object" && payload?.userId
                        ? {
                              id: payload.userId,
                              name: payload.userName || `User ${payload.userId.slice(0, 5)}`,
                              avatar: payload.avatar,
                              color: payload.color || "#3b82f6",
                          }
                        : {
                              id: `guest_${socket.id.slice(0, 5)}`,
                              name: `User ${socket.id.slice(0, 4)}`,
                              avatar: "",
                              color: "#3b82f6",
                          };

                socket.join(roomId);

                socketUserMap.set(socket.id, {
                    roomId,
                    userId: user.id,
                    userName: user.name,
                    avatar: user.avatar,
                });

                if (!roomPresence.has(roomId)) {
                    roomPresence.set(roomId, new Map());
                }
                const roomMap = roomPresence.get(roomId)!;
                roomMap.set(user.id, {
                    userId: user.id,
                    userName: user.name,
                    avatar: user.avatar,
                    color: user.color || "#3b82f6",
                    joinedAt: new Date(),
                    socketId: socket.id,
                });

                const currentUsers = Array.from(roomMap.values());
                console.log(
                    `Socket ${socket.id} (${user.name}) joined room: ${roomId}. Total in room: ${currentUsers.length}`
                );

                // Đồng bộ sang room-service
                syncPresenceToRoomService(roomId, user, "online");

                broadcastToRoom(io, roomId, "room_presence", {
                    roomId,
                    onlineUsers: currentUsers,
                    onlineCount: currentUsers.length,
                });

                broadcastToRoom(io, roomId, "user_joined", {
                    roomId,
                    user,
                    onlineUsers: currentUsers,
                });
            }
        );

        // --- 2. SỰ KIỆN: LEAVE ROOM ---
        socket.on("leave_room", (payload: string | { roomId: string }) => {
            const roomId = typeof payload === "string" ? payload : payload?.roomId;
            if (!roomId) return;

            socket.leave(roomId);
            const userMeta = socketUserMap.get(socket.id);
            if (userMeta && roomPresence.has(roomId)) {
                const roomMap = roomPresence.get(roomId)!;
                roomMap.delete(userMeta.userId);
                syncPresenceToRoomService(
                    roomId,
                    { id: userMeta.userId, name: userMeta.userName },
                    "offline"
                );

                broadcastToRoom(io, roomId, "room_presence", {
                    roomId,
                    onlineUsers: Array.from(roomMap.values()),
                    onlineCount: roomMap.size,
                });
                broadcastToRoom(io, roomId, "user_left", {
                    roomId,
                    user: userMeta,
                });
            }
            socketUserMap.delete(socket.id);
        });

        // --- 3. SỰ KIỆN: SEND MESSAGE ---
        socket.on(
            "send_message",
            async (data: {
                roomId: string;
                typeChat?: ChatType;
                senderId: string;
                senderType: "user" | "agent" | "system";
                senderName: string;
                message: string;
                targetUserId?: string;
                targetAgentId?: string;
                attachments?: Array<{
                    fileUrl: string;
                    fileName: string;
                    fileSize?: number;
                    category: "image" | "document";
                    extension: string;
                }>;
                metadata?: any;
            }) => {
                try {
                    let chatType = data.typeChat;
                    if (!chatType) {
                        if (data.targetUserId) {
                            chatType = "direct";
                        } else if (data.targetAgentId || data.message.includes("@agent_")) {
                            chatType = "agent";
                        } else {
                            chatType = "team";
                        }
                    }

                    const savedMessage = await chatService.saveMessage({
                        ...data,
                        typeChat: chatType,
                        attachments: data.attachments || [],
                    });

                    broadcastToRoom(io, data.roomId, "receive_message", savedMessage);
                    // Phát thêm sự kiện toàn cục cho Floating Chat Bubble đang mở ở ngoài nhận biết tin nhắn mới
                    io.emit("bubble_new_message", savedMessage);

                    await publishChatMessage({
                        messageId: (savedMessage as any)._id?.toString() || "",
                        roomId: data.roomId,
                        typeChat: chatType,
                        senderId: data.senderId,
                        senderName: data.senderName,
                        senderType: data.senderType,
                        message: data.message,
                        attachments: data.attachments || [],
                        targetAgentId: data.targetAgentId,
                        createdAt: (savedMessage as any).createdAt,
                    });

                    const targetAgents = await agentDispatcher.resolveTargetAgents({
                        roomId: data.roomId,
                        message: data.message,
                        chatType: chatType as any,
                        senderType: data.senderType,
                        targetAgentId: data.targetAgentId,
                    });

                    if (targetAgents.length > 0) {
                        for (const agentId of targetAgents) {
                            agentDispatcher
                                .dispatchToAgent({
                                    agentId,
                                    roomId: data.roomId,
                                    prompt: data.message,
                                    senderName: data.senderName,
                                    senderId: data.senderId,
                                    depth: 0,
                                    originalTypeChat: chatType,
                                    rootTypeChat: chatType,
                                    initiatorAgentId: agentId,
                                    userGoal: data.message,
                                    visitedAgents: [agentId],
                                })
                                .catch((err) => {
                                    console.error(
                                        `[chat-service] Error dispatching to ${agentId}:`,
                                        err
                                    );
                                });
                        }
                    }
                } catch (error) {
                    console.error("[chat-service] Error handling send_message:", error);
                    socket.emit("error_message", { message: "Failed to send message" });
                }
            }
        );

        // --- 4. SỰ KIỆN: AGENT ACTION (3D SPACE SYNC) ---
        socket.on(
            "agent_action",
            (data: {
                roomId: string;
                agentId: string;
                action: "walk" | "sit" | "work" | "idle" | "speak";
                position?: [number, number, number];
                speech?: string;
            }) => {
                broadcastToRoom(io, data.roomId, "agent_3d_state", data);
            }
        );

        // --- 5. SỰ KIỆN: DISCONNECT ---
        socket.on("disconnect", () => {
            const userMeta = socketUserMap.get(socket.id);
            if (userMeta && roomPresence.has(userMeta.roomId)) {
                const roomMap = roomPresence.get(userMeta.roomId)!;
                roomMap.delete(userMeta.userId);
                syncPresenceToRoomService(
                    userMeta.roomId,
                    { id: userMeta.userId, name: userMeta.userName },
                    "offline"
                );

                broadcastToRoom(io, userMeta.roomId, "room_presence", {
                    roomId: userMeta.roomId,
                    onlineUsers: Array.from(roomMap.values()),
                    onlineCount: roomMap.size,
                });
                broadcastToRoom(io, userMeta.roomId, "user_left", {
                    roomId: userMeta.roomId,
                    user: userMeta,
                });
            }
            socketUserMap.delete(socket.id);
            console.log(`[chat-service] Client disconnected: ${socket.id}`);
        });
    });
};
