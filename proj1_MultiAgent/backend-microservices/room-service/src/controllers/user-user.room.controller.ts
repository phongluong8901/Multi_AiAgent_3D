import { Response } from "express";
import { userUserRoomService } from "../services/user-user.room.service";
import { roomRepository } from "../repositories/room.repository";
import { asyncHandler } from "../middlewares/async.middleware";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { publishRoomEvent } from "../events/producers";
import {
    enrichRoomWithPresence,
    upsertRoomPresence,
    roomPresences,
    globalOnlineUsers,
    getIO,
} from "../config/socket";

export class UserUserRoomController {
    // --- 1. TẠO PHÒNG MỚI (CREATE ROOM) ---
    createRoom = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const ownerId = req.user!.userId;
        const { name, description, maxCapacity, policy, settings, ownerName } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, message: "name is required" });
        }

        const room = await userUserRoomService.createRoom({
            name,
            description,
            ownerId,
            maxCapacity,
            policy,
            settings,
            initialMember: {
                memberId: ownerId,
                memberType: "user",
                role: "owner",
                name: ownerName || "Room Owner",
                joinedAt: new Date(),
            },
        });

        return res.status(201).json({ success: true, data: enrichRoomWithPresence(room) });
    });

    // --- 2. LẤY DANH SÁCH TẤT CẢ PHÒNG KÈM SỐ LƯỢNG ONLINE / OFFLINE (GET ROOMS) ---
    getRooms = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
        let rooms = await roomRepository.findAll();

        if (rooms.length === 0) {
            const defaultRoom = await userUserRoomService.createRoom({
                name: "Virtual Office Team HQ",
                description: "Không gian làm việc chung kết nối toàn bộ Agent và Team",
                ownerId: "system_owner_default",
                maxCapacity: 30,
                policy: {
                    tier: "enterprise",
                    isPublic: true,
                    maxActiveAgents: 10,
                    ownedAgentsCount: 3,
                },
            });
            rooms = [defaultRoom];
        }

        const enrichedRooms = rooms.map((r) => enrichRoomWithPresence(r));
        return res.status(200).json({ success: true, data: enrichedRooms });
    });

    // --- 2B. LẤY TỔNG HỢP TRẠNG THÁI ONLINE / OFFLINE TẤT CẢ CÁC PHÒNG ---
    getPresenceSummary = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
        const rooms = await roomRepository.findAll();
        const enriched = rooms.map((r) => enrichRoomWithPresence(r));

        const uniqueAllMemberIds = new Set<string>();
        const uniqueOnlineIds = new Set<string>(Array.from(globalOnlineUsers.keys()));

        const roomSummaries = enriched.map((r: any) => {
            for (const m of r.members || []) {
                if (m.memberType !== "agent" && !String(m.memberId).startsWith("agent_")) {
                    uniqueAllMemberIds.add(String(m.memberId));
                    if (m.isOnline) {
                        uniqueOnlineIds.add(String(m.memberId));
                    }
                }
            }
            for (const u of r.onlineUsers || []) {
                if (u.userId && !String(u.userId).startsWith("agent_")) {
                    uniqueOnlineIds.add(String(u.userId));
                    uniqueAllMemberIds.add(String(u.userId));
                }
            }
            return {
                roomId: String(r._id || r.id),
                roomName: r.name,
                totalMembers: r.totalMembers ?? 0,
                onlineCount: r.onlineCount ?? 0,
                offlineCount: r.offlineCount ?? 0,
                onlineUsers: r.onlineUsers ?? [],
            };
        });

        const totalUsers = uniqueAllMemberIds.size;
        const totalOnline = uniqueOnlineIds.size;
        const totalOffline = Math.max(0, totalUsers - totalOnline);

        return res.status(200).json({
            success: true,
            data: {
                totalRooms: enriched.length,
                totalUsers,
                totalOnline,
                totalOffline,
                rooms: roomSummaries,
            },
        });
    });

    // --- 3. LẤY THÔNG TIN CHI TIẾT PHÒNG THEO ID (GET ROOM BY ID) ---
    getRoomById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const room = await roomRepository.findById(req.params.id as string);
        if (!room) {
            return res.status(404).json({ success: false, message: "Room not found" });
        }
        return res.status(200).json({ success: true, data: enrichRoomWithPresence(room) });
    });

    // --- 3B. LẤY HOẶC CẬP NHẬT ONLINE / OFFLINE CỦA MỘT PHÒNG CỤ THỂ ---
    getRoomPresence = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const room = await roomRepository.findById(req.params.id as string);
        if (!room) {
            return res.status(404).json({ success: false, message: "Room not found" });
        }
        const enriched = enrichRoomWithPresence(room);
        return res.status(200).json({
            success: true,
            data: {
                roomId: String(enriched._id || enriched.id),
                roomName: enriched.name,
                totalMembers: enriched.totalMembers,
                onlineCount: enriched.onlineCount,
                offlineCount: enriched.offlineCount,
                onlineUsers: enriched.onlineUsers,
                offlineMembers: enriched.offlineMembers,
                members: enriched.members,
            },
        });
    });

    updateRoomPresence = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const roomId = req.params.id as string;
        const { user, status } = req.body || {};
        const userId = user?.id || user?.userId || req.user?.userId;
        const userName = user?.name || user?.userName || "User";

        if (!userId) {
            return res.status(400).json({ success: false, message: "userId is required" });
        }

        if (status === "offline") {
            roomPresences.get(roomId)?.delete(userId);
        } else {
            upsertRoomPresence(roomId, {
                userId,
                userName,
                avatar: user?.avatar,
                color: user?.color || "#3b82f6",
            });
        }

        const room = await roomRepository.findById(roomId);
        const enriched = room
            ? enrichRoomWithPresence(room)
            : {
                  roomId,
                  onlineCount: roomPresences.get(roomId)?.size || 0,
                  offlineCount: 0,
                  onlineUsers: Array.from(roomPresences.get(roomId)?.values() || []),
              };

        try {
            const io = getIO();
            io.to(roomId).emit("room_presence", {
                roomId,
                onlineUsers: enriched.onlineUsers,
                onlineCount: enriched.onlineCount,
                offlineCount: enriched.offlineCount,
            });
            io.emit("room-presence-changed", {
                roomId,
                onlineCount: enriched.onlineCount,
                offlineCount: enriched.offlineCount,
                onlineUsers: enriched.onlineUsers,
            });
        } catch (_e) {}

        return res.status(200).json({ success: true, data: enriched });
    });

    // --- 4. THAM GIA PHÒNG (JOIN ROOM) ---
    joinRoom = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!.userId;
        const { name, avatar, color, password } = req.body;

        const room = await userUserRoomService.joinRoom(
            req.params.id as string,
            {
                memberId: userId,
                memberType: "user",
                role: "participant",
                name: name || "User",
                avatar: avatar || "",
                color: color || "#3b82f6",
            },
            password
        );

        // Đánh dấu thành viên vừa join là đang Online trong phòng
        upsertRoomPresence(req.params.id as string, {
            userId,
            userName: name || "User",
            avatar: avatar || "",
            color: color || "#3b82f6",
        });

        return res.status(200).json({ success: true, data: enrichRoomWithPresence(room) });
    });

    // --- 5. CẬP NHẬT THÔNG TIN PHÒNG (UPDATE ROOM) ---
    updateRoom = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const roomId = req.params.id as string;
        const updated = await roomRepository.updateRoom(roomId, req.body);
        if (!updated) {
            return res.status(404).json({ success: false, message: "Room not found" });
        }
        await publishRoomEvent("room.updated", {
            roomId,
            ...req.body,
            activeAgents: updated.activeAgents,
            workflow: updated.workflow,
        });
        if (req.body.workflow) {
            await publishRoomEvent("room.workflow.updated", {
                roomId,
                workflow: req.body.workflow,
                activeAgents: updated.activeAgents,
            });
        }
        return res.status(200).json({ success: true, data: enrichRoomWithPresence(updated) });
    });

    // --- CẬP NHẬT WORKFLOW ĐIỀU PHỐI AGENT TRONG PHÒNG ---
    updateWorkflow = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const roomId = req.params.id as string;
        const workflowData = req.body;
        const updated = await roomRepository.updateRoom(roomId, { workflow: workflowData });
        if (!updated) {
            return res.status(404).json({ success: false, message: "Room not found" });
        }
        await publishRoomEvent("room.workflow.updated", {
            roomId,
            workflow: workflowData,
            activeAgents: updated.activeAgents,
        });
        return res.status(200).json({ success: true, data: enrichRoomWithPresence(updated) });
    });

    // --- 6. THÊM THÀNH VIÊN VÀO PHÒNG (ADD MEMBER) ---
    addMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const { memberId, memberType } = req.body;
        if (!memberId || !memberType) {
            return res.status(400).json({
                success: false,
                message: "memberId and memberType are required",
            });
        }
        const room = await userUserRoomService.addMemberToRoom(req.params.id as string, req.body);
        return res.status(200).json({ success: true, data: enrichRoomWithPresence(room) });
    });

    // --- 7. XÓA THÀNH VIÊN KHỎI PHÒNG (REMOVE MEMBER) ---
    removeMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const roomId = req.params.id as string;
        const memberId = req.params.memberId as string;
        roomPresences.get(roomId)?.delete(memberId);
        const room = await userUserRoomService.removeMemberFromRoom(roomId, memberId);
        return res.status(200).json({ success: true, data: enrichRoomWithPresence(room) });
    });

    // --- 8. XÓA PHÒNG (DELETE ROOM) ---
    deleteRoom = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!.userId;
        const roomId = req.params.id as string;
        roomPresences.delete(roomId);
        await userUserRoomService.deleteRoom(roomId, userId);
        return res.status(200).json({ success: true, message: "Đã xóa phòng" });
    });

    // --- 9. HỆ THỐNG LỜI MỜI (INVITES MANAGEMENT) ---
    myInvites = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const rooms = await userUserRoomService.listMyInvites(req.user!.userId);
        return res.status(200).json({ success: true, data: rooms });
    });

    invite = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const { userId, userName } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, message: "userId is required" });
        }
        const room = await userUserRoomService.inviteUser(
            req.params.id as string,
            req.user!.userId,
            { userId, userName }
        );
        return res.status(200).json({ success: true, data: enrichRoomWithPresence(room) });
    });

    acceptInvite = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!.userId;
        const name = req.body?.name || req.body?.userName;
        const room = await userUserRoomService.acceptInvite(req.params.id as string, userId, name);
        return res.status(200).json({ success: true, data: enrichRoomWithPresence(room) });
    });

    declineInvite = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const room = await userUserRoomService.declineInvite(
            req.params.id as string,
            req.user!.userId
        );
        return res.status(200).json({ success: true, data: enrichRoomWithPresence(room) });
    });

    // --- 10. RỜI PHÒNG (LEAVE ROOM) ---
    leaveRoom = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!.userId;
        const roomId = req.params.id as string;
        roomPresences.get(roomId)?.delete(userId);
        const room = await userUserRoomService.leaveRoom(roomId, userId);
        return res.status(200).json({ success: true, data: enrichRoomWithPresence(room) });
    });
}

export const userUserRoomController = new UserUserRoomController();
