// src/controllers/user.controller.ts
import { Request, Response } from "express";
import { userService } from "../services/user.service";
import { UnauthorizedError, BadRequestError } from "../utils/exceptions";
import { asyncHandler } from "../middlewares/async.middleware"; // Dùng đúng hàm asyncHandler của bạn

export class UserController {

    getUsers = asyncHandler(async (req: Request, res: Response) => {
        const users = await userService.getAllUsers();
        return res.status(200).json({ success: true, data: users });
    });

    getUserProfile = asyncHandler(async (req: Request, res: Response) => {
        const user = await userService.getUserById(req.params.id as string);
        return res.status(200).json({ success: true, data: user });
    });

    getMe = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        const user = await userService.getUserById(userId);
        return res.status(200).json({ success: true, data: user });
    });

    updateMe = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        const updated = await userService.updateProfile(userId, req.body);
        return res.status(200).json({ success: true, data: updated });
    });

    updateAvatar = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        if (!req.file) {
            throw new BadRequestError("Không có file ảnh nào được gửi lên.");
        }

        const result = await userService.updateAvatar(userId, req.file.buffer);
        return res.status(200).json({ success: true, data: result });
    });

    updateStatus = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        const { status } = req.body;
        const updated = await userService.updateStatus(userId, status);
        return res.status(200).json({ success: true, data: updated });
    });

    getMyAgents = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        const result = await userService.getOwnedAgents(userId);
        return res.status(200).json({ success: true, data: result.ownedAgentIds });
    });

    addMyAgent = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        const agentId = req.params.agentId as string;
        const updated = await userService.addOwnedAgent(userId, agentId);
        return res.status(200).json({ success: true, data: updated });
    });

    removeMyAgent = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        const agentId = req.params.agentId as string;
        const updated = await userService.removeOwnedAgent(userId, agentId);
        return res.status(200).json({ success: true, data: updated });
    });

    updateHardwareNode = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        const result = await userService.updateHardwareNode(userId, req.body);
        return res.json({ success: true, ...result });
    });

    getHardwareNode = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        const hardwareNode = await userService.getHardwareNode(userId);
        return res.json({ success: true, data: hardwareNode });
    });

    getHardwareNodes = asyncHandler(async (req: Request, res: Response) => {
        const nodes = await userService.getAllHardwareNodes();
        return res.json({ success: true, data: nodes });
    });

}

export const userController = new UserController();