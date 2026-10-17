import { Server as SocketIOServer, Socket } from "socket.io";
import { chatService } from "../services/chat.service";
import { publishChatMessage } from "../events/producers";
import { agentDispatcher, broadcastToRoom, roomPresence } from "../services/agent.dispatcher";

// Track socket ID -> { roomId, userId, userName }
const socketUserMap = new Map<string, { roomId: string; userId: string; userName: string; avatar?: string }>();

export const configureSocketChat = (io: SocketIOServer) => {
    agentDispatcher.setIO(io);

    io.on("connection", (socket: Socket) => {
        console.log(`[chat-service] Client connected: ${socket.id}`);

        // Client/User join vào một phòng cụ thể cùng danh tính user
        socket.on("join_room", (payload: string | { roomId: string; user?: { id: string; name: string; avatar?: string; color?: string } }) => {
            const roomId = typeof payload === "string" ? payload : payload.roomId;
            const user = typeof payload === "object" && payload.user ? payload.user : {
                id: `guest_${socket.id.slice(0, 5)}`,
                name: `User ${socket.id.slice(0, 4)}`,
            };

            socket.join(roomId);

            // Lưu mapping socket -> user
            socketUserMap.set(socket.id, {
                roomId,
                userId: user.id,
                userName: user.name,
                avatar: user.avatar,
            });

            // Cập nhật roomPresence
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

            // Phát tán presence tới cả phòng
            broadcastToRoom(io, roomId, "room_presence", {
                roomId,
                onlineUsers: currentUsers,
            });

            // Phát tán thông báo người dùng mới tham gia
            broadcastToRoom(io, roomId, "user_joined", {
                roomId,
                user,
                onlineUsers: currentUsers,
            });
        });

        // Client leave phòng
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

        // Lắng nghe sự kiện gửi tin nhắn real-time
        socket.on("send_message", async (data: {
            roomId: string;
            senderId: string;
            senderType: "user" | "agent" | "system";
            senderName: string;
            message: string;
            targetAgentId?: string;
            metadata?: any;
        }) => {
            try {
                // 1. Lưu tin nhắn vào MongoDB
                const savedMessage = await chatService.saveMessage(data);

                // 2. Phát tán tin nhắn tới toàn bộ client đang trong phòng đó
                broadcastToRoom(io, data.roomId, "receive_message", savedMessage);

                // 3. Publish event lên RabbitMQ (chat.events)
                await publishChatMessage({
                    messageId: (savedMessage as any)._id?.toString() || "",
                    roomId: data.roomId,
                    senderId: data.senderId,
                    senderName: data.senderName,
                    senderType: data.senderType,
                    message: data.message,
                    targetAgentId: data.targetAgentId,
                    createdAt: (savedMessage as any).createdAt,
                });

                // 4. Phân tích đối tượng nhận tin (cụ thể qua targetAgentId hoặc @mentions trong text)
                const targetAgents: string[] = [];
                if (data.targetAgentId) {
                    targetAgents.push(data.targetAgentId);
                }

                const mentioned = agentDispatcher.extractMentionedAgents(data.message);
                for (const ag of mentioned) {
                    if (!targetAgents.includes(ag)) {
                        targetAgents.push(ag);
                    }
                }

                // 5. Nếu có Agent được nhắm tới và người gửi là user (hoặc ra lệnh chéo), dispatch
                if (targetAgents.length > 0) {
                    for (const agentId of targetAgents) {
                        agentDispatcher.dispatchToAgent({
                            agentId,
                            roomId: data.roomId,
                            prompt: data.message,
                            senderName: data.senderName,
                            senderId: data.senderId,
                            depth: 0,
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

        // Hỗ trợ ra lệnh hành động 3D cho Agent trực tiếp từ bất kỳ user nào trong phòng
        socket.on("agent_action", (data: {
            roomId: string;
            agentId: string;
            action: "walk" | "sit" | "work" | "idle" | "speak";
            position?: [number, number, number];
            speech?: string;
        }) => {
            // Phát tán hành động 3D cho toàn bộ client trong phòng để đồng bộ không gian ảo
            broadcastToRoom(io, data.roomId, "agent_3d_state", data);
        });

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