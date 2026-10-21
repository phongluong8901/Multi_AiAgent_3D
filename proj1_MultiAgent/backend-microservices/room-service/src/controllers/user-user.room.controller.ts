import { Response } from "express";
import { userUserRoomService } from "../services/user-user.room.service";
import { roomRepository } from "../repositories/room.repository";
import { asyncHandler } from "../middlewares/async.middleware";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

export class UserUserRoomController {
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

        return res.status(201).json({ success: true, data: room });
    });

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
        return res.status(200).json({ success: true, data: rooms });
    });

    getRoomById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const room = await roomRepository.findById(req.params.id as string);
        if (!room) {
            return res.status(404).json({ success: false, message: "Room not found" });
        }
        return res.status(200).json({ success: true, data: room });
    });

    /** User vào phòng → ghi members (idempotent trong service) */
    joinRoom = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!.userId;
        const { name, avatar, color } = req.body;

        const room = await userUserRoomService.addMemberToRoom(req.params.id as string, {
            memberId: userId,
            memberType: "user",
            role: "participant",
            name: name || "User",
            avatar: avatar || "",
            color: color || "#3b82f6",
        });

        return res.status(200).json({ success: true, data: room });
    });

    updateRoom = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const updated = await roomRepository.updateRoom(
            req.params.id as string,
            req.body
        );
        if (!updated) {
            return res.status(404).json({ success: false, message: "Room not found" });
        }
        return res.status(200).json({ success: true, data: updated });
    });

    addMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const { memberId, memberType } = req.body;
        if (!memberId || !memberType) {
            return res.status(400).json({
                success: false,
                message: "memberId and memberType are required",
            });
        }
        const room = await userUserRoomService.addMemberToRoom(
            req.params.id as string,
            req.body
        );
        return res.status(200).json({ success: true, data: room });
    });

    removeMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const room = await userUserRoomService.removeMemberFromRoom(
            req.params.id as string,
            req.params.memberId as string
        );
        return res.status(200).json({ success: true, data: room });
    });

    deleteRoom = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!.userId;
        await userUserRoomService.deleteRoom(req.params.id as string, userId);
        return res.status(200).json({ success: true, message: "Đã xóa phòng" });
    });

    // ─── INVITES ───────────────────────────────────────────

    /** GET /invites/me */
    myInvites = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const rooms = await userUserRoomService.listMyInvites(req.user!.userId);
        return res.status(200).json({ success: true, data: rooms });
    });

    /** POST /:id/invites  body: { userId, userName } */
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
        return res.status(200).json({ success: true, data: room });
    });

    /** POST /:id/invites/accept */
    acceptInvite = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!.userId;
        const name = req.body?.name || req.body?.userName;
        const room = await userUserRoomService.acceptInvite(
            req.params.id as string,
            userId,
            name
        );
        return res.status(200).json({ success: true, data: room });
    });

    /** POST /:id/invites/decline */
    declineInvite = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const room = await userUserRoomService.declineInvite(
            req.params.id as string,
            req.user!.userId
        );
        return res.status(200).json({ success: true, data: room });
    });

    leaveRoom = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!.userId;
        const roomId = req.params.id as string;

        const room = await userUserRoomService.leaveRoom(roomId, userId);
        return res.status(200).json({ success: true, data: room });
    });
}

export const userUserRoomController = new UserUserRoomController();