import { Request, Response } from "express";
import { userService } from "../services/user.service";

export class UserController {
    async register(req: Request, res: Response) {
        try {
            const result = await userService.register(req.body);
            return res.status(201).json({ success: true, data: result });
        } catch (error: any) {
            return res.status(error.statusCode || 400).json({ success: false, message: error.message });
        }
    }

    /** Xác thực tài khoản bằng mã OTP */
    async verifyOtp(req: Request, res: Response) {
        try {
            const { email, otp } = req.body;
            const result = await userService.verifyOtp(email, otp);
            return res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            return res.status(error.statusCode || 400).json({ success: false, message: error.message });
        }
    }

    /** Gửi lại mã OTP mới */
    async resendOtp(req: Request, res: Response) {
        try {
            const { email } = req.body;
            const result = await userService.resendOtp(email);
            return res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            return res.status(error.statusCode || 400).json({ success: false, message: error.message });
        }
    }

    async login(req: Request, res: Response) {
        try {
            const result = await userService.login(req.body);
            return res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            return res.status(error.statusCode || 401).json({ success: false, message: error.message });
        }
    }

    async googleAuth(req: Request, res: Response) {
        try {
            const { idToken } = req.body;
            if (!idToken) {
                return res.status(400).json({ success: false, message: "idToken is required" });
            }

            const result = await userService.googleLogin(idToken);
            return res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            return res.status(error.statusCode || 401).json({ success: false, message: error.message });
        }
    }

    async getUsers(req: Request, res: Response) {
        try {
            const users = await userService.getAllUsers();
            return res.status(200).json({ success: true, data: users });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    async getUserProfile(req: Request, res: Response) {
        try {
            const user = await userService.getUserById(req.params.id as string);
            return res.status(200).json({ success: true, data: user });
        } catch (error: any) {
            return res.status(404).json({ success: false, message: error.message });
        }
    }

    /** GET /api/v1/users/me — Lấy profile của chính mình (Đọc từ Gateway Header) */
    async getMe(req: Request, res: Response) {
        try {
            const userId = req.headers["x-user-id"] as string;
            if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

            const user = await userService.getUserById(userId);
            return res.status(200).json({ success: true, data: user });
        } catch (error: any) {
            return res.status(404).json({ success: false, message: error.message });
        }
    }

    /** PUT /api/v1/users/me — Cập nhật profile */
    async updateMe(req: Request, res: Response) {
        try {
            const userId = req.headers["x-user-id"] as string;
            if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

            const updated = await userService.updateProfile(userId, req.body);
            return res.status(200).json({ success: true, data: updated });
        } catch (error: any) {
            return res.status(400).json({ success: false, message: error.message });
        }
    }

    /** GET /api/v1/users/me/agents — Danh sách agent sở hữu */
    async getMyAgents(req: Request, res: Response) {
        try {
            const userId = req.headers["x-user-id"] as string;
            if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

            const result = await userService.getOwnedAgents(userId);
            return res.status(200).json({ success: true, data: result.ownedAgentIds });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    /** POST /api/v1/users/me/agents/:agentId — Đăng ký sở hữu Agent */
    async addMyAgent(req: Request, res: Response) {
        try {
            const userId = req.headers["x-user-id"] as string;
            if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

            const updated = await userService.addOwnedAgent(userId, req.params.agentId as string);
            return res.status(200).json({ success: true, data: updated });
        } catch (error: any) {
            return res.status(400).json({ success: false, message: error.message });
        }
    }

    /** DELETE /api/v1/users/me/agents/:agentId — Hủy sở hữu Agent */
    async removeMyAgent(req: Request, res: Response) {
        try {
            const userId = req.headers["x-user-id"] as string;
            if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

            const updated = await userService.removeOwnedAgent(userId, req.params.agentId as string);
            return res.status(200).json({ success: true, data: updated });
        } catch (error: any) {
            return res.status(400).json({ success: false, message: error.message });
        }
    }
}

export const userController = new UserController();