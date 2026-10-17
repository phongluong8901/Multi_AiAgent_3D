import { RegisterInput, LoginInput } from "../types/user.types";
import { AppError } from "../utils/exceptions";

export class UserValidator {
    static validateRegister(data: RegisterInput): void {
        if (!data.username || !data.email || !data.password) {
            throw new AppError("Vui lòng điền đầy đủ thông tin: username, email và password.", 400);
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
            throw new AppError("Địa chỉ email không hợp lệ.", 400);
        }

        if (data.password.length < 6) {
            throw new AppError("Mật khẩu phải có ít nhất 6 ký tự.", 400);
        }
    }

    static validateLogin(data: LoginInput): void {
        if (!data.email || !data.password) {
            throw new AppError("Vui lòng cung cấp đầy đủ email và mật khẩu.", 400);
        }
    }

    static validateGoogleToken(idToken: string): void {
        if (!idToken) {
            throw new AppError("Thiếu Google ID Token.", 400);
        }
    }
}