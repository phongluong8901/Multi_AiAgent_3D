import { userRepository } from "../repositories/user.repository";
import { hashPassword, comparePassword } from "../utils/hash.util";
import { generateRefreshToken, generateToken, verifyToken } from "../utils/jwt.util";
import { AppError } from "../utils/exceptions";
import { RegisterInput, LoginInput, UpdateProfileInput } from "../types/user.types";
import { OAuth2Client } from "google-auth-library";
import { UserValidator } from "../middlewares/user.validation";
import { generateOtpCode, getOtpExpirationTime } from "../utils/otp";
import { UserModel, IUser } from "../models/user.model";
import { uploadBufferToCloudinary } from "../utils/cloudinary.util";
import { sendToQueue } from "../config/rabbitmq";
import { redisClient } from "../config/redis";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export class UserService {
    /** Đăng ký tài khoản truyền thống (Gửi mã OTP qua RabbitMQ) */
    async register(data: RegisterInput) {
        UserValidator.validateRegister(data);

        const existing = await userRepository.findByEmail(data.email);
        if (existing) {
            if (!existing.isVerified) {
                const otpCode = generateOtpCode();
                const otpExpiresAt = getOtpExpirationTime(5); // Hạn 5 phút

                await userRepository.update(existing._id.toString(), {
                    otpCode,
                    otpExpiresAt,
                });

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

        const passwordHash = await hashPassword(data.password);
        const otpCode = generateOtpCode();
        const otpExpiresAt = getOtpExpirationTime(5);

        const newUser = await userRepository.create({
            username: data.username.trim(),
            email: data.email.toLowerCase().trim(),
            passwordHash,
            role: data.role || "employee",
            isVerified: false,
            otpCode,
            otpExpiresAt,
        });

        // Đẩy sự kiện gửi mã OTP qua RabbitMQ
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
        delete (userObj as any).otpCode;
        delete (userObj as any).otpExpiresAt;

        return {
            message: "Đăng ký thành công! Vui lòng kiểm tra email để lấy mã OTP xác thực.",
            user: userObj,
        };
    }

    /** Xác thực tài khoản bằng mã OTP */
    async verifyOtp(email: string, otp: string) {
        if (!email || !otp) {
            throw new AppError("Vui lòng cung cấp email và mã OTP.", 400);
        }

        const user = await userRepository.findByEmail(email.toLowerCase().trim());
        if (!user) {
            throw new AppError("Không tìm thấy thông tin người dùng.", 404);
        }

        if (user.isVerified) {
            throw new AppError("Tài khoản này đã được kích hoạt từ trước.", 400);
        }

        if (!user.otpCode || user.otpCode !== otp) {
            throw new AppError("Mã OTP không chính xác.", 400);
        }

        if (user.otpExpiresAt && new Date() > new Date(user.otpExpiresAt)) {
            throw new AppError("Mã OTP đã hết hạn. Vui lòng yêu cầu gửi lại mã mới.", 400);
        }

        await userRepository.update(user._id.toString(), {
            isVerified: true,
            otpCode: undefined,
            otpExpiresAt: undefined,
        });

        return { message: "Xác thực tài khoản thành công! Bạn có thể đăng nhập ngay bây giờ." };
    }

    /** Gửi lại mã OTP mới qua RabbitMQ */
    async resendOtp(email: string) {
        if (!email) {
            throw new AppError("Vui lòng cung cấp email.", 400);
        }

        const user = await userRepository.findByEmail(email.toLowerCase().trim());
        if (!user) {
            throw new AppError("Không tìm thấy người dùng.", 404);
        }

        if (user.isVerified) {
            throw new AppError("Tài khoản đã được kích hoạt rồi.", 400);
        }

        const otpCode = generateOtpCode();
        const otpExpiresAt = getOtpExpirationTime(5);

        await userRepository.update(user._id.toString(), {
            otpCode,
            otpExpiresAt,
        });

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

        const accessToken = generateToken({
            userId: user._id.toString(),
            email: user.email,
            role: user.role,
        });

        //save in mongo
        // const refreshToken = generateRefreshToken({ userId: user._id.toString() }, "7d");

        //save in redis
        const refreshToken = generateRefreshToken({ userId: user._id.toString() }, "7d");
        // Lưu Refresh Token vào Redis (hết hạn sau 7 ngày = 604800 giây)
        await redisClient.set(`refresh_token:${user._id.toString()}`, refreshToken, {
            EX: 7 * 24 * 60 * 60,
        });

        await userRepository.update(user._id.toString(), { refreshToken });

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
                        role: "employee",
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

            //save in mongo
            // const refreshToken = generateRefreshToken({ userId: user._id.toString() }, "7d");

            //save in redis
            const refreshToken = generateRefreshToken({ userId: user._id.toString() }, "7d");
            // Lưu Refresh Token vào Redis (hết hạn sau 7 ngày = 604800 giây)
            await redisClient.set(`refresh_token:${user._id.toString()}`, refreshToken, {
                EX: 7 * 24 * 60 * 60,
            });

            await userRepository.update(user._id.toString(), { refreshToken });

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
            const username = githubUser.name || githubUser.login || "GitHub User";
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
                        avatarUrl: user.avatarUrl || avatarUrl,
                        status: "online",
                        isVerified: true,
                    });
                } else {
                    user = await userRepository.create({
                        username,
                        email,
                        githubId,
                        avatarUrl,
                        role: "employee",
                        status: "online",
                        isVerified: true,
                    });
                }
            } else {
                user = await userRepository.update(user._id.toString(), {
                    status: "online",
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

            //save in mongo
            // const refreshToken = generateRefreshToken({ userId: user._id.toString() }, "7d");

            //save in redis
            const refreshToken = generateRefreshToken({ userId: user._id.toString() }, "7d");
            // Lưu Refresh Token vào Redis (hết hạn sau 7 ngày = 604800 giây)
            await redisClient.set(`refresh_token:${user._id.toString()}`, refreshToken, {
                EX: 7 * 24 * 60 * 60,
            });

            await userRepository.update(user._id.toString(), { refreshToken });

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

    async getAllUsers() {
        return await userRepository.findAll();
    }

    async getUserById(id: string) {
        if (!id) throw new AppError("ID người dùng không được để trống.", 400);
        const user = await userRepository.findById(id);
        if (!user) throw new AppError("Không tìm thấy người dùng.", 404);
        const userObj = (user as any).toObject ? (user as any).toObject() : user;
        delete userObj.passwordHash;
        return userObj;
    }

    async updateProfile(userId: string, data: UpdateProfileInput) {
        if (!userId) throw new AppError("ID người dùng không hợp lệ.", 400);

        const safeData: Record<string, any> = {};
        if (data.username) safeData.username = data.username.trim();
        if (data.name) safeData.username = data.name.trim();
        if (data.avatarUrl !== undefined) safeData.avatarUrl = data.avatarUrl;
        if (data.bio !== undefined) safeData.bio = data.bio;

        const updated = await userRepository.update(userId, safeData);
        if (!updated) throw new AppError("Không tìm thấy người dùng để cập nhật.", 404);

        const userObj = (updated as any).toObject ? (updated as any).toObject() : updated;
        delete userObj.passwordHash;
        return userObj;
    }

    async updateStatus(userId: string, status: "online" | "offline" | "busy") {
        const allowedStatuses = ["online", "offline", "busy"];
        if (!allowedStatuses.includes(status)) {
            throw new AppError("Trạng thái không hợp lệ.", 400);
        }
        const updated = await userRepository.update(userId, { status });
        if (!updated) throw new AppError("Không tìm thấy người dùng.", 404);
        return { id: userId, status };
    }

    /** Yêu cầu quên mật khẩu (Gửi OTP qua RabbitMQ) */
    async forgotPassword(email: string) {
        if (!email) throw new AppError("Vui lòng cung cấp email.", 400);

        const user = await userRepository.findByEmail(email.toLowerCase().trim());
        if (!user) {
            throw new AppError("Không tìm thấy tài khoản với email này.", 404);
        }

        const resetPasswordOtp = generateOtpCode();
        const resetPasswordExpiresAt = getOtpExpirationTime(10); // Hạn 10 phút

        await userRepository.update(user._id.toString(), {
            resetPasswordOtp,
            resetPasswordExpiresAt,
        });

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

    /** Đặt lại mật khẩu mới bằng OTP */
    async resetPassword(data: { email: string; otp: string; newPassword: string }) {
        const { email, otp, newPassword } = data;
        if (!email || !otp || !newPassword) {
            throw new AppError("Vui lòng cung cấp đầy đủ email, mã OTP và mật khẩu mới.", 400);
        }

        if (newPassword.length < 6) {
            throw new AppError("Mật khẩu mới phải có ít nhất 6 ký tự.", 400);
        }

        const user = await userRepository.findByEmail(email.toLowerCase().trim());
        if (!user) throw new AppError("Không tìm thấy người dùng.", 404);

        if (!user.resetPasswordOtp || user.resetPasswordOtp !== otp) {
            throw new AppError("Mã OTP không chính xác.", 400);
        }

        if (user.resetPasswordExpiresAt && new Date() > new Date(user.resetPasswordExpiresAt)) {
            throw new AppError("Mã OTP đã hết hạn.", 400);
        }

        const passwordHash = await hashPassword(newPassword);

        await userRepository.update(user._id.toString(), {
            passwordHash,
            resetPasswordOtp: undefined,
            resetPasswordExpiresAt: undefined,
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

        // 1. Decode Refresh Token để lấy userId (dùng jwt.verify hoặc hàm util có sẵn của bạn)
        let userId: string;
        try {
            const decoded = verifyToken(incomingToken) as any; // Hoặc hàm verifyRefreshToken của bạn
            userId = decoded.userId;
        } catch (err) {
            throw new AppError("Refresh Token không hợp lệ hoặc đã hết hạn.", 403);
        }

        if (!userId) {
            throw new AppError("Token không chứa thông tin người dùng.", 403);
        }

        // 2. Lấy token lưu trong Redis theo userId ra kiểm tra
        const storedToken = await redisClient.get(`refresh_token:${userId}`);
        if (!storedToken || storedToken !== incomingToken) {
            throw new AppError("Refresh Token không hợp lệ hoặc đã bị thu hồi.", 403);
        }

        // 3. Tìm thông tin người dùng để cấp Access Token mới
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

    /** Đăng xuất (Thu hồi refresh token) */
    async logoutService(userId: string, refreshToken?: string) {
        let targetUserId = userId;

        // Nếu thiếu userId từ header nhưng có refreshToken, ta có thể decode để lấy userId xóa cho chuẩn
        if (!targetUserId && refreshToken) {
            try {
                const decoded: any = verifyToken(refreshToken); // Hoặc hàm verify token của bạn
                targetUserId = decoded?.userId;
            } catch (err) {
                // Token lỗi hoặc hết hạn thì bỏ qua
            }
        }

        if (targetUserId) {
            // Xóa refresh token khỏi Redis
            await redisClient.del(`refresh_token:${targetUserId}`);
            await userRepository.update(targetUserId, {
                status: "offline",
                refreshToken: undefined
            });
        }

        return { message: "Đăng xuất thành công." };
    }

    async updateAvatar(userId: string, fileBuffer: Buffer) {
        if (!fileBuffer) {
            throw new AppError("Vui lòng tải lên một file ảnh.", 400);
        }

        const avatarUrl = await uploadBufferToCloudinary(fileBuffer);
        const updated = await userRepository.update(userId, { avatarUrl });
        if (!updated) {
            throw new AppError("Không tìm thấy người dùng để cập nhật avatar.", 404);
        }

        const userObj = (updated as any).toObject ? (updated as any).toObject() : updated;
        delete userObj.passwordHash;

        return {
            message: "Cập nhật ảnh đại diện thành công!",
            avatarUrl,
            user: userObj,
        };
    }

    async getOwnedAgents(userId: string) {
        const user = await userRepository.findById(userId);
        if (!user) throw new AppError("Không tìm thấy người dùng.", 404);
        return { ownedAgentIds: user.ownedAgentIds || [] };
    }

    async addOwnedAgent(userId: string, agentId: string) {
        if (!agentId) throw new AppError("Mã Agent không hợp lệ.", 400);

        const user = await userRepository.findById(userId);
        if (!user) throw new AppError("Không tìm thấy người dùng.", 404);

        const currentIds: string[] = user.ownedAgentIds || [];
        if (currentIds.includes(agentId)) {
            return { ownedAgentIds: currentIds };
        }

        const updated = await userRepository.update(userId, {
            ownedAgentIds: [...currentIds, agentId],
        });
        const userObj = (updated as any).toObject ? (updated as any).toObject() : updated;
        delete userObj?.passwordHash;
        return userObj;
    }

    async removeOwnedAgent(userId: string, agentId: string) {
        if (!agentId) throw new AppError("Mã Agent không hợp lệ.", 400);

        const user = await userRepository.findById(userId);
        if (!user) throw new AppError("Không tìm thấy người dùng.", 404);

        const filtered = (user.ownedAgentIds || []).filter((id: string) => id !== agentId);
        const updated = await userRepository.update(userId, { ownedAgentIds: filtered });
        const userObj = (updated as any).toObject ? (updated as any).toObject() : updated;
        delete userObj?.passwordHash;
        return userObj;
    }

    async updateHardwareNode(userId: string, hardwareData: any) {
        if (!userId) throw new AppError("ID người dùng không hợp lệ.", 400);

        const nodeInfo = {
            cpuCores: Number(hardwareData.cpuCores) || 0,
            deviceMemoryGB: Number(hardwareData.deviceMemoryGB) || 0,
            hasWebGPU: Boolean(hardwareData.hasWebGPU),
            gpuName: hardwareData.gpuName || "",
            recommendedModels: Array.isArray(hardwareData.recommendedModels) ? hardwareData.recommendedModels : [],
            canRunAI: Boolean(hardwareData.canRunAI),
            status: "IDLE" as const,
            lastSeen: new Date(),
            updatedAt: new Date(),
        };

        const updated = await userRepository.update(userId, { hardwareNode: nodeInfo });
        if (!updated) throw new AppError("Không tìm thấy người dùng.", 404);

        return {
            message: "Đã cập nhật thông số nút tính toán AI thành công!",
            hardwareNode: updated.hardwareNode,
        };
    }

    async getHardwareNode(userId: string) {
        if (!userId) throw new AppError("ID người dùng không hợp lệ.", 400);
        const user = await userRepository.findById(userId);
        if (!user) throw new AppError("Không tìm thấy người dùng.", 404);
        return user.hardwareNode || null;
    }

    async getAllHardwareNodes() {
        return await UserModel.find(
            { 'hardwareNode.canRunAI': true },
            'username email avatarUrl status hardwareNode'
        ).lean();
    }
}

export const userService = new UserService();