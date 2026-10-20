import { Request, Response } from "express";
import { userUserRoomService } from "../services/user-user.room.service";
import { roomRepository } from "../repositories/room.repository";
import { asyncHandler } from "../middlewares/async.middleware";

export class UserUserRoomController {
    createRoom = asyncHandler(async (req: Request, res: Response) => {
        // Đảm bảo request body truyền lên có ownerId (hoặc lấy từ middleware xác thực token/headers nếu có)
        const { name, ownerId } = req.body;
        if (!name || !ownerId) {
            return res.status(400).json({ success: false, message: "name and ownerId are required" });
        }

        const room = await userUserRoomService.createRoom(req.body);
        return res.status(201).json({ success: true, data: room });
    });

    getRooms = asyncHandler(async (req: Request, res: Response) => {
        let rooms = await roomRepository.findAll();
        if (rooms.length === 0) {
            // Khởi tạo phòng mặc định kèm ownerId hệ thống
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
                }
            });
            rooms = [defaultRoom];
        }
        return res.status(200).json({ success: true, data: rooms });
    });

    getRoomById = asyncHandler(async (req: Request, res: Response) => {
        const room = await roomRepository.findById(req.params.id as string);
        if (!room) return res.status(404).json({ success: false, message: "Room not found" });
        return res.status(200).json({ success: true, data: room });
    });

    updateRoom = asyncHandler(async (req: Request, res: Response) => {
        const updated = await roomRepository.updateRoom(req.params.id as string, req.body);
        if (!updated) return res.status(404).json({ success: false, message: "Room not found" });
        return res.status(200).json({ success: true, data: updated });
    });

    addMember = asyncHandler(async (req: Request, res: Response) => {
        const { memberId, memberType } = req.body;
        if (!memberId || !memberType) {
            return res.status(400).json({ success: false, message: "memberId and memberType are required" });
        }
        const room = await userUserRoomService.addMemberToRoom(req.params.id as string, req.body);
        return res.status(200).json({ success: true, data: room });
    });

    removeMember = asyncHandler(async (req: Request, res: Response) => {
        const room = await userUserRoomService.removeMemberFromRoom(req.params.id as string, req.params.memberId as string);
        return res.status(200).json({ success: true, data: room });
    });
}

export const userUserRoomController = new UserUserRoomController();