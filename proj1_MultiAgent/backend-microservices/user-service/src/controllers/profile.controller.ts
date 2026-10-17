import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { userService } from "../services/user.service";

export class ProfileController {
    /** GET /api/v1/users/me — Lấy profile của user đang đăng nhập */
    async getMyProfile(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.userId;
            const user = await userService.getUserById(userId);
            return res.status(200).json({ success: true, data: user });
        } catch (error: any) {
            return res.status(404).json({ success: false, message: error.message });
        }
    }

    /** PUT /api/v1/users/me — Cập nhật profile */
    async updateMyProfile(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.userId;
            const updated = await userService.updateProfile(userId, req.body);
            return res.status(200).json({ success: true, data: updated });
        } catch (error: any) {
            return res.status(400).json({ success: false, message: error.message });
        }
    }

    /** GET /api/v1/users/me/agents — Lấy danh sách agents của user */
    async getMyAgents(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.userId;
            const agents = await userService.getOwnedAgents(userId);
            return res.status(200).json({ success: true, data: agents });
        } catch (error: any) {
            return res.status(400).json({ success: false, message: error.message });
        }
    }

    /** POST /api/v1/users/me/agents/:agentId — Thêm agent vào danh sách của user */
    async addAgentToProfile(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.userId;
            // Ép kiểu `as string` để tránh lỗi TypeScript string | string[]
            const agentId = req.params.agentId as string;

            const updated = await userService.addOwnedAgent(userId, agentId);
            return res.status(200).json({ success: true, data: updated });
        } catch (error: any) {
            return res.status(400).json({ success: false, message: error.message });
        }
    }

    /** DELETE /api/v1/users/me/agents/:agentId — Xóa agent khỏi danh sách */
    async removeAgentFromProfile(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.userId;
            // Ép kiểu `as string` để tránh lỗi TypeScript string | string[]
            const agentId = req.params.agentId as string;

            const updated = await userService.removeOwnedAgent(userId, agentId);
            return res.status(200).json({ success: true, data: updated });
        } catch (error: any) {
            return res.status(400).json({ success: false, message: error.message });
        }
    }

    /** PUT /api/v1/users/me/status — Cập nhật status online/offline/busy */
    async updateStatus(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.userId;
            const { status } = req.body;
            const updated = await userService.updateStatus(userId, status);
            return res.status(200).json({ success: true, data: updated });
        } catch (error: any) {
            return res.status(400).json({ success: false, message: error.message });
        }
    }

    /** POST /api/v1/users/logout — Logout (client-side token invalidation) */
    async logout(req: AuthRequest, res: Response) {
        return res.status(200).json({
            success: true,
            message: "Logged out successfully. Please remove the token from client storage.",
        });
    }
}

export const profileController = new ProfileController();