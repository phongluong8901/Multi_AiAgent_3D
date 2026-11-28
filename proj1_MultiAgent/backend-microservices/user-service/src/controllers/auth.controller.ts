import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { AppError } from "../utils/exceptions";
import { asyncHandler } from "../middlewares/async.middleware";

export class AuthController {

    /** 
     * Đăng ký tài khoản truyền thống 
     * Nhận thông tin từ body, gọi service tạo user và gửi mã OTP kích hoạt qua hàng đợi 
     */
    register = asyncHandler(async (req: Request, res: Response) => {
        const result = await authService.register(req.body);
        return res.status(201).json({ success: true, data: result });
    });

    /** 
     * Xác thực tài khoản bằng mã OTP 
     * Kiểm tra mã OTP khách hàng nhập so với dữ liệu trên Redis và kích hoạt tài khoản
     */
    verifyOtp = asyncHandler(async (req: Request, res: Response) => {
        const { email, otp } = req.body;
        const result = await authService.verifyOtp(email, otp);
        return res.status(200).json({ success: true, data: result });
    });

    /** 
     * Gửi lại mã OTP mới 
     * Tạo mã OTP mới và đẩy lại sự kiện qua RabbitMQ nếu tài khoản chưa kích hoạt 
     */
    resendOtp = asyncHandler(async (req: Request, res: Response) => {
        const { email } = req.body;
        const result = await authService.resendOtp(email);
        return res.status(200).json({ success: true, data: result });
    });

    /** 
     * Đăng nhập truyền thống 
     * Xác thực email/mật khẩu, ghi nhận thiết bị thông qua header x-device-id, 
     * sinh Access Token và lưu Refresh Token vào HttpOnly Cookie bảo mật 
     */
    login = asyncHandler(async (req: Request, res: Response) => {
        const deviceId = (req.headers["x-device-id"] as string) || "default_device";
        const result = await authService.login(req.body, deviceId);
        const { accessToken, refreshToken, user } = result;

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
        });

        return res.status(200).json({ success: true, data: { accessToken, user } });
    });

    /** 
     * Xác thực thông qua Google OAuth 2.0 
     * Kiểm tra idToken từ Google, tạo hoặc đồng bộ tài khoản, 
     * thiết lập phiên đăng nhập đa thiết bị qua deviceId và trả về Cookie 
     */
    googleAuth = asyncHandler(async (req: Request, res: Response) => {
        const { idToken } = req.body;
        if (!idToken) throw new AppError("idToken is required", 400);

        const deviceId = (req.headers["x-device-id"] as string) || "default_device";
        const result = await authService.googleLogin(idToken, deviceId);
        const { accessToken, refreshToken, user } = result;

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({ success: true, data: { accessToken, user } });
    });

    /** 
     * Xác thực thông qua GitHub OAuth 
     * Trao đổi authorization code lấy token GitHub, lấy thông tin user, 
     * cấp phát phiên đăng nhập và lưu Cookie bảo mật 
     */
    githubAuth = asyncHandler(async (req: Request, res: Response) => {
        const { code } = req.body;
        if (!code) throw new AppError("GitHub authorization code is required", 400);

        const deviceId = (req.headers["x-device-id"] as string) || "default_device";
        const result = await authService.githubLogin(code, deviceId);
        const { accessToken, refreshToken, user } = result;

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({ success: true, data: { accessToken, user } });
    });

    /** 
     * Xác thực thông qua Hugging Face OAuth 
     * Trao đổi authorization code lấy token Hugging Face, lấy thông tin user, 
     * cấp phát phiên đăng nhập và lưu Cookie bảo mật 
     */
    huggingfaceAuth = asyncHandler(async (req: Request, res: Response) => {
        const { code, redirectUri } = req.body;
        if (!code) throw new AppError("Hugging Face authorization code is required", 400);

        const deviceId = (req.headers["x-device-id"] as string) || "default_device";
        const result = await authService.huggingfaceLogin(code, deviceId, redirectUri);
        const { accessToken, refreshToken, user } = result;

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({ success: true, data: { accessToken, user } });
    });

    /** 
     * Yêu cầu quên mật khẩu 
     * Tạo mã OTP đặt lại mật khẩu và gửi thông báo qua email hệ thống 
     */
    forgotPassword = asyncHandler(async (req: Request, res: Response) => {
        const { email } = req.body;
        const result = await authService.forgotPassword(email);
        return res.status(200).json({ success: true, data: result });
    });

    /** 
     * Đặt lại mật khẩu mới 
     * Xác thực mã OTP quên mật khẩu và cập nhật mật khẩu mới vào cơ sở dữ liệu 
     */
    resetPassword = asyncHandler(async (req: Request, res: Response) => {
        const result = await authService.resetPassword(req.body);
        return res.status(200).json({ success: true, data: result });
    });

    /** 
     * Đổi mật khẩu khi đã đăng nhập (Protected Route) 
     * Đọc định danh userId từ header x-device-id / x-user-id để tiến hành đổi mật khẩu an toàn 
     */
    changePassword = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new AppError("Unauthorized", 401);

        const result = await authService.changePassword(userId, req.body);
        return res.status(200).json({ success: true, data: result });
    });

    /** 
     * Làm mới Access Token 
     * Lấy Refresh Token từ Cookie hoặc Body, đối chiếu với thiết bị hiện tại trên Redis 
     * và cấp phát Access Token mới ngắn hạn 
     */
    refreshToken = asyncHandler(async (req: Request, res: Response) => {
        const token = req.cookies?.refreshToken || req.body.refreshToken;
        const deviceId = (req.headers["x-device-id"] as string) || "default_device";
        const result = await authService.refreshTokenService(token, deviceId);
        return res.status(200).json({ success: true, data: result });
    });

    /** 
     * Đăng xuất hệ thống 
     * Thu hồi phiên đăng nhập tương ứng với thiết bị hoặc toàn bộ thiết bị (nếu logoutAll=true), 
     * đồng thời xóa sạch HttpOnly Cookie ở phía trình duyệt 
     */
    logout = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.headers["x-user-id"] as string;
        const deviceId = req.headers["x-device-id"] as string;
        const { logoutAll } = req.body;

        await authService.logoutService(userId, deviceId, Boolean(logoutAll));

        res.clearCookie("refreshToken", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax"
        });

        return res.status(200).json({ success: true, message: "Đăng xuất thành công." });
    });
}

export const authController = new AuthController();