import { Request, Response } from "express";
import { roomService } from "../services/room.service";

export class RoomController {
    async createRoom(req: Request, res: Response) {
        try {
            const room = await roomService.createRoom(req.body);
            return res.status(201).json({ success: true, data: room });
        } catch (error: any) {
            return res.status(400).json({ success: false, message: error.message });
        }
    }

    async getRooms(req: Request, res: Response) {
        try {
            const rooms = await roomService.getAllRooms();
            return res.status(200).json({ success: true, data: rooms });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    async getRoomById(req: Request, res: Response) {
        try {
            const roomId = req.params.id as string;
            const room = await roomService.getRoomById(roomId);
            return res.status(200).json({ success: true, data: room });
        } catch (error: any) {
            return res.status(404).json({ success: false, message: error.message });
        }
    }

    async addMember(req: Request, res: Response) {
        try {
            const roomId = req.params.id as string;
            const room = await roomService.addMemberToRoom(roomId, req.body);
            return res.status(200).json({ success: true, data: room });
        } catch (error: any) {
            return res.status(400).json({ success: false, message: error.message });
        }
    }

    async removeMember(req: Request, res: Response) {
        try {
            const roomId = req.params.id as string;
            const memberId = req.params.memberId as string;
            const room = await roomService.removeMemberFromRoom(roomId, memberId);
            return res.status(200).json({ success: true, data: room });
        } catch (error: any) {
            return res.status(400).json({ success: false, message: error.message });
        }
    }
}

export const roomController = new RoomController();