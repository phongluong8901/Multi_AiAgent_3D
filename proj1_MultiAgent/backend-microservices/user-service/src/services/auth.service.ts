import { userRepository } from "../repositories/user.repository";
import { hashPassword, comparePassword } from "../utils/hash.util";
import { generateRefreshToken, generateToken, verifyToken } from "../utils/jwt.util";
import { AppError } from "../utils/exceptions";
import { RegisterInput, LoginInput } from "../types/user.types";
import { OAuth2Client } from "google-auth-library";
import { UserValidator } from "../middlewares/user.validation";
import { generateOtpCode } from "../utils/otp";
import { IUser } from "../models/user.model";
import { sendToQueue } from "../config/rabbitmq";
import { redisClient } from "../config/redis";

// Khởi tạo client xác thực Google OAuth2 sử dụng Client ID từ biến môi trường
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export class AuthService {

    /** 
     * Ghi nhận nhật ký thao tác hệ thống (Audit Log) 
     * Đẩy thông tin hành động của người dùng qua hàng đợi RabbitMQ để service xử lý ngầm 
     */
    private async logAuditEvent(userId: string, action: string, details: any) {
        await sendToQueue({
            type: "AUDIT_LOG",
            userId,
            action,
            details,
            timestamp: new Date()
        });
    }

    /** 
     * Đăng ký tài khoản truyền thống 
     * Kiểm tra dữ liệu đầu vào, lưu mã OTP tạm thời vào Redis với TTL 5 phút, 
     * tạo bản ghi user ở trạng thái chưa kích hoạt và đẩy email OTP qua RabbitMQ 
     */
    async register(data: RegisterInput) {
        UserValidator.validateRegister(data);

        const existing = await userRepository.findByEmail(data.email);
        if (existing) {
            if (!existing.isVerified) {
                const otpCode = generateOtpCode();
                await redisClient.set(`otp:register:${data.email.toLowerCase().trim()}`, otpCode, { EX: 300 });

                await sendToQueue({
                    email: data.email,
                    subject: "Mã OTP xác thực tài khoản Claw Office",
                    htmlContent: `<p>Mã OTP xác thực mới của bạn là: <b>${otpCode}</b> (Hiệu lực 5 phút)</p>`
                });

                return { message: "Tài khoản chưa kích hoạt. Đã gửi lại mã OTP mới.", email: data.email };
            }
            throw new AppError("Email đã được sử dụng bởi tài khoản khác.", 400);
        }

        const passwordHash = await hashPassword(data.password);
        const otpCode = generateOtpCode();
        await redisClient.set(`otp:register:${data.email.toLowerCase().trim()}`, otpCode, { EX: 300 });

        const newUser = await userRepository.create({
            username: data.username.trim(),
            email: data.email.toLowerCase().trim(),
            passwordHash,
            role: data.role || "user",
            isVerified: false,
        });

        await sendToQueue({
            email: data.email,
            subject: "Mã OTP xác thực tài khoản Claw Office",
            htmlContent: `<p>Mã OTP xác thực của bạn là: <b>${otpCode}</b></p>`
        });

        await this.logAuditEvent(newUser._id.toString(), "USER_REGISTERED", { email: data.email });

        const userObj = newUser.toObject();
        delete (userObj as any).passwordHash;

        return { message: "Đăng ký thành công! Vui lòng kiểm tra email lấy mã OTP.", user: userObj };
    }

    /** 
     * Xác thực tài khoản bằng mã OTP 
     * Đối chiếu mã OTP lưu trên Redis, xóa key khi khớp và cập nhật trạng thái đã xác thực cho user 
     */
    async verifyOtp(email: string, otp: string) {
        if (!email || !otp) throw new AppError("Vui lòng cung cấp email và mã OTP.", 400);
        const cleanEmail = email.toLowerCase().trim();
        const user = await userRepository.findByEmail(cleanEmail);
        if (!user) throw new AppError("Không tìm thấy thông tin người dùng.", 404);
        if (user.isVerified) throw new AppError("Tài khoản đã được kích hoạt trước đó.", 400);

        const storedOtp = await redisClient.get(`otp:register:${cleanEmail}`);
        if (!storedOtp || storedOtp !== otp) throw new AppError("Mã OTP không chính xác hoặc đã hết hạn.", 400);

        await redisClient.del(`otp:register:${cleanEmail}`);
        await userRepository.update(user._id.toString(), { isVerified: true });

        return { message: "Xác thực tài khoản thành công!" };
    }

    /** 
     * Gửi lại mã OTP mới 
     * Tạo mã OTP mới ghi đè lên Redis và gửi email thông báo qua RabbitMQ 
     */
    async resendOtp(email: string) {
        if (!email) throw new AppError("Vui lòng cung cấp email.", 400);
        const cleanEmail = email.toLowerCase().trim();
        const user = await userRepository.findByEmail(cleanEmail);
        if (!user) throw new AppError("Không tìm thấy người dùng.", 404);
        if (user.isVerified) throw new AppError("Tài khoản đã được kích hoạt.", 400);

        const otpCode = generateOtpCode();
        await redisClient.set(`otp:register:${cleanEmail}`, otpCode, { EX: 300 });

        await sendToQueue({
            email: user.email,
            subject: "Mã OTP mới cho Claw Office",
            htmlContent: `<p>Mã OTP mới của bạn là: <b>${otpCode}</b></p>`
        });

        return { message: "Đã gửi lại mã OTP mới qua email." };
    }

    /** 
     * Đăng nhập truyền thống hỗ trợ Đa thiết bị (Multi-device Refresh Token) 
     * Xác thực mật khẩu, tạo Access Token ngắn hạn và lưu Refresh Token phân biệt theo deviceId vào Redis 
     */
    async login(data: LoginInput, deviceId: string = "default_device") {
        UserValidator.validateLogin(data);

        const user = await userRepository.findByEmail(data.email);
        if (!user || !user.passwordHash) throw new AppError("Email hoặc mật khẩu không chính xác.", 401);
        if (!user.isVerified) throw new AppError("Tài khoản chưa xác thực OTP.", 403);

        const isMatch = await comparePassword(data.password, user.passwordHash);
        if (!isMatch) throw new AppError("Email hoặc mật khẩu không chính xác.", 401);

        await userRepository.update(user._id.toString(), { status: "online" });

        const accessToken = generateToken({ userId: user._id.toString(), email: user.email, role: user.role });
        const refreshToken = generateRefreshToken({ userId: user._id.toString(), deviceId }, "7d");

        await redisClient.set(`refresh_token:${user._id.toString()}:${deviceId}`, refreshToken, { EX: 7 * 24 * 60 * 60 });
        await this.logAuditEvent(user._id.toString(), "USER_LOGIN", { deviceId });

        return {
            accessToken,
            refreshToken,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                status: "online",
                avatarUrl: user.avatarUrl,
                bio: user.bio,
                ownedAgentIds: user.ownedAgentIds,
            },
        };
    }

    /** 
     * Đăng nhập / Đăng ký bằng Google OAuth 2.0 
     * Xác thực Google ID Token, đồng bộ tài khoản vào DB và cấp phát phiên đăng nhập theo thiết bị 
     */
    async googleLogin(idToken: string, deviceId: string = "default_device") {
        UserValidator.validateGoogleToken(idToken);
        const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) throw new AppError("Token Google không hợp lệ.", 401);

        const googleId = payload.sub;
        const email = payload.email.toLowerCase().trim();
        const name = payload.name || email.split("@")[0];
        const avatarUrl = payload.picture || "";

        let user = await userRepository.findByGoogleId(googleId) || await userRepository.findByEmail(email);
        if (user) {
            user = await userRepository.update(user._id.toString(), { googleId, status: "online", isVerified: true, avatarUrl: user.avatarUrl || avatarUrl });
        } else {
            user = await userRepository.create({ username: name, email, googleId, avatarUrl, role: "user", status: "online", isVerified: true });
        }

        const accessToken = generateToken({ userId: user!._id.toString(), email: user!.email, role: user!.role });
        const refreshToken = generateRefreshToken({ userId: user!._id.toString(), deviceId }, "7d");
        await redisClient.set(`refresh_token:${user!._id.toString()}:${deviceId}`, refreshToken, { EX: 7 * 24 * 60 * 60 });

        return { accessToken, refreshToken, user: { id: user!._id, username: user!.username, email: user!.email, role: user!.role } };
    }

    /** 
     * Đăng nhập / Đăng ký bằng GitHub OAuth 
     * Trao đổi authorization code lấy access token của GitHub, truy vấn thông tin người dùng và cấp phiên 
     */
    async githubLogin(code: string, deviceId: string = "default_device") {
        if (!code) throw new AppError("Thiếu GitHub authorization code.", 400);
        const clientId = process.env.GITHUB_CLIENT_ID;
        const clientSecret = process.env.GITHUB_CLIENT_SECRET;
        const redirectUri = process.env.GITHUB_REDIRECT_URI || "http://localhost:3000/auth/github/callback";

        const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri })
        });
        const tokenData = await tokenRes.json();
        if (tokenData.error) throw new AppError(`Lỗi GitHub: ${tokenData.error_description}`, 401);

        const userRes = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${tokenData.access_token}`, "User-Agent": "App" } });
        const githubUser = await userRes.json();
        const githubId = String(githubUser.id);
        const githubUsername = githubUser.login || "";
        const email = (githubUser.email || `${githubId}@users.noreply.github.com`).toLowerCase().trim();

        let user = await userRepository.findByGithubId(githubId) || await userRepository.findByEmail(email);
        if (user) {
            user = await userRepository.update(user._id.toString(), { githubId, githubUsername, status: "online", isVerified: true });
        } else {
            user = await userRepository.create({ username: githubUser.name || githubUsername, email, githubId, githubUsername, role: "user", status: "online", isVerified: true });
        }

        const accessToken = generateToken({ userId: user!._id.toString(), email: user!.email, role: user!.role });
        const refreshToken = generateRefreshToken({ userId: user!._id.toString(), deviceId }, "7d");
        await redisClient.set(`refresh_token:${user!._id.toString()}:${deviceId}`, refreshToken, { EX: 7 * 24 * 60 * 60 });

        return { accessToken, refreshToken, user: { id: user!._id, username: user!.username, email: user!.email, role: user!.role } };
    }

    /** 
     * Đăng nhập / Đăng ký bằng Hugging Face OAuth 
     * Trao đổi authorization code lấy access token của Hugging Face, truy vấn thông tin người dùng và cấp phiên 
     */
    async huggingfaceLogin(code: string, deviceId: string = "default_device", redirectUriParam?: string) {
        if (!code) throw new AppError("Thiếu Hugging Face authorization code.", 400);
        const clientId = process.env.HUGGINGFACE_CLIENT_ID;
        const clientSecret = process.env.HUGGINGFACE_CLIENT_SECRET;
        const redirectUri = redirectUriParam || process.env.HUGGINGFACE_REDIRECT_URI || "http://localhost:3000/auth/huggingface/callback";

        if (!clientId || !clientSecret) {
            throw new AppError("Chưa cấu hình HUGGINGFACE_CLIENT_ID hoặc HUGGINGFACE_CLIENT_SECRET trên hệ thống.", 500);
        }

        const bodyParams = new URLSearchParams({
            grant_type: "authorization_code",
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
        });

        const tokenRes = await fetch("https://huggingface.co/oauth/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/json",
            },
            body: bodyParams.toString(),
        });
        const tokenData = await tokenRes.json();
        if (tokenData.error) {
            throw new AppError(`Lỗi Hugging Face: ${tokenData.error_description || tokenData.error}`, 401);
        }

        const userRes = await fetch("https://huggingface.co/oauth/userinfo", {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                Accept: "application/json",
            },
        });
        const hfUser = await userRes.json();
        const huggingfaceId = String(hfUser.sub || "");
        if (!huggingfaceId) {
            throw new AppError("Không lấy được thông tin người dùng từ Hugging Face.", 401);
        }

        const huggingfaceUsername = hfUser.preferred_username || hfUser.name || `hf_${huggingfaceId.slice(0, 6)}`;
        const email = (hfUser.email || `${huggingfaceId}@users.noreply.huggingface.co`).toLowerCase().trim();
        const avatarUrl = hfUser.picture || "";

        let user = (await userRepository.findByHuggingfaceId(huggingfaceId)) || (await userRepository.findByEmail(email));
        if (user) {
            user = await userRepository.update(user._id.toString(), {
                huggingfaceId,
                huggingfaceUsername,
                avatarUrl: user.avatarUrl || avatarUrl,
                status: "online",
                isVerified: true,
            });
        } else {
            user = await userRepository.create({
                username: hfUser.name || huggingfaceUsername,
                email,
                huggingfaceId,
                huggingfaceUsername,
                avatarUrl,
                role: "user",
                status: "online",
                isVerified: true,
            });
        }

        const accessToken = generateToken({ userId: user!._id.toString(), email: user!.email, role: user!.role });
        const refreshToken = generateRefreshToken({ userId: user!._id.toString(), deviceId }, "7d");
        await redisClient.set(`refresh_token:${user!._id.toString()}:${deviceId}`, refreshToken, { EX: 7 * 24 * 60 * 60 });

        return { accessToken, refreshToken, user: { id: user!._id, username: user!.username, email: user!.email, role: user!.role, avatarUrl: user!.avatarUrl } };
    }

    /** 
     * Yêu cầu quên mật khẩu 
     * Tạo mã OTP đặt lại mật khẩu, lưu vào Redis với TTL 10 phút và gửi thông báo qua email 
     */
    async forgotPassword(email: string) {
        if (!email) throw new AppError("Vui lòng cung cấp email.", 400);
        const cleanEmail = email.toLowerCase().trim();
        const user = await userRepository.findByEmail(cleanEmail);
        if (!user) throw new AppError("Không tìm thấy tài khoản.", 404);

        const resetPasswordOtp = generateOtpCode();
        await redisClient.set(`otp:forgot:${cleanEmail}`, resetPasswordOtp, { EX: 600 });

        await sendToQueue({
            email: user.email,
            subject: "Mã OTP đặt lại mật khẩu Claw Office",
            htmlContent: `<p>Mã OTP của bạn là: <b>${resetPasswordOtp}</b></p>`
        });

        return { message: "Đã gửi mã OTP đặt lại mật khẩu qua email." };
    }

    /** 
     * Đặt lại mật khẩu mới bằng OTP 
     * Kiểm tra mã OTP quên mật khẩu trên Redis, cập nhật mật khẩu mới và xóa mã OTP sau khi dùng 
     */
    async resetPassword(data: { email: string; otp: string; newPassword: string }) {
        const { email, otp, newPassword } = data;
        if (!email || !otp || !newPassword) throw new AppError("Thiếu thông tin yêu cầu.", 400);
        if (newPassword.length < 6) throw new AppError("Mật khẩu phải từ 6 ký tự.", 400);

        const cleanEmail = email.toLowerCase().trim();
        const user = await userRepository.findByEmail(cleanEmail);
        if (!user) throw new AppError("Không tìm thấy người dùng.", 404);

        const storedOtp = await redisClient.get(`otp:forgot:${cleanEmail}`);
        if (!storedOtp || storedOtp !== otp) throw new AppError("Mã OTP không hợp lệ hoặc hết hạn.", 400);

        await redisClient.del(`otp:forgot:${cleanEmail}`);
        const passwordHash = await hashPassword(newPassword);
        await userRepository.update(user._id.toString(), { passwordHash });

        return { message: "Đặt lại mật khẩu thành công!" };
    }

    /** 
     * Đổi mật khẩu khi đã đăng nhập 
     * Xác thực mật khẩu cũ và cập nhật mật khẩu mới cho người dùng đang hoạt động 
     */
    async changePassword(userId: string, data: { oldPassword: string; newPassword: string }) {
        const { oldPassword, newPassword } = data;
        if (!oldPassword || !newPassword) throw new AppError("Thiếu mật khẩu.", 400);
        const user = await userRepository.findById(userId);
        if (!user || !user.passwordHash) throw new AppError("Không tìm thấy người dùng.", 404);

        if (!await comparePassword(oldPassword, user.passwordHash)) throw new AppError("Mật khẩu cũ không đúng.", 400);
        const passwordHash = await hashPassword(newPassword);
        await userRepository.update(userId, { passwordHash });

        return { message: "Đổi mật khẩu thành công." };
    }

    /** 
     * Làm mới Access Token từ Refresh Token 
     * Xác thực tính hợp lệ của Refresh Token gắn với deviceId cụ thể trên Redis và cấp Access Token mới 
     */
    async refreshTokenService(incomingToken: string, deviceId: string = "default_device") {
        if (!incomingToken) throw new AppError("Thiếu Refresh Token.", 401);
        let userId: string;
        try {
            const decoded = verifyToken(incomingToken) as any;
            userId = decoded.userId;
        } catch {
            throw new AppError("Refresh Token không hợp lệ.", 403);
        }

        const storedToken = await redisClient.get(`refresh_token:${userId}:${deviceId}`);
        if (!storedToken || storedToken !== incomingToken) throw new AppError("Refresh Token đã bị thu hồi.", 403);

        const user = await userRepository.findById(userId);
        if (!user) throw new AppError("Không tìm thấy người dùng.", 404);

        const token = generateToken({ userId: user._id.toString(), email: user.email, role: user.role });
        return { token };
    }

    /** 
     * Đăng xuất hệ thống 
     * Thu hồi phiên Refresh Token của thiết bị hiện tại hoặc toàn bộ thiết bị, cập nhật trạng thái offline và ghi log 
     */
    async logoutService(userId: string, deviceId?: string, logoutAll: boolean = false) {
        if (logoutAll) {
            const keys = await redisClient.keys(`refresh_token:${userId}:*`);
            if (keys.length > 0) {
                for (const key of keys) {
                    await redisClient.del(key);
                }
            }
        } else if (deviceId) {
            await redisClient.del(`refresh_token:${userId}:${deviceId}`);
        }
        await userRepository.update(userId, { status: "offline" });
        await this.logAuditEvent(userId, "USER_LOGOUT", { logoutAll, deviceId });
        return { message: "Đăng xuất thành công." };
    }
}

export const authService = new AuthService();