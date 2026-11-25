import { Server as SocketIOServer } from "http";
import { Server as IOServer, Socket } from "socket.io";
import { configureSocketChat } from "../gateways/chat.gateway"; // Đường dẫn tới file gateway chat của bạn

let io: IOServer | null = null;

export const initSocket = (httpServer: SocketIOServer): IOServer => {
    io = new IOServer(httpServer, {
        cors: {
            origin: "*", // Cho phép mọi nguồn kết nối (hoặc cấu hình domain cụ thể của frontend)
            methods: ["GET", "POST"],
            credentials: true,
        },
        // Dùng custom path để phân biệt với room-service (/api/v1/rooms/socket.io)
        // và tránh conflict khi gateway proxy cùng một cổng 4000
        path: "/api/v1/chats/socket.io",
    });

    console.log("[chat-service] Socket.IO server initialized successfully");

    // Đăng ký các sự kiện chat và presence thông qua socket gateway
    configureSocketChat(io);

    return io;
};

/**
 * Lấy instance của Socket.IO để sử dụng ở các module khác nếu cần
 */
export const getIO = (): IOServer => {
    if (!io) {
        throw new Error("Socket.IO has not been initialized. Call initSocket first.");
    }
    return io;
};