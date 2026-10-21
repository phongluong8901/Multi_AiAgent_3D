import { Server, Socket } from "socket.io";
import http from "http";
import jwt from "jsonwebtoken";

let io: Server;

export interface RoomPresenceUser {
    userId: string;
    userName: string;
    avatar?: string;
    color?: string;
    joinedAt: Date;
    socketId: string;
}

// Quản lý trạng thái Online realtime của từng phòng
// Map: roomId -> Map<userId, RoomPresenceUser>
const roomPresences = new Map<string, Map<string, RoomPresenceUser>>();
// Map: socketId -> { roomId, userId, userName }
const socketUserMap = new Map<string, { roomId: string; userId: string; userName: string }>();

export const initSocket = (server: http.Server) => {
    io = new Server(server, {
        path: '/api/v1/rooms/socket.io',
        cors: { origin: "*" }
    });

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

        // Client join vào một phòng cụ thể kèm thông tin người dùng
        socket.on("join", (payload: string | { roomId: string; user?: { id: string; name: string; avatar?: string; color?: string } }) => {
            const roomId = typeof payload === "string" ? payload : payload?.roomId;
            if (!roomId) return;

            socket.join(roomId);

            const decoded = socket.data.user || {};
            const userInfo = typeof payload === "object" && payload?.user ? payload.user : {
                id: decoded.userId || decoded.id || `user_${socket.id.slice(0, 5)}`,
                name: decoded.name || decoded.email || `User ${socket.id.slice(0, 4)}`,
                avatar: decoded.avatar,
                color: "#3b82f6"
            };

            const userId = userInfo.id || decoded.userId || socket.id;
            const userName = userInfo.name || decoded.name || "User";

            socketUserMap.set(socket.id, { roomId, userId, userName });

            if (!roomPresences.has(roomId)) {
                roomPresences.set(roomId, new Map());
            }
            const roomMap = roomPresences.get(roomId)!;
            roomMap.set(userId, {
                userId,
                userName,
                avatar: userInfo.avatar,
                color: userInfo.color || "#3b82f6",
                joinedAt: new Date(),
                socketId: socket.id
            });

            const onlineUsers = Array.from(roomMap.values());
            console.log(`[Socket.IO] User ${userName} (${userId}) joined room ${roomId}. Online count: ${onlineUsers.length}`);

            // Phát tán danh sách onlineUsers ngay lập tức tới tất cả mọi người trong phòng
            io.to(roomId).emit("room_presence", { roomId, onlineUsers });
        });

        // Yêu cầu lấy presence hiện tại
        socket.on("get_presence", (roomId: string) => {
            if (roomId && roomPresences.has(roomId)) {
                const onlineUsers = Array.from(roomPresences.get(roomId)!.values());
                socket.emit("room_presence", { roomId, onlineUsers });
            } else {
                socket.emit("room_presence", { roomId, onlineUsers: [] });
            }
        });

        socket.on("leave", (room: string) => {
            if (room) {
                socket.leave(room);
                const meta = socketUserMap.get(socket.id);
                if (meta && roomPresences.has(room)) {
                    const roomMap = roomPresences.get(room)!;
                    roomMap.delete(meta.userId);
                    const onlineUsers = Array.from(roomMap.values());
                    io.to(room).emit("room_presence", { roomId: room, onlineUsers });
                }
            }
        });

        socket.on("disconnect", () => {
            const meta = socketUserMap.get(socket.id);
            if (meta) {
                const { roomId, userId, userName } = meta;
                socketUserMap.delete(socket.id);
                if (roomPresences.has(roomId)) {
                    const roomMap = roomPresences.get(roomId)!;
                    roomMap.delete(userId);
                    const onlineUsers = Array.from(roomMap.values());
                    console.log(`[Socket.IO] User ${userName} disconnected from room ${roomId}. Online count: ${onlineUsers.length}`);
                    io.to(roomId).emit("room_presence", { roomId, onlineUsers });
                }
            }
        });
    });

    return io;
};

export const getIO = (): Server => {
    if (!io) {
        throw new Error("Socket.io chưa được khởi tạo!");
    }
    return io;
};