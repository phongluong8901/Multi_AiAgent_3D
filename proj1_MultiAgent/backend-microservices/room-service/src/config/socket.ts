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
    lastSeen?: number;
    socketId?: string;
}

// Map: roomId -> Map<userId, RoomPresenceUser>
export const roomPresences = new Map<string, Map<string, RoomPresenceUser>>();

// Map: userId -> { userId, userName, avatar, color, lastSeen, socketIds: Set<string> }
export const globalOnlineUsers = new Map<
    string,
    { userId: string; userName: string; avatar?: string; color?: string; lastSeen: number; socketIds: Set<string> }
>();

// Map: socketId -> { roomId?: string; userId: string; userName: string }
const socketUserMap = new Map<string, { roomId?: string; userId: string; userName: string }>();

const PRESENCE_TTL_MS = 120_000; // 2 phút cho REST heartbeat

/** Kiểm tra 1 userId có đang online (qua Socket hoặc REST heartbeat gần đây) hay không */
export const isUserOnlineGlobal = (userId: string): boolean => {
    if (!userId) return false;
    const entry = globalOnlineUsers.get(userId);
    if (entry) {
        if (entry.socketIds.size > 0) return true;
        if (Date.now() - entry.lastSeen < PRESENCE_TTL_MS) return true;
    }
    for (const [, rMap] of roomPresences.entries()) {
        if (rMap.has(userId)) return true;
    }
    return false;
};

/** Cập nhật sự hiện diện từ REST API hoặc đồng bộ liên service */
export const upsertRoomPresence = (
    roomId: string,
    user: { userId: string; userName: string; avatar?: string; color?: string; socketId?: string }
) => {
    const now = Date.now();
    if (!roomPresences.has(roomId)) {
        roomPresences.set(roomId, new Map());
    }
    const roomMap = roomPresences.get(roomId)!;
    roomMap.set(user.userId, {
        userId: user.userId,
        userName: user.userName || "User",
        avatar: user.avatar || "",
        color: user.color || "#3b82f6",
        joinedAt: roomMap.get(user.userId)?.joinedAt || new Date(),
        lastSeen: now,
        socketId: user.socketId,
    });

    const gEntry = globalOnlineUsers.get(user.userId) || {
        userId: user.userId,
        userName: user.userName || "User",
        avatar: user.avatar,
        color: user.color || "#3b82f6",
        lastSeen: now,
        socketIds: new Set<string>(),
    };
    gEntry.lastSeen = now;
    gEntry.userName = user.userName || gEntry.userName;
    if (user.socketId) {
        gEntry.socketIds.add(user.socketId);
    }
    globalOnlineUsers.set(user.userId, gEntry);

    return Array.from(roomMap.values());
};

/** Tính toán chi tiết số lượng người Online & Offline cho 1 Room document/object */
export const enrichRoomWithPresence = (roomDoc: any) => {
    const room = roomDoc?.toObject ? roomDoc.toObject() : { ...roomDoc };
    const roomId = String(room._id || room.id || "");
    const roomMap = roomPresences.get(roomId) || new Map<string, RoomPresenceUser>();

    const rawMembers: any[] = Array.isArray(room.members) ? room.members : [];
    const onlineUsersMap = new Map<string, RoomPresenceUser>();

    // 1. Lấy toàn bộ người dùng đang active trực tiếp trong roomPresences của phòng này
    for (const [uid, pUser] of roomMap.entries()) {
        onlineUsersMap.set(uid, pUser);
    }

    // 2. Đối chiếu danh sách thành viên của phòng với trạng thái Online
    const enrichedMembers = rawMembers.map((m: any) => {
        const memberObj = m?.toObject ? m.toObject() : { ...m };
        const mId = String(memberObj.memberId || "");
        const isAgent = memberObj.memberType === "agent" || mId.startsWith("agent_");
        const isOnline = isAgent || onlineUsersMap.has(mId) || isUserOnlineGlobal(mId);

        if (!isAgent && isOnline && !onlineUsersMap.has(mId)) {
            const gUser = globalOnlineUsers.get(mId);
            onlineUsersMap.set(mId, {
                userId: mId,
                userName: memberObj.name || gUser?.userName || "User",
                avatar: memberObj.avatar || gUser?.avatar || "",
                color: memberObj.color || gUser?.color || "#3b82f6",
                joinedAt: memberObj.joinedAt || new Date(),
                lastSeen: gUser?.lastSeen || Date.now(),
            });
        }

        return {
            ...memberObj,
            isOnline,
            status: isOnline ? "online" : "offline",
        };
    });

    const userMembers = enrichedMembers.filter((m) => m.memberType !== "agent" && !String(m.memberId).startsWith("agent_"));
    const onlineMemberIds = new Set<string>();
    for (const m of userMembers) {
        if (m.isOnline) {
            onlineMemberIds.add(String(m.memberId));
        }
    }
    // Cộng thêm cả những khách (guest/viewer) đang mở phòng dù chưa lưu cứng vào mảng members
    for (const uid of onlineUsersMap.keys()) {
        if (!uid.startsWith("agent_")) {
            onlineMemberIds.add(uid);
        }
    }

    const totalMembers = Math.max(userMembers.length, onlineMemberIds.size);
    const onlineCount = onlineMemberIds.size;
    const offlineCount = Math.max(0, totalMembers - onlineCount);
    const onlineUsers = Array.from(onlineUsersMap.values());
    const offlineMembers = userMembers.filter((m) => !m.isOnline);

    return {
        ...room,
        members: enrichedMembers,
        totalMembers,
        onlineCount,
        offlineCount,
        onlineUsers,
        offlineMembers,
    };
};

export const initSocket = (server: http.Server) => {
    io = new Server(server, {
        path: "/api/v1/rooms/socket.io",
        cors: { origin: "*" },
    });

    console.log(`[Socket.IO] Initialized successfully with path: /api/v1/rooms/socket.io`);

    io.use((socket: Socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (token) {
                const secret = process.env.JWT_SECRET || "your-secret-key";
                const decoded: any = jwt.verify(token.replace("Bearer ", ""), secret);
                socket.data.user = decoded;
            }
            next();
        } catch (_err) {
            next();
        }
    });

    io.on("connection", (socket: Socket) => {
        // Sự kiện định danh người dùng toàn cục (khi mở Rooms Hub hoặc AppShell)
        socket.on("identity", (userId: string) => {
            if (!userId) return;
            socket.join(userId);
            const decoded = socket.data.user || {};
            const userName = decoded.name || decoded.email || "User";

            socketUserMap.set(socket.id, { userId, userName });
            const gEntry = globalOnlineUsers.get(userId) || {
                userId,
                userName,
                lastSeen: Date.now(),
                socketIds: new Set<string>(),
            };
            gEntry.lastSeen = Date.now();
            gEntry.socketIds.add(socket.id);
            globalOnlineUsers.set(userId, gEntry);

            io.emit("global_presence_updated", {
                onlineUserIds: Array.from(globalOnlineUsers.keys()),
                totalOnlineUsers: globalOnlineUsers.size,
            });
        });

        // Client join vào một phòng cụ thể
        socket.on(
            "join",
            (
                payload:
                    | string
                    | { roomId: string; user?: { id: string; name: string; avatar?: string; color?: string } }
            ) => {
                const roomId = typeof payload === "string" ? payload : payload?.roomId;
                if (!roomId) return;

                socket.join(roomId);

                const decoded = socket.data.user || {};
                const userInfo =
                    typeof payload === "object" && payload?.user
                        ? payload.user
                        : {
                              id: decoded.userId || decoded.id || `user_${socket.id.slice(0, 5)}`,
                              name: decoded.name || decoded.email || `User ${socket.id.slice(0, 4)}`,
                              avatar: decoded.avatar,
                              color: "#3b82f6",
                          };

                const userId = userInfo.id || decoded.userId || socket.id;
                const userName = userInfo.name || decoded.name || "User";

                socketUserMap.set(socket.id, { roomId, userId, userName });

                const onlineUsers = upsertRoomPresence(roomId, {
                    userId,
                    userName,
                    avatar: userInfo.avatar,
                    color: userInfo.color || "#3b82f6",
                    socketId: socket.id,
                });

                io.to(roomId).emit("room_presence", {
                    roomId,
                    onlineUsers,
                    onlineCount: onlineUsers.length,
                });
                io.emit("room-presence-changed", {
                    roomId,
                    onlineCount: onlineUsers.length,
                    onlineUsers,
                });
            }
        );

        socket.on("get_presence", (roomId: string) => {
            if (roomId && roomPresences.has(roomId)) {
                const onlineUsers = Array.from(roomPresences.get(roomId)!.values());
                socket.emit("room_presence", {
                    roomId,
                    onlineUsers,
                    onlineCount: onlineUsers.length,
                });
            } else {
                socket.emit("room_presence", { roomId, onlineUsers: [], onlineCount: 0 });
            }
        });

        socket.on("leave", (room: string) => {
            if (!room) return;
            socket.leave(room);
            const meta = socketUserMap.get(socket.id);
            if (meta && roomPresences.has(room)) {
                const roomMap = roomPresences.get(room)!;
                roomMap.delete(meta.userId);
                const onlineUsers = Array.from(roomMap.values());
                io.to(room).emit("room_presence", {
                    roomId: room,
                    onlineUsers,
                    onlineCount: onlineUsers.length,
                });
                io.emit("room-presence-changed", {
                    roomId: room,
                    onlineCount: onlineUsers.length,
                    onlineUsers,
                });
            }
        });

        socket.on("disconnect", () => {
            const meta = socketUserMap.get(socket.id);
            socketUserMap.delete(socket.id);

            if (meta) {
                const { roomId, userId } = meta;
                if (roomId && roomPresences.has(roomId)) {
                    const roomMap = roomPresences.get(roomId)!;
                    roomMap.delete(userId);
                    const onlineUsers = Array.from(roomMap.values());
                    io.to(roomId).emit("room_presence", {
                        roomId,
                        onlineUsers,
                        onlineCount: onlineUsers.length,
                    });
                    io.emit("room-presence-changed", {
                        roomId,
                        onlineCount: onlineUsers.length,
                        onlineUsers,
                    });
                }

                const gEntry = globalOnlineUsers.get(userId);
                if (gEntry) {
                    gEntry.socketIds.delete(socket.id);
                    if (gEntry.socketIds.size === 0) {
                        globalOnlineUsers.delete(userId);
                    }
                }
                io.emit("global_presence_updated", {
                    onlineUserIds: Array.from(globalOnlineUsers.keys()),
                    totalOnlineUsers: globalOnlineUsers.size,
                });
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
