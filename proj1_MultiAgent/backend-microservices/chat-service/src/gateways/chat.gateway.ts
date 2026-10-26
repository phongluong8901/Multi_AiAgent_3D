import { Server as SocketIOServer, Socket } from "socket.io";
import { chatService } from "../services/chat.service";
import { publishChatMessage } from "../events/producers";
import { agentDispatcher, broadcastToRoom, roomPresence } from "../services/agent.dispatcher";
import { ChatType } from "../models/chat.model";

// Theo dõi bản đồ ánh xạ từ socket ID -> thông tin phòng và người dùng ({ roomId, userId, userName, avatar })
const socketUserMap = new Map<string, { roomId: string; userId: string; userName: string; avatar?: string }>();

// Hàm cấu hình và khởi tạo toàn bộ các sự kiện Socket.IO cho chat-service
export const configureSocketChat = (io: SocketIOServer) => {
    agentDispatcher.setIO(io); // Gắn instance của Socket.IO vào AgentDispatcher để phục vụ việc broadcast

    // Lắng nghe sự kiện khi có một client thiết lập kết nối thành công qua Socket.IO
    io.on("connection", (socket: Socket) => {
        console.log(`[chat-service] Client connected: ${socket.id}`);

        // --- 1. SỰ KIỆN: JOIN ROOM ---
        socket.on("join_room", (payload: string | { roomId: string; user?: { id: string; name: string; avatar?: string; color?: string } }) => {
            const roomId = typeof payload === "string" ? payload : payload.roomId;
            const user = typeof payload === "object" && payload.user ? payload.user : {
                id: `guest_${socket.id.slice(0, 5)}`,
                name: `User ${socket.id.slice(0, 4)}`,
            };

            socket.join(roomId); // Đưa socket tham gia vào room của Socket.IO

            // Lưu lại thông tin ánh xạ socket.id với user vào bộ nhớ đệm
            socketUserMap.set(socket.id, {
                roomId,
                userId: user.id,
                userName: user.name,
                avatar: user.avatar,
            });

            // Cập nhật trạng thái sự hiện diện (roomPresence) trong phòng
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
            console.log(`Socket ${socket.id} (${user.name}) joined room: ${roomId}. Total in room: ${currentUsers.length}`);

            // Phát tán danh sách online users mới nhất tới toàn bộ phòng
            broadcastToRoom(io, roomId, "room_presence", {
                roomId,
                onlineUsers: currentUsers,
            });

            // Phát tán thông báo chào mừng có người dùng mới tham gia
            broadcastToRoom(io, roomId, "user_joined", {
                roomId,
                user,
                onlineUsers: currentUsers,
            });
        });

        // --- 2. SỰ KIỆN: LEAVE ROOM ---
        socket.on("leave_room", (roomId: string) => {
            socket.leave(roomId);
            const userMeta = socketUserMap.get(socket.id);
            if (userMeta && roomPresence.has(roomId)) {
                const roomMap = roomPresence.get(roomId)!;
                roomMap.delete(userMeta.userId);

                broadcastToRoom(io, roomId, "room_presence", {
                    roomId,
                    onlineUsers: Array.from(roomMap.values()),
                });
                broadcastToRoom(io, roomId, "user_left", {
                    roomId,
                    user: userMeta,
                });
            }
            socketUserMap.delete(socket.id);
            console.log(`Socket ${socket.id} left room: ${roomId}`);
        });

        // --- 3. SỰ KIỆN: SEND MESSAGE ---
        socket.on("send_message", async (data: {
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
                // Tự động nhận diện typeChat nếu client chưa set
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

                // 1. Lưu trữ tin nhắn vào MongoDB
                const savedMessage = await chatService.saveMessage({
                    ...data,
                    typeChat: chatType,
                    attachments: data.attachments || [],
                });

                // 2. Broadcast qua Socket.IO tới toàn bộ thành viên trong phòng
                broadcastToRoom(io, data.roomId, "receive_message", savedMessage);

                // 3. Đẩy lên RabbitMQ
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

                // 4. Phân tích đối tượng nhận tin và Dispatch tới Agent (dựa trên các agent có mặt trong room)
                const targetAgents = await agentDispatcher.resolveTargetAgents({
                    roomId: data.roomId,
                    message: data.message,
                    chatType: chatType as any,
                    senderType: data.senderType,
                    targetAgentId: data.targetAgentId,
                });

                if (targetAgents.length > 0) {
                    for (const agentId of targetAgents) {
                        agentDispatcher.dispatchToAgent({
                            agentId,
                            roomId: data.roomId,
                            prompt: data.message,
                            senderName: data.senderName,
                            senderId: data.senderId,
                            depth: 0,
                            originalTypeChat: chatType,
                            rootTypeChat: chatType,
                        }).catch((err) => {
                            console.error(`[chat-service] Error dispatching to ${agentId}:`, err);
                        });
                    }
                }
            } catch (error) {
                console.error("[chat-service] Error handling send_message:", error);
                socket.emit("error_message", { message: "Failed to send message" });
            }
        });

        // --- 4. SỰ KIỆN: AGENT ACTION (3D SPACE SYNC) ---
        socket.on("agent_action", (data: {
            roomId: string;
            agentId: string;
            action: "walk" | "sit" | "work" | "idle" | "speak";
            position?: [number, number, number];
            speech?: string;
        }) => {
            broadcastToRoom(io, data.roomId, "agent_3d_state", data);
        });

        // --- 5. SỰ KIỆN: DISCONNECT ---
        socket.on("disconnect", () => {
            const userMeta = socketUserMap.get(socket.id);
            if (userMeta && roomPresence.has(userMeta.roomId)) {
                const roomMap = roomPresence.get(userMeta.roomId)!;
                roomMap.delete(userMeta.userId);

                broadcastToRoom(io, userMeta.roomId, "room_presence", {
                    roomId: userMeta.roomId,
                    onlineUsers: Array.from(roomMap.values()),
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