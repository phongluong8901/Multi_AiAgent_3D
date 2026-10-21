import { Response, NextFunction } from "express";
import { roomRepository } from "../repositories/room.repository";
import { AuthenticatedRequest } from "./auth.middleware";

export interface RoomAuthRequest extends AuthenticatedRequest {
    room?: any;
}

export const requireRoomAdminOrOwner = async (
    req: RoomAuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const rawId = req.params.id || req.params.roomId;
        const roomId = Array.isArray(rawId) ? rawId[0] : rawId;

        if (!roomId) {
            return res.status(400).json({ success: false, message: "Thiếu ID phòng" });
        }

        const room = await roomRepository.findById(roomId);
        if (!room) {
            return res.status(404).json({ success: false, message: "Không tìm thấy phòng" });
        }

        const currentUserId =
            req.user?.userId || (req.headers["x-user-id"] as string);

        if (!currentUserId) {
            return res.status(401).json({
                success: false,
                message: "Chưa xác thực danh tính",
            });
        }

        const isOwner = room.ownerId === currentUserId;
        const currentMember = room.members?.find(
            (m: any) => m.memberId === currentUserId
        );
        const isAdmin = currentMember?.role === "admin";

        if (!isOwner && !isAdmin) {
            return res.status(403).json({
                success: false,
                message:
                    "Bạn không có quyền thực hiện hành động này! Chỉ Chủ phòng hoặc Quản trị viên mới được phép.",
            });
        }

        req.room = room;
        next();
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: `Lỗi phân quyền: ${error.message}`,
        });
    }
};