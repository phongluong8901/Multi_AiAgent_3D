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
            const { accessToken, refreshToken, user } = result;

            // Lưu refreshToken vào HttpOnly Cookie bảo mật cao
            res.cookie("refreshToken", refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
            });

            // Chỉ trả accessToken và user qua JSON body
            return res.status(200).json({
                success: true,
                data: { accessToken, user }
            });
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
            const { accessToken, refreshToken, user } = result;

            // Lưu refreshToken vào HttpOnly Cookie
            res.cookie("refreshToken", refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
            });

            // Trả accessToken và user qua JSON body
            return res.status(200).json({
                success: true,
                data: { accessToken, user }
            });
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

    /** POST /api/v1/users/forgot-password */
    async forgotPassword(req: Request, res: Response) {
        try {
            const { email } = req.body;
            const result = await userService.forgotPassword(email);
            return res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            return res.status(error.statusCode || 400).json({ success: false, message: error.message });
        }
    }

    /** POST /api/v1/users/reset-password */
    async resetPassword(req: Request, res: Response) {
        try {
            const result = await userService.resetPassword(req.body);
            return res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            return res.status(error.statusCode || 400).json({ success: false, message: error.message });
        }
    }

    /** POST /api/v1/users/change-password (Protected) */
    async changePassword(req: Request, res: Response) {
        try {
            const userId = req.headers["x-user-id"] as string;
            if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

            const result = await userService.changePassword(userId, req.body);
            return res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            return res.status(error.statusCode || 400).json({ success: false, message: error.message });
        }
    }

    /** POST /api/v1/users/refresh-token */
    async refreshToken(req: Request, res: Response) {
        try {
            // Lấy refreshToken trực tiếp từ Cookie trình duyệt gửi lên
            const token = req.cookies?.refreshToken || req.body.refreshToken;

            const result = await userService.refreshTokenService(token);
            return res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            return res.status(error.statusCode || 403).json({ success: false, message: error.message });
        }
    }

    /** POST /api/v1/users/logout */
    async logout(req: Request, res: Response) {
        try {
            const userId = req.headers["x-user-id"] as string;
            const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

            // Truyền cả 2 tham số sang Service
            await userService.logoutService(userId, refreshToken);

            // Xóa Cookie ở phía trình duyệt
            res.clearCookie("refreshToken", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax"
            });

            return res.status(200).json({ success: true, message: "Đăng xuất thành công." });
        } catch (error: any) {
            return res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    }
    async githubAuth(req: Request, res: Response) {
        try {
            const { code } = req.body;
            if (!code) {
                return res.status(400).json({
                    success: false,
                    message: "GitHub authorization code is required",
                });
            }

            const result = await userService.githubLogin(code);
            const { accessToken, refreshToken, user } = result;

            res.cookie("refreshToken", refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });

            return res.status(200).json({
                success: true,
                data: { accessToken, user },
            });
        } catch (error: any) {
            return res
                .status(error.statusCode || 401)
                .json({ success: false, message: error.message });
        }
    }

    /** PUT /api/v1/users/me/avatar — Upload & cập nhật ảnh đại diện */
    async updateAvatar(req: Request, res: Response) {
        try {
            const userId = req.headers["x-user-id"] as string;
            if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

            if (!req.file) {
                return res.status(400).json({ success: false, message: "Không có file ảnh nào được gửi lên." });
            }

            const result = await userService.updateAvatar(userId, req.file.buffer);
            return res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            return res.status(error.statusCode || 400).json({ success: false, message: error.message });
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

    async updateHardwareNode(req: Request, res: Response) {
        try {
            const userId = req.headers["x-user-id"] as string;
            const result = await userService.updateHardwareNode(userId, req.body);
            return res.json({ success: true, ...result });
        } catch (error: any) {
            return res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || "Lỗi server khi lưu cấu hình Hardware Node",
            });
        }
    }

    async getHardwareNode(req: Request, res: Response) {
        try {
            const userId = req.headers["x-user-id"] as string;
            const hardwareNode = await userService.getHardwareNode(userId);
            return res.json({ success: true, data: hardwareNode });
        } catch (error: any) {
            return res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || "Lỗi server khi lấy cấu hình Hardware Node",
            });
        }
    }

    async getHardwareNodes(req: Request, res: Response) {
        try {
            const nodes = await userService.getAllHardwareNodes();
            return res.json({ success: true, data: nodes });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }
}

export const userController = new UserController();