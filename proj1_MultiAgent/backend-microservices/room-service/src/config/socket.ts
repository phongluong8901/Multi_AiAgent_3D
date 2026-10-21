import { Server, Socket } from "socket.io";
import http from "http";
import jwt from "jsonwebtoken";

let io: Server;

export const initSocket = (server: http.Server) => {
    io = new Server(server, {
        path: '/api/v1/rooms/socket.io',
        cors: { origin: "*" }
    });

    // 🟢 In ra log xác nhận Socket.IO đã được khởi tạo thành công và đang chạy chung path
    console.log(`[Socket.IO] Initialized successfully with path: /api/v1/rooms/socket.io`);

    // Middleware xác thực token lúc handshake
    io.use((socket: Socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (token) {
                const secret = process.env.JWT_SECRET || "your-secret-key";
                const decoded: any = jwt.verify(token.replace("Bearer ", ""), secret);
                socket.data.user = decoded;
            }
            next();
        } catch (err) {
            next();
        }
    });

    io.on("connection", (socket: Socket) => {
        socket.on("identity", (userId: string) => {
            if (userId) {
                socket.join(userId);
                console.log(`[Socket.IO] User ${userId} connected & joined personal room`);
            }
        });

        socket.on("join", (room: string) => {
            if (room) {
                socket.join(room);
                console.log(`[Socket.IO] Socket ${socket.id} joined room: ${room}`);
            }
        });

        socket.on("leave", (room: string) => {
            if (room) {
                socket.leave(room);
                console.log(`[Socket.IO] Socket ${socket.id} left room: ${room}`);
            }
        });

        socket.on("disconnect", () => { });
    });

    return io;
};

export const getIO = (): Server => {
    if (!io) {
        throw new Error("Socket.io chưa được khởi tạo!");
    }
    return io;
};