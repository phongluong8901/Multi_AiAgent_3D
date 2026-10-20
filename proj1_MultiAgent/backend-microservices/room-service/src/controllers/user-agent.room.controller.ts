import { Request, Response } from "express";
import { userAgentRoomService } from "../services/user-agent.room.service";
import { asyncHandler } from "../middlewares/async.middleware";

export class UserAgentRoomController {
    assignUserAgent = asyncHandler(async (req: Request, res: Response) => {
        const { userId, userName, userColor, agentId, agentName } = req.body;
        if (!userId || !agentId) {
            return res.status(400).json({ success: false, message: "userId and agentId are required" });
        }
        const room = await userAgentRoomService.assignUserAgent(req.params.id as string, {
            userId,
            userName: userName || "User",
            userColor: userColor || "#3b82f6",
            agentId,
            agentName: agentName || agentId,
        });
        return res.status(200).json({ success: true, data: room });
    });

    removeUserAgent = asyncHandler(async (req: Request, res: Response) => {
        const room = await userAgentRoomService.removeUserAgent(req.params.id as string, req.params.agentId as string);
        return res.status(200).json({ success: true, data: room });
    });
}

export const userAgentRoomController = new UserAgentRoomController();