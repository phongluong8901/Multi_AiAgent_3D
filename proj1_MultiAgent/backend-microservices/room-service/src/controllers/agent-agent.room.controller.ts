import { Request, Response } from "express";
import { agentAgentRoomService } from "../services/agent-agent.room.service";
import { asyncHandler } from "../middlewares/async.middleware";

export class AgentAgentRoomController {
    syncAgents = asyncHandler(async (req: Request, res: Response) => {
        const { activeAgents } = req.body;
        if (!Array.isArray(activeAgents)) {
            return res.status(400).json({ success: false, message: "activeAgents must be an array" });
        }
        const room = await agentAgentRoomService.syncActiveAgents(req.params.id as string, activeAgents as string[]);
        return res.status(200).json({ success: true, data: room });
    });

    addAgent = asyncHandler(async (req: Request, res: Response) => {
        const room = await agentAgentRoomService.addAgentToRoom(req.params.id as string, req.params.agentId as string);
        return res.status(200).json({ success: true, data: room });
    });

    removeAgent = asyncHandler(async (req: Request, res: Response) => {
        const room = await agentAgentRoomService.removeAgentFromRoom(req.params.id as string, req.params.agentId as string);
        return res.status(200).json({ success: true, data: room });
    });
}

export const agentAgentRoomController = new AgentAgentRoomController();