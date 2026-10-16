import { Server as SocketIOServer, Socket } from "socket.io";
import { chatService } from "../services/chat.service";
import { publishChatMessage, publishAgentPrompt } from "../events/producers";
import { memoryService } from "../services/memory.service";

export const configureSocketChat = (io: SocketIOServer) => {
    io.on("connection", (socket: Socket) => {
        console.log(`[chat-service] Client connected: ${socket.id}`);

        // Client/Agent join vào một phòng cụ thể
        socket.on("join_room", (roomId: string) => {
            socket.join(roomId);
            console.log(`Socket ${socket.id} joined room: ${roomId}`);
        });

        // Client leave phòng
        socket.on("leave_room", (roomId: string) => {
            socket.leave(roomId);
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
                io.to(data.roomId).emit("receive_message", savedMessage);

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

                // 4. Nếu có targetAgentId hoặc tin nhắn gửi cho agent, publish request trigger agent
                if (data.targetAgentId && data.senderType === "user") {
                    await publishAgentPrompt({
                        agentId: data.targetAgentId,
                        roomId: data.roomId,
                        userPrompt: data.message,
                        userName: data.senderName,
                        userId: data.senderId,
                    });
                }
            } catch (error) {
                console.error("[chat-service] Error handling send_message:", error);
                socket.emit("error_message", { message: "Failed to send message" });
            }
        });

        socket.on("disconnect", () => {
            console.log(`[chat-service] Client disconnected: ${socket.id}`);
        });
    });
};