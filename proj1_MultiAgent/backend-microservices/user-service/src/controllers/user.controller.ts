// src/controllers/user.controller.ts
import { Request, Response } from "express";
import { userService } from "../services/user.service";
import { UnauthorizedError, BadRequestError } from "../utils/exceptions";
import { asyncHandler } from "../middlewares/async.middleware"; // Dùng đúng hàm asyncHandler của bạn

export class UserController {

    /**
     * Lấy danh sách tất cả người dùng trong hệ thống.
     * Sử dụng asyncHandler để tự động bắt lỗi bất đồng bộ (async/await) và truyền về middleware xử lý lỗi chung.
     */
    getUsers = asyncHandler(async (req: Request, res: Response) => {
        const users = await userService.getAllUsers();
        return res.status(200).json({ success: true, data: users });
    });

    /**
     * Lấy thông tin chi tiết của một người dùng dựa vào ID truyền trên URL params.
     */
    getUserProfile = asyncHandler(async (req: Request, res: Response) => {
        const user = await userService.getUserById(req.params.id as string);
        return res.status(200).json({ success: true, data: user });
    });

    /**
     * Lấy thông tin cá nhân của người dùng hiện tại (dựa vào header "x-user-id" được gửi lên từ API Gateway hoặc Auth Middleware).
     */
    getMe = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized"); // Ném lỗi nếu thiếu ID xác thực

        const user = await userService.getUserById(userId);
        return res.status(200).json({ success: true, data: user });
    });

    /**
     * Cập nhật thông tin profile cá nhân của người dùng hiện tại dựa trên request body.
     */
    updateMe = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        const updated = await userService.updateProfile(userId, req.body);
        return res.status(200).json({ success: true, data: updated });
    });

    /**
     * Cập nhật ảnh đại diện (Avatar) của người dùng hiện tại.
     * Yêu cầu phải đính kèm file (thường thông qua Multer middleware).
     */
    updateAvatar = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        // Kiểm tra xem có file nào được gửi lên không
        if (!req.file) {
            throw new BadRequestError("Không có file ảnh nào được gửi lên.");
        }

        // Gọi service xử lý avatar dưới dạng buffer
        const result = await userService.updateAvatar(userId, req.file.buffer);
        return res.status(200).json({ success: true, data: result });
    });

    /**
     * Cập nhật trạng thái (status) của người dùng hiện tại.
     */
    updateStatus = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        const { status } = req.body;
        const updated = await userService.updateStatus(userId, status);
        return res.status(200).json({ success: true, data: updated });
    });

    /**
     * Lấy danh sách các agent mà người dùng hiện tại đang sở hữu.
     */
    getMyAgents = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        const result = await userService.getOwnedAgents(userId);
        return res.status(200).json({ success: true, data: result.ownedAgentIds });
    });

    /**
     * Thêm một agent mới vào danh sách sở hữu của người dùng hiện tại.
     */
    addMyAgent = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        const agentId = req.params.agentId as string;
        const updated = await userService.addOwnedAgent(userId, agentId);
        return res.status(200).json({ success: true, data: updated });
    });

    /**
     * Xóa một agent khỏi danh sách sở hữu của người dùng hiện tại.
     */
    removeMyAgent = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        const agentId = req.params.agentId as string;
        const updated = await userService.removeOwnedAgent(userId, agentId);
        return res.status(200).json({ success: true, data: updated });
    });

    /**
     * Cập nhật thông tin node phần cứng (Hardware Node) liên kết với người dùng.
     */
    updateHardwareNode = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        const result = await userService.updateHardwareNode(userId, req.body);
        return res.json({ success: true, ...result });
    });

    /**
     * Lấy thông tin node phần cứng của người dùng hiện tại.
     */
    getHardwareNode = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        const hardwareNode = await userService.getHardwareNode(userId);
        return res.json({ success: true, data: hardwareNode });
    });

    /**
     * Lấy danh sách tất cả các node phần cứng có trong hệ thống (thường dành cho Admin).
     */
    getHardwareNodes = asyncHandler(async (req: Request, res: Response) => {
        const nodes = await userService.getAllHardwareNodes();
        return res.json({ success: true, data: nodes });
    });

}

// Khởi tạo và xuất ra một instance duy nhất (Singleton pattern) của UserController
export const userController = new UserController();