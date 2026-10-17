import { userRepository } from "../repositories/user.repository";
import { hashPassword, comparePassword } from "../utils/hash.util";
import { generateToken } from "../utils/jwt.util";
import { AppError } from "../utils/exceptions";
import { RegisterInput, LoginInput, UpdateProfileInput } from "../types/user.types";
import { OAuth2Client } from "google-auth-library";
import { UserValidator } from "../middlewares/user.validation";
import { sendEmail } from "../email/user.email";
import { generateOtpCode, getOtpExpirationTime } from "../utils/otp";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export class UserService {
    /** Đăng ký tài khoản truyền thống (Gửi mã OTP 6 số qua email) */
    async register(data: RegisterInput) {
        UserValidator.validateRegister(data);

        const existing = await userRepository.findByEmail(data.email);
        if (existing) {
            // Nếu đã tồn tại nhưng chưa kích hoạt, cho phép cấp lại OTP mới
            if (!existing.isVerified) {
                const otpCode = generateOtpCode();
                const otpExpiresAt = getOtpExpirationTime(5); // Hạn 5 phút

                await userRepository.update(existing._id.toString(), {
                    otpCode,
                    otpExpiresAt,
                });

                await sendEmail(
                    data.email,
                    "Mã OTP xác thực tài khoản Claw Office",
                    `<h3>Xin chào ${existing.username},</h3>
                     <p>Tài khoản của bạn chưa được kích hoạt. Mã OTP xác thực mới của bạn là:</p>
                     <h2 style="color: #2563eb; letter-spacing: 2px;">${otpCode}</h2>
                     <p>Mã này có hiệu lực trong vòng 5 phút.</p>`
                );

                return {
                    message: "Tài khoản chưa được kích hoạt. Chúng tôi đã gửi lại mã OTP mới qua email của bạn.",
                    email: data.email,
                };
            }
            throw new AppError("Email đã được sử dụng bởi tài khoản khác.", 400);
        }

        const passwordHash = await hashPassword(data.password);

        // Sinh mã OTP và thời gian hết hạn
        const otpCode = generateOtpCode();
        const otpExpiresAt = getOtpExpirationTime(5);

        const newUser = await userRepository.create({
            username: data.username.trim(),
            email: data.email.toLowerCase().trim(),
            passwordHash,
            role: data.role || "employee",
            isVerified: false, // Chưa kích hoạt
            otpCode,
            otpExpiresAt,
        });

        // Gửi mã OTP qua email
        await sendEmail(
            data.email,
            "Mã OTP xác thực tài khoản Claw Office",
            `<h3>Xin chào ${data.username},</h3>
             <p>Cảm ơn bạn đã đăng ký tài khoản tại Claw Office.</p>
             <p>Mã OTP xác thực tài khoản của bạn là:</p>
             <h2 style="color: #2563eb; letter-spacing: 2px;">${otpCode}</h2>
             <p>Mã này có hiệu lực trong vòng 5 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>`
        );

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

        // Kiểm tra hạn sử dụng của OTP
        if (user.otpExpiresAt && new Date() > new Date(user.otpExpiresAt)) {
            throw new AppError("Mã OTP đã hết hạn. Vui lòng yêu cầu gửi lại mã mới.", 400);
        }

        // Cập nhật trạng thái kích hoạt và xóa bỏ OTP đã dùng
        await userRepository.update(user._id.toString(), {
            isVerified: true,
            otpCode: undefined,
            otpExpiresAt: undefined,
        });

        return { message: "Xác thực tài khoản thành công! Bạn có thể đăng nhập ngay bây giờ." };
    }

    /** Gửi lại mã OTP mới */
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

        await sendEmail(
            user.email,
            "Mã OTP mới cho Claw Office",
            `<p>Mã OTP mới của bạn là:</p>
             <h2 style="color: #2563eb; letter-spacing: 2px;">${otpCode}</h2>
             <p>Mã có hiệu lực trong vòng 5 phút.</p>`
        );

        return { message: "Đã gửi lại mã OTP mới qua email." };
    }

    /** Đăng nhập truyền thống */
    async login(data: LoginInput) {
        UserValidator.validateLogin(data);

        const user = await userRepository.findByEmail(data.email);
        if (!user || !user.passwordHash) {
            throw new AppError("Email hoặc mật khẩu không chính xác.", 401);
        }

        // Kiểm tra xem tài khoản đã kích hoạt OTP chưa
        if (!user.isVerified) {
            throw new AppError("Tài khoản chưa được xác thực OTP. Vui lòng kiểm tra email để kích hoạt.", 403);
        }

        const isMatch = await comparePassword(data.password, user.passwordHash);
        if (!isMatch) {
            throw new AppError("Email hoặc mật khẩu không chính xác.", 401);
        }

        await userRepository.update(user._id.toString(), { status: "online" });

        const token = generateToken({
            userId: user._id.toString(),
            email: user.email,
            role: user.role,
        });

        return {
            token,
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

            let user = await userRepository.findByGoogleId(googleId);

            if (!user) {
                user = await userRepository.findByEmail(email);

                if (user) {
                    user = await userRepository.update(user._id.toString(), {
                        googleId,
                        avatarUrl: user.avatarUrl || avatarUrl,
                        status: "online",
                        isVerified: true, // Google đã verify sẵn
                    });
                } else {
                    user = await userRepository.create({
                        username: name,
                        email,
                        googleId,
                        avatarUrl,
                        role: "employee",
                        status: "online",
                        isVerified: true, // Google đã verify sẵn
                    });
                }
            } else {
                user = await userRepository.update(user._id.toString(), { status: "online" });
            }

            if (!user) {
                throw new AppError("Không thể khởi tạo hoặc tìm thấy tài khoản người dùng.", 500);
            }

            const token = generateToken({
                userId: user._id.toString(),
                email: user.email,
                role: user.role,
            });

            return {
                token,
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
            throw new AppError(`Xác thực Google thất bại: ${error.message}`, 401);
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
}

export const userService = new UserService();