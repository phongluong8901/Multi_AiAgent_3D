import { Server as SocketIOServer, Socket } from "socket.io";
import { chatService } from "../services/chat.service";

export const configureSocketChat = (io: SocketIOServer) => {
    io.on("connection", (socket: Socket) => {
        console.log(`[chat-service] Client connected: ${socket.id}`);

        // Client/Agent join vào một phòng cụ thể
        socket.on("join_room", (roomId: string) => {
            socket.join(roomId);
            console.log(`Socket ${socket.id} joined room: ${roomId}`);
        });

        // Lắng nghe sự kiện gửi tin nhắn real-time
        socket.on("send_message", async (data: {
            roomId: string;
            senderId: string;
            senderType: "user" | "agent" | "system";
            senderName: string;
            message: string;
            metadata?: any;
        }) => {
            try {
                // 1. Lưu tin nhắn vào MongoDB
                const savedMessage = await chatService.saveMessage(data);

                // 2. Phát tán tin nhắn tới toàn bộ client đang trong phòng đó
                io.to(data.roomId).emit("receive_message", savedMessage);
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