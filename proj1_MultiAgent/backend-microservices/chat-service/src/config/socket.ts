import { Server as SocketIOServer } from "http";
import { Server as IOServer, Socket } from "socket.io";
import { configureSocketChat } from "../gateways/chat.gateway";

let io: IOServer | null = null;

/**
 * Khoi tao Socket.IO server cho Chat Service:
 * - Cau hinh CORS cho phep Client Next.js ket noi
 * - Su dung custom endpoint path `/api/v1/chats/socket.io` de tranh conflict voi room-service tren API Gateway
 * - Gan router xu ly su kien realtime qua `configureSocketChat(io)`
 * 
 * @param httpServer HTTP Server instance tu Express app
 * @returns Khoi Socket.IO server da khoi tao
 */
export const initSocket = (httpServer: SocketIOServer): IOServer => {
    io = new IOServer(httpServer, {
        cors: {
            origin: "*", // Cho phep moi nguon ket noi
            methods: ["GET", "POST"],
            credentials: true,
        },
        path: "/api/v1/chats/socket.io",
    });

    console.log("[chat-service] [INFO] Socket.IO server initialized successfully");

    // Dang ky cac su kien chat va presence thong qua socket gateway
    configureSocketChat(io);

    return io;
};

/**
 * Lay instance singleton cua Socket.IO de phat tan su kien (broadcast / emit) tu controller hoac dispatcher
 */
export const getIO = (): IOServer => {
    if (!io) {
        throw new Error("Socket.IO has not been initialized. Call initSocket first.");
    }
    return io;
};
