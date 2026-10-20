// src/controllers/auth.controller.ts
import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { AppError } from "../utils/exceptions"; // Đảm bảo đường dẫn import đúng

export class AuthController {

    /** Xử lý yêu cầu đăng ký tài khoản mới (gửi OTP) */
    async register(req: Request, res: Response) {
        const result = await authService.register(req.body);
        return res.status(201).json({ success: true, data: result });
    }

    /** Xác thực tài khoản người dùng bằng mã OTP */
    async verifyOtp(req: Request, res: Response) {
        const { email, otp } = req.body;
        const result = await authService.verifyOtp(email, otp);
        return res.status(200).json({ success: true, data: result });
    }

    /** Gửi lại mã OTP mới cho người dùng chưa kích hoạt */
    async resendOtp(req: Request, res: Response) {
        const { email } = req.body;
        const result = await authService.resendOtp(email);
        return res.status(200).json({ success: true, data: result });
    }

    /** Xử lý yêu cầu đăng nhập truyền thống bằng email và mật khẩu */
    async login(req: Request, res: Response) {
        const result = await authService.login(req.body);
        const { accessToken, refreshToken, user } = result;

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({
            success: true,
            data: { accessToken, user }
        });
    }

    /** Xử lý đăng nhập / đăng ký thông qua Google OAuth 2.0 */
    async googleAuth(req: Request, res: Response) {
        const { idToken } = req.body;
        if (!idToken) {
            throw new AppError("idToken is required", 400);
        }

        const result = await authService.googleLogin(idToken);
        const { accessToken, refreshToken, user } = result;

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({
            success: true,
            data: { accessToken, user }
        });
    }

    /** Xử lý đăng nhập / đăng ký thông qua GitHub OAuth */
    async githubAuth(req: Request, res: Response) {
        const { code } = req.body;
        if (!code) {
            throw new AppError("GitHub authorization code is required", 400);
        }

        const result = await authService.githubLogin(code);
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
    }

    /** Yêu cầu quên mật khẩu (gửi mã OTP đặt lại mật khẩu) */
    async forgotPassword(req: Request, res: Response) {
        const { email } = req.body;
        const result = await authService.forgotPassword(email);
        return res.status(200).json({ success: true, data: result });
    }

    /** Đặt lại mật khẩu mới thông qua mã OTP quên mật khẩu */
    async resetPassword(req: Request, res: Response) {
        const result = await authService.resetPassword(req.body);
        return res.status(200).json({ success: true, data: result });
    }

    /** Đổi mật khẩu tài khoản khi người dùng đã đăng nhập (Protected) */
    async changePassword(req: Request, res: Response) {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) {
            throw new AppError("Unauthorized", 401);
        }

        const result = await authService.changePassword(userId, req.body);
        return res.status(200).json({ success: true, data: result });
    }

    /** Cấp lại Access Token mới dựa trên Refresh Token hợp lệ */
    async refreshToken(req: Request, res: Response) {
        const token = req.cookies?.refreshToken || req.body.refreshToken;
        const result = await authService.refreshTokenService(token);
        return res.status(200).json({ success: true, data: result });
    }

    /** Đăng xuất tài khoản (thu hồi refresh token và xóa cookie) */
    async logout(req: Request, res: Response) {
        const userId = req.headers["x-user-id"] as string;
        const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

        await authService.logoutService(userId, refreshToken);

        res.clearCookie("refreshToken", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax"
        });

        return res.status(200).json({ success: true, message: "Đăng xuất thành công." });
    }
}

export const authController = new AuthController();