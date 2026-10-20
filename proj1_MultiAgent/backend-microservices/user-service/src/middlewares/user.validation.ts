import { RegisterInput, LoginInput } from "../types/user.types";
import { AppError } from "../utils/exceptions";

export class UserValidator {
    // Phương thức kiểm tra tính hợp lệ của dữ liệu khi người dùng đăng ký tài khoản
    static validateRegister(data: RegisterInput): void {

        // Kiểm tra xem các trường bắt buộc (username, email, password) có bị thiếu hoặc rỗng hay không
        if (!data.username || !data.email || !data.password) {
            throw new AppError("Vui lòng điền đầy đủ thông tin: username, email và password.", 400);
        }

        // Biểu thức chính quy (Regex) dùng để kiểm tra định dạng email chuẩn cơ bản
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
            throw new AppError("Địa chỉ email không hợp lệ.", 400);
        }

        // Biểu thức chính quy (Regex) dùng để kiểm tra định dạng email chuẩn cơ bản
        if (data.password.length < 6) {
            throw new AppError("Mật khẩu phải có ít nhất 6 ký tự.", 400);
        }
    }

    // Phương thức kiểm tra tính hợp lệ của dữ liệu khi người dùng đăng nhập
    static validateLogin(data: LoginInput): void {
        if (!data.email || !data.password) {
            throw new AppError("Vui lòng cung cấp đầy đủ email và mật khẩu.", 400);
        }
    }

    // Phương thức kiểm tra tính hợp lệ của Google ID Token khi đăng nhập bằng tài khoản Google (OAuth2 / SSO)
    static validateGoogleToken(idToken: string): void {
        if (!idToken) {
            throw new AppError("Thiếu Google ID Token.", 400);
        }
    }
}