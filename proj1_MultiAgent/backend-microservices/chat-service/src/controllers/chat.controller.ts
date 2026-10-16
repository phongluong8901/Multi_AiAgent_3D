import { Request, Response } from "express";
import { chatService } from "../services/chat.service";

export class ChatController {
    async getHistory(req: Request, res: Response) {
        try {
            const roomId = req.params.roomId as string;
            const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
            const history = await chatService.getRoomHistory(roomId, limit);
            return res.status(200).json({ success: true, data: history });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }
}

export const chatController = new ChatController();