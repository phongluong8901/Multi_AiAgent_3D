// src/controllers/user.controller.ts
import { Request, Response } from "express";
import { userService } from "../services/user.service";
import { UnauthorizedError, BadRequestError } from "../utils/exceptions";

export class UserController {

    /** Lấy danh sách toàn bộ người dùng trong hệ thống */
    async getUsers(req: Request, res: Response) {
        const users = await userService.getAllUsers();
        return res.status(200).json({ success: true, data: users });
    }

    /** Lấy thông tin chi tiết một người dùng theo ID */
    async getUserProfile(req: Request, res: Response) {
        const user = await userService.getUserById(req.params.id as string);
        return res.status(200).json({ success: true, data: user });
    }

    /** Lấy hồ sơ (profile) của chính người dùng đang đăng nhập */
    async getMe(req: Request, res: Response) {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        const user = await userService.getUserById(userId);
        return res.status(200).json({ success: true, data: user });
    }

    /** Cập nhật thông tin hồ sơ cá nhân của người dùng */
    async updateMe(req: Request, res: Response) {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        const updated = await userService.updateProfile(userId, req.body);
        return res.status(200).json({ success: true, data: updated });
    }

    /** Tải lên và cập nhật ảnh đại diện (avatar) qua Cloudinary Buffer */
    async updateAvatar(req: Request, res: Response) {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        if (!req.file) {
            throw new BadRequestError("Không có file ảnh nào được gửi lên.");
        }

        const result = await userService.updateAvatar(userId, req.file.buffer);
        return res.status(200).json({ success: true, data: result });
    }

    /** Cập nhật trạng thái hoạt động trực tuyến (online/offline/busy) */
    async updateStatus(req: Request, res: Response) {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        const { status } = req.body;
        const updated = await userService.updateStatus(userId, status);
        return res.status(200).json({ success: true, data: updated });
    }

    /** Lấy danh sách mã định danh các Agent mà người dùng sở hữu */
    async getMyAgents(req: Request, res: Response) {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        const result = await userService.getOwnedAgents(userId);
        return res.status(200).json({ success: true, data: result.ownedAgentIds });
    }

    /** Thêm (đăng ký sở hữu) một Agent mới vào hồ sơ người dùng */
    async addMyAgent(req: Request, res: Response) {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        const agentId = req.params.agentId as string;
        const updated = await userService.addOwnedAgent(userId, agentId);
        return res.status(200).json({ success: true, data: updated });
    }

    /** Xóa (hủy sở hữu) một Agent khỏi hồ sơ người dùng */
    async removeMyAgent(req: Request, res: Response) {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        const agentId = req.params.agentId as string;
        const updated = await userService.removeOwnedAgent(userId, agentId);
        return res.status(200).json({ success: true, data: updated });
    }

    /** Cập nhật thông số phần cứng nút tính toán AI (Hardware Node) của người dùng */
    async updateHardwareNode(req: Request, res: Response) {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        const result = await userService.updateHardwareNode(userId, req.body);
        return res.json({ success: true, ...result });
    }

    /** Lấy cấu hình phần cứng Hardware Node của người dùng hiện tại */
    async getHardwareNode(req: Request, res: Response) {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        const hardwareNode = await userService.getHardwareNode(userId);
        return res.json({ success: true, data: hardwareNode });
    }

    /** Lấy danh sách toàn bộ các Hardware Node có năng lực chạy AI trên hệ thống */
    async getHardwareNodes(req: Request, res: Response) {
        const nodes = await userService.getAllHardwareNodes();
        return res.json({ success: true, data: nodes });
    }

}

export const userController = new UserController();