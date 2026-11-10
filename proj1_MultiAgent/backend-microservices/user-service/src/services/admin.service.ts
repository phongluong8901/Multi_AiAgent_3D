import { userRepository } from "../repositories/user.repository";
import { UserModel } from "../models/user.model";
import { AppError } from "../utils/exceptions";

// Khởi tạo và export lớp AdminService chuyên quản lý các nghiệp vụ quản trị cấp cao
export class AdminService {

    /** 
     * Lấy danh sách toàn bộ người dùng trong hệ thống (hoặc lọc theo role tùy chọn) 
     */
    async getAllUsers(role?: "guest" | "user" | "admin" | "seller") {
        if (role) {
            return await userRepository.findByRole(role);
        }
        return await userRepository.findAll();
    }

    /** 
     * Lấy thông tin chi tiết một người dùng bất kỳ theo ID 
     */
    async getUserDetails(userId: string) {
        if (!userId) throw new AppError("ID người dùng không được để trống.", 400);

        const user = await userRepository.findById(userId);
        if (!user) throw new AppError("Không tìm thấy người dùng.", 404);

        const userObj = (user as any).toObject ? (user as any).toObject() : user;
        delete userObj.passwordHash;
        return userObj;
    }

    /** 
     * Thay đổi vai trò (role) của một người dùng trong hệ thống 
     */
    async updateUserRole(targetUserId: string, newRole: "guest" | "user" | "admin" | "seller") {
        if (!targetUserId || !newRole) {
            throw new AppError("Thiếu thông tin ID người dùng hoặc vai trò mới.", 400);
        }

        const updated = await userRepository.update(targetUserId, { role: newRole });
        if (!updated) throw new AppError("Không tìm thấy người dùng để cập nhật phân quyền.", 404);

        return {
            message: `Đã cập nhật phân quyền thành công sang ${newRole}`,
            user: {
                id: updated._id,
                username: updated.username,
                email: updated.email,
                role: updated.role
            }
        };
    }

    /** 
     * Thực hiện xóa mềm (Soft Delete) tài khoản người dùng bởi Admin 
     */
    async softDeleteUser(targetUserId: string) {
        if (!targetUserId) throw new AppError("ID người dùng không hợp lệ.", 400);

        const success = await userRepository.softDelete(targetUserId);
        if (!success) throw new AppError("Không thể xóa mềm tài khoản hoặc tài khoản không tồn tại.", 400);

        return { message: "Đã thực hiện xóa mềm tài khoản thành công." };
    }

    /** 
     * Thống kê và lấy danh sách toàn bộ các Hardware Node có năng lực chạy AI trên hệ thống 
     */
    async getSystemHardwareNodes() {
        return await UserModel.find(
            { 'hardwareNode.canRunAI': true, isDeleted: { $ne: true } },
            'username email role status location hardwareNode'
        ).lean();
    }
}

export const adminService = new AdminService();