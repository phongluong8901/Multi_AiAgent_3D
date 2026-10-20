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

// Khởi tạo client xác thực Google OAuth2 với Client ID từ biến môi trường
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Khởi tạo và export lớp AuthService chuyên xử lý các nghiệp vụ xác thực tài khoản
export class AuthService {

    /** Đăng ký tài khoản truyền thống (Lưu OTP vào Redis và Gửi email qua RabbitMQ) */
    async register(data: RegisterInput) {
        UserValidator.validateRegister(data); // Kiểm tra tính hợp lệ dữ liệu đăng ký

        const existing = await userRepository.findByEmail(data.email);
        if (existing) {
            // Nếu tài khoản đã tồn tại nhưng chưa kích hoạt, tiến hành cấp mới mã OTP trên Redis và gửi lại email
            if (!existing.isVerified) {
                const otpCode = generateOtpCode();

                // Lưu OTP vào Redis với thời hạn TTL là 300 giây (5 phút), tự động xóa khi hết hạn
                await redisClient.set(`otp:register:${data.email.toLowerCase().trim()}`, otpCode, { EX: 300 });

                // Đẩy sự kiện gửi email OTP qua hàng đợi RabbitMQ
                await sendToQueue({
                    email: data.email,
                    subject: "Mã OTP xác thực tài khoản Claw Office",
                    htmlContent: `<h3>Xin chào ${existing.username},</h3>
                     <p>Tài khoản của bạn chưa được kích hoạt. Mã OTP xác thực mới của bạn là:</p>
                     <h2 style="color: #2563eb; letter-spacing: 2px;">${otpCode}</h2>
                     <p>Mã này có hiệu lực trong vòng 5 phút.</p>`
                });

                return {
                    message: "Tài khoản chưa được kích hoạt. Chúng tôi đã gửi lại mã OTP mới qua email của bạn.",
                    email: data.email,
                };
            }
            throw new AppError("Email đã được sử dụng bởi tài khoản khác.", 400);
        }

        const passwordHash = await hashPassword(data.password); // Băm mật khẩu bảo mật bằng bcrypt
        const otpCode = generateOtpCode();

        // Lưu OTP vào Redis với TTL 300 giây (5 phút)
        await redisClient.set(`otp:register:${data.email.toLowerCase().trim()}`, otpCode, { EX: 300 });

        // Tạo mới tài khoản người dùng với trạng thái chưa xác thực (isVerified: false) trong MongoDB
        const newUser = await userRepository.create({
            username: data.username.trim(),
            email: data.email.toLowerCase().trim(),
            passwordHash,
            role: data.role || "user",
            isVerified: false,
        });

        // Đẩy sự kiện gửi email mã OTP đăng ký qua RabbitMQ worker
        await sendToQueue({
            email: data.email,
            subject: "Mã OTP xác thực tài khoản Claw Office",
            htmlContent: `<h3>Xin chào ${data.username},</h3>
             <p>Cảm ơn bạn đã đăng ký tài khoản tại Claw Office.</p>
             <p>Mã OTP xác thực tài khoản của bạn là:</p>
             <h2 style="color: #2563eb; letter-spacing: 2px;">${otpCode}</h2>
             <p>Mã này có hiệu lực trong vòng 5 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>`
        });

        const userObj = newUser.toObject();
        delete (userObj as any).passwordHash;

        return {
            message: "Đăng ký thành công! Vui lòng kiểm tra email để lấy mã OTP xác thực.",
            user: userObj,
        };
    }

    /** Xác thực tài khoản bằng mã OTP lưu trên Redis */
    async verifyOtp(email: string, otp: string) {
        if (!email || !otp) {
            throw new AppError("Vui lòng cung cấp email và mã OTP.", 400);
        }

        const cleanEmail = email.toLowerCase().trim();
        const user = await userRepository.findByEmail(cleanEmail);
        if (!user) {
            throw new AppError("Không tìm thấy thông tin người dùng.", 404);
        }

        if (user.isVerified) {
            throw new AppError("Tài khoản này đã được kích hoạt từ trước.", 400);
        }

        // Lấy mã OTP từ Redis
        const storedOtp = await redisClient.get(`otp:register:${cleanEmail}`);
        if (!storedOtp || storedOtp !== otp) {
            throw new AppError("Mã OTP không chính xác hoặc đã hết hạn.", 400);
        }

        // Xóa OTP khỏi Redis sau khi xác thực thành công
        await redisClient.del(`otp:register:${cleanEmail}`);

        // Cập nhật trạng thái kích hoạt tài khoản thành công trong MongoDB
        await userRepository.update(user._id.toString(), {
            isVerified: true,
        });

        return { message: "Xác thực tài khoản thành công! Bạn có thể đăng nhập ngay bây giờ." };
    }

    /** Gửi lại mã OTP mới qua RabbitMQ và cập nhật Redis */
    async resendOtp(email: string) {
        if (!email) {
            throw new AppError("Vui lòng cung cấp email.", 400);
        }

        const cleanEmail = email.toLowerCase().trim();
        const user = await userRepository.findByEmail(cleanEmail);
        if (!user) {
            throw new AppError("Không tìm thấy người dùng.", 404);
        }

        if (user.isVerified) {
            throw new AppError("Tài khoản đã được kích hoạt rồi.", 400);
        }

        const otpCode = generateOtpCode();

        // Cập nhật lại mã OTP mới trên Redis với TTL 300 giây
        await redisClient.set(`otp:register:${cleanEmail}`, otpCode, { EX: 300 });

        await sendToQueue({
            email: user.email,
            subject: "Mã OTP mới cho Claw Office",
            htmlContent: `<p>Mã OTP mới của bạn là:</p>
             <h2 style="color: #2563eb; letter-spacing: 2px;">${otpCode}</h2>
             <p>Mã có hiệu lực trong vòng 5 phút.</p>`
        });

        return { message: "Đã gửi lại mã OTP mới qua email." };
    }

    /** Đăng nhập truyền thống */
    async login(data: LoginInput) {
        UserValidator.validateLogin(data);

        const user = await userRepository.findByEmail(data.email);
        if (!user || !user.passwordHash) {
            throw new AppError("Email hoặc mật khẩu không chính xác.", 401);
        }

        if (!user.isVerified) {
            throw new AppError("Tài khoản chưa được xác thực OTP. Vui lòng kiểm tra email để kích hoạt.", 403);
        }

        const isMatch = await comparePassword(data.password, user.passwordHash);
        if (!isMatch) {
            throw new AppError("Email hoặc mật khẩu không chính xác.", 401);
        }

        await userRepository.update(user._id.toString(), { status: "online" });

        // Tạo Access Token xác thực ngắn hạn
        const accessToken = generateToken({
            userId: user._id.toString(),
            email: user.email,
            role: user.role,
        });

        // Tạo Refresh Token và lưu trữ trên Redis cache (hết hạn sau 7 ngày)
        const refreshToken = generateRefreshToken({ userId: user._id.toString() }, "7d");
        await redisClient.set(`refresh_token:${user._id.toString()}`, refreshToken, {
            EX: 7 * 24 * 60 * 60,
        });

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

    /** Đăng nhập / Đăng ký bằng Google OAuth 2.0 */
    async googleLogin(idToken: string) {
        UserValidator.validateGoogleToken(idToken);

        try {
            const ticket = await googleClient.verifyIdToken({
                idToken,
                audience: process.env.GOOGLE_CLIENT_ID,
            });

            const payload = ticket.getPayload();
            if (!payload || !payload.email) {
                throw new AppError("Token Google không hợp lệ hoặc không chứa thông tin email.", 401);
            }

            const googleId = payload.sub;
            const email = payload.email.toLowerCase().trim();
            const name = payload.name || email.split("@")[0];
            const avatarUrl = payload.picture || "";

            let user: IUser | null = await userRepository.findByGoogleId(googleId);

            if (!user) {
                user = await userRepository.findByEmail(email);

                if (user) {
                    user = await userRepository.update(user._id.toString(), {
                        googleId,
                        avatarUrl: user.avatarUrl || avatarUrl,
                        status: "online",
                        isVerified: true,
                    });
                } else {
                    user = await userRepository.create({
                        username: name,
                        email,
                        googleId,
                        avatarUrl,
                        role: "user",
                        status: "online",
                        isVerified: true,
                    });
                }
            } else {
                user = await userRepository.update(user._id.toString(), { status: "online" });
            }

            if (!user) {
                throw new AppError("Không thể khởi tạo hoặc tìm thấy tài khoản người dùng.", 500);
            }

            const accessToken = generateToken({
                userId: user._id.toString(),
                email: user.email,
                role: user.role,
            });

            const refreshToken = generateRefreshToken({ userId: user._id.toString() }, "7d");
            await redisClient.set(`refresh_token:${user._id.toString()}`, refreshToken, {
                EX: 7 * 24 * 60 * 60,
            });

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
        } catch (error: any) {
            if (error instanceof AppError) throw error;
            throw new AppError(`Xác thực Google thất bại: ${error.message}`, 401);
        }
    }

    /** Đăng nhập / đăng ký bằng GitHub OAuth */
    async githubLogin(code: string) {
        if (!code) {
            throw new AppError("Mã GitHub authorization code không được để trống.", 400);
        }

        const clientId = process.env.GITHUB_CLIENT_ID;
        const clientSecret = process.env.GITHUB_CLIENT_SECRET;
        const redirectUri = process.env.GITHUB_REDIRECT_URI || "http://localhost:3000/auth/github/callback";

        if (!clientId || !clientSecret) {
            throw new AppError("Thiếu GITHUB_CLIENT_ID hoặc GITHUB_CLIENT_SECRET trên server.", 500);
        }

        try {
            const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    client_id: clientId,
                    client_secret: clientSecret,
                    code,
                    redirect_uri: redirectUri,
                }),
            });

            const tokenData = await tokenResponse.json();
            if (tokenData.error || !tokenData.access_token) {
                throw new AppError(`Lỗi xác thực GitHub: ${tokenData.error_description || tokenData.error}`, 401);
            }

            const accessTokenGithub = tokenData.access_token as string;

            const userResponse = await fetch("https://api.github.com/user", {
                headers: {
                    Authorization: `Bearer ${accessTokenGithub}`,
                    Accept: "application/vnd.github+json",
                    "User-Agent": "Claw-Office-App",
                },
            });

            const githubUser = await userResponse.json();
            if (!userResponse.ok || !githubUser?.id) {
                throw new AppError("Không thể lấy thông tin tài khoản từ GitHub.", 401);
            }

            const githubId = String(githubUser.id);
            const githubUsername = githubUser.login || "";
            const username = githubUser.name || githubUsername || "GitHub User";
            const avatarUrl = githubUser.avatar_url || "";

            let email: string | null = githubUser.email || null;
            if (!email) {
                const emailResponse = await fetch("https://api.github.com/user/emails", {
                    headers: {
                        Authorization: `Bearer ${accessTokenGithub}`,
                        Accept: "application/vnd.github+json",
                        "User-Agent": "Claw-Office-App",
                    },
                });
                const emails: any[] = await emailResponse.json();
                if (Array.isArray(emails)) {
                    const primary = emails.find((e) => e.primary && e.verified);
                    email = primary?.email || emails[0]?.email || null;
                }
            }

            if (!email) {
                email = `${githubId}@users.noreply.github.com`;
            }
            email = email.toLowerCase().trim();

            let user: IUser | null = await userRepository.findByGithubId(githubId);

            if (!user) {
                user = await userRepository.findByEmail(email);

                if (user) {
                    user = await userRepository.update(user._id.toString(), {
                        githubId,
                        githubUsername,
                        avatarUrl: user.avatarUrl || avatarUrl,
                        status: "online",
                        isVerified: true,
                    });
                } else {
                    user = await userRepository.create({
                        username,
                        email,
                        githubId,
                        githubUsername,
                        avatarUrl,
                        role: "user",
                        status: "online",
                        isVerified: true,
                    });
                }
            } else {
                user = await userRepository.update(user._id.toString(), {
                    status: "online",
                    githubUsername,
                    avatarUrl: user.avatarUrl || avatarUrl,
                });
            }

            if (!user) {
                throw new AppError("Không thể khởi tạo hoặc tìm thấy tài khoản người dùng.", 500);
            }

            const accessToken = generateToken({
                userId: user._id.toString(),
                email: user.email,
                role: user.role,
            });

            const refreshToken = generateRefreshToken({ userId: user._id.toString() }, "7d");
            await redisClient.set(`refresh_token:${user._id.toString()}`, refreshToken, {
                EX: 7 * 24 * 60 * 60,
            });

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
        } catch (error: any) {
            if (error instanceof AppError) throw error;
            throw new AppError(`Xác thực GitHub thất bại: ${error?.message || "Unknown error"}`, 401);
        }
    }

    /** Yêu cầu quên mật khẩu (Lưu OTP đặt lại mật khẩu vào Redis) */
    async forgotPassword(email: string) {
        if (!email) throw new AppError("Vui lòng cung cấp email.", 400);

        const cleanEmail = email.toLowerCase().trim();
        const user = await userRepository.findByEmail(cleanEmail);
        if (!user) {
            throw new AppError("Không tìm thấy tài khoản với email này.", 404);
        }

        const resetPasswordOtp = generateOtpCode();

        // Lưu OTP quên mật khẩu vào Redis với thời hạn TTL là 600 giây (10 phút)
        await redisClient.set(`otp:forgot:${cleanEmail}`, resetPasswordOtp, { EX: 600 });

        await sendToQueue({
            email: user.email,
            subject: "Mã OTP đặt lại mật khẩu Claw Office",
            htmlContent: `<h3>Xin chào ${user.username},</h3>
             <p>Bạn đã yêu cầu đặt lại mật khẩu. Mã OTP của bạn là:</p>
             <h2 style="color: #2563eb; letter-spacing: 2px;">${resetPasswordOtp}</h2>
             <p>Mã này có hiệu lực trong vòng 10 phút.</p>`
        });

        return { message: "Mã OTP đặt lại mật khẩu đã được gửi qua email của bạn." };
    }

    /** Đặt lại mật khẩu mới bằng OTP lưu trên Redis */
    async resetPassword(data: { email: string; otp: string; newPassword: string }) {
        const { email, otp, newPassword } = data;
        if (!email || !otp || !newPassword) {
            throw new AppError("Vui lòng cung cấp đầy đủ email, mã OTP và mật khẩu mới.", 400);
        }

        if (newPassword.length < 6) {
            throw new AppError("Mật khẩu mới phải có ít nhất 6 ký tự.", 400);
        }

        const cleanEmail = email.toLowerCase().trim();
        const user = await userRepository.findByEmail(cleanEmail);
        if (!user) throw new AppError("Không tìm thấy người dùng.", 404);

        // Kiểm tra OTP từ Redis
        const storedOtp = await redisClient.get(`otp:forgot:${cleanEmail}`);
        if (!storedOtp || storedOtp !== otp) {
            throw new AppError("Mã OTP không chính xác hoặc đã hết hạn.", 400);
        }

        // Xóa OTP khỏi Redis sau khi sử dụng thành công
        await redisClient.del(`otp:forgot:${cleanEmail}`);

        const passwordHash = await hashPassword(newPassword);

        await userRepository.update(user._id.toString(), {
            passwordHash,
        });

        return { message: "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới." };
    }

    /** Đổi mật khẩu khi đã đăng nhập */
    async changePassword(userId: string, data: { oldPassword: string; newPassword: string }) {
        const { oldPassword, newPassword } = data;
        if (!oldPassword || !newPassword) {
            throw new AppError("Vui lòng nhập mật khẩu cũ và mật khẩu mới.", 400);
        }

        if (newPassword.length < 6) {
            throw new AppError("Mật khẩu mới phải có ít nhất 6 ký tự.", 400);
        }

        const user = await userRepository.findById(userId);
        if (!user || !user.passwordHash) {
            throw new AppError("Không tìm thấy người dùng.", 404);
        }

        const isMatch = await comparePassword(oldPassword, user.passwordHash);
        if (!isMatch) {
            throw new AppError("Mật khẩu cũ không chính xác.", 400);
        }

        const passwordHash = await hashPassword(newPassword);
        await userRepository.update(userId, { passwordHash });

        return { message: "Đổi mật khẩu thành công." };
    }

    /** Làm mới Access Token từ Refresh Token */
    async refreshTokenService(incomingToken: string) {
        if (!incomingToken) {
            throw new AppError("Không tìm thấy Refresh Token.", 401);
        }

        let userId: string;
        try {
            const decoded = verifyToken(incomingToken) as any;
            userId = decoded.userId;
        } catch (err) {
            throw new AppError("Refresh Token không hợp lệ hoặc đã hết hạn.", 403);
        }

        if (!userId) {
            throw new AppError("Token không chứa thông tin người dùng.", 403);
        }

        const storedToken = await redisClient.get(`refresh_token:${userId}`);
        if (!storedToken || storedToken !== incomingToken) {
            throw new AppError("Refresh Token không hợp lệ hoặc đã bị thu hồi.", 403);
        }

        const user = await userRepository.findById(userId);
        if (!user) {
            throw new AppError("Không tìm thấy người dùng.", 404);
        }

        const newAccessToken = generateToken({
            userId: user._id.toString(),
            email: user.email,
            role: user.role,
        });

        return { token: newAccessToken };
    }

    /** Đăng xuất (Thu hồi refresh token trên Redis) */
    async logoutService(userId: string, refreshToken?: string) {
        let targetUserId = userId;

        if (!targetUserId && refreshToken) {
            try {
                const decoded: any = verifyToken(refreshToken);
                targetUserId = decoded?.userId;
            } catch (err) {
                // Bỏ qua lỗi token
            }
        }

        if (targetUserId) {
            await redisClient.del(`refresh_token:${targetUserId}`);
            await userRepository.update(targetUserId, {
                status: "offline",
            });
        }

        return { message: "Đăng xuất thành công." };
    }
}

export const authService = new AuthService();