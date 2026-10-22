import { Server, Socket } from "socket.io";
import http from "http";
import jwt from "jsonwebtoken";

// Biến toàn cục lưu trữ thể hiện (instance) của Socket.IO Server
let io: Server;

// Định nghĩa kiểu dữ liệu cho một người dùng đang online trong phòng
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

// Hàm khởi tạo Socket.IO Server nhận vào một HTTP Server có sẵn
export const initSocket = (server: http.Server) => {
    // Khởi tạo đối tượng Server của Socket.IO với đường dẫn (path)
    io = new Server(server, {
        path: '/api/v1/rooms/socket.io',
        cors: { origin: "*" }
    });

    console.log(`[Socket.IO] Initialized successfully with path: /api/v1/rooms/socket.io`);

    // Middleware xác thực token lúc handshake
    io.use((socket: Socket, next) => {
        try {
            // Lấy token xác thực được gửi từ client thông qua trường handshake.auth
            const token = socket.handshake.auth?.token;
            if (token) {
                const secret = process.env.JWT_SECRET || "your-secret-key";
                // Giải mã JWT token
                const decoded: any = jwt.verify(token.replace("Bearer ", ""), secret);
                socket.data.user = decoded;
            }
            next(); // Cho phép kết nối tiếp tục
        } catch (err) {
            next(); // Nếu lỗi token thì vẫn cho qua (hoặc bạn có thể chặn bằng next(err))
        }
    });

    // Lắng nghe sự kiện khi có một client kết nối thành công vào server
    io.on("connection", (socket: Socket) => {
        // Sự kiện định danh người dùng: client gửi lên userId để join vào một phòng cá nhân riêng biệt
        socket.on("identity", (userId: string) => {
            if (userId) {
                socket.join(userId);
                console.log(`[Socket.IO] User ${userId} connected & joined personal room`);
            }
        });

        // Client join vào một phòng cụ thể kèm thông tin người dùng
        socket.on("join", (payload: string | { roomId: string; user?: { id: string; name: string; avatar?: string; color?: string } }) => {
            // Lấy roomId từ payload
            const roomId = typeof payload === "string" ? payload : payload?.roomId;
            if (!roomId) return;

            // Đưa socket này vào phòng của Socket.IO
            socket.join(roomId);

            // Lấy thông tin user từ token (middleware) nếu có
            const decoded = socket.data.user || {};
            // Lấy thông tin user từ payload gửi lên
            const userInfo = typeof payload === "object" && payload?.user ? payload.user : {
                id: decoded.userId || decoded.id || `user_${socket.id.slice(0, 5)}`,
                name: decoded.name || decoded.email || `User ${socket.id.slice(0, 4)}`,
                avatar: decoded.avatar,
                color: "#3b82f6"
            };

            const userId = userInfo.id || decoded.userId || socket.id;
            const userName = userInfo.name || decoded.name || "User";

            // Lưu ánh xạ socket.id với thông tin phòng và user để phục vụ việc xử lý khi rời phòng/disconnect
            socketUserMap.set(socket.id, { roomId, userId, userName });

            // Kiểm tra xem phòng này đã có Map lưu danh sách người dùng chưa
            if (!roomPresences.has(roomId)) {
                roomPresences.set(roomId, new Map());
            }
            // Lấy Map lưu danh sách người dùng của phòng
            const roomMap = roomPresences.get(roomId)!;
            // Thêm hoặc cập nhật thông tin người dùng vào danh sách presence
            roomMap.set(userId, {
                userId,
                userName,
                avatar: userInfo.avatar,
                color: userInfo.color || "#3b82f6",
                joinedAt: new Date(),
                socketId: socket.id
            });

            // Chuyển đổi Map danh sách người dùng trong phòng thành dạng Mảng
            const onlineUsers = Array.from(roomMap.values());
            console.log(`[Socket.IO] User ${userName} (${userId}) joined room ${roomId}. Online count: ${onlineUsers.length}`);

            // Phát tán danh sách onlineUsers ngay lập tức tới tất cả mọi người trong phòng
            io.to(roomId).emit("room_presence", { roomId, onlineUsers });
        });

        // Sự kiện client chủ động yêu cầu lấy danh sách người dùng đang online hiện tại của một phòng
        socket.on("get_presence", (roomId: string) => {
            if (roomId && roomPresences.has(roomId)) {
                const onlineUsers = Array.from(roomPresences.get(roomId)!.values());
                socket.emit("room_presence", { roomId, onlineUsers });
            } else {
                socket.emit("room_presence", { roomId, onlineUsers: [] });
            }
        });

        // Sự kiện client chủ động rời khỏi phòng (leave room)
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

        // Sự kiện tự động kích hoạt khi kết nối socket bị ngắt
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

// Hàm tiện ích (helper) giúp các file Controller hoặc Service khác có thể lấy instance của Socket.IO để sử dụng (gửi message từ API,...)
export const getIO = (): Server => {
    if (!io) {
        throw new Error("Socket.io chưa được khởi tạo!");
    }
    return io;
};