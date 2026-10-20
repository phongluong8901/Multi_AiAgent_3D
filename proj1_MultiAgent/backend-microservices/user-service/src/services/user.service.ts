import { userRepository } from "../repositories/user.repository";
import { AppError } from "../utils/exceptions";
import { UpdateProfileInput } from "../types/user.types";
import { UserModel } from "../models/user.model";
import { uploadBufferToCloudinary } from "../utils/cloudinary.util";

/**
 * UserService chuyên quản lý thông tin người dùng, avatar, agent và node phần cứng (hardware node).
 */
export class UserService {

    /**
     * Lấy toàn bộ danh sách người dùng từ cơ sở dữ liệu thông qua repository.
     */
    async getAllUsers() {
        return await userRepository.findAll();
    }

    /**
     * Lấy thông tin chi tiết một người dùng dựa vào ID.
     * Tự động xóa trường `passwordHash` trước khi trả về để đảm bảo bảo mật.
     */
    async getUserById(id: string) {
        if (!id) throw new AppError("ID người dùng không được để trống.", 400);

        const user = await userRepository.findById(id);
        if (!user) throw new AppError("Không tìm thấy người dùng.", 404);

        // Chuyển đổi mongoose document sang object thuần nếu cần, sau đó loại bỏ passwordHash
        const userObj = (user as any).toObject ? (user as any).toObject() : user;
        delete userObj.passwordHash;
        return userObj;
    }

    /**
     * Cập nhật thông tin profile của người dùng (username, bio, avatarUrl,...).
     * Làm sạch dữ liệu đầu vào trước khi lưu vào DB.
     */
    async updateProfile(userId: string, data: UpdateProfileInput) {
        if (!userId) throw new AppError("ID người dùng không hợp lệ.", 400);

        const safeData: Record<string, any> = {};
        if (data.username) safeData.username = data.username.trim();
        if (data.name) safeData.username = data.name.trim(); // Hỗ trợ trường name mapping sang username
        if (data.avatarUrl !== undefined) safeData.avatarUrl = data.avatarUrl;
        if (data.bio !== undefined) safeData.bio = data.bio;

        const updated = await userRepository.update(userId, safeData);
        if (!updated) throw new AppError("Không tìm thấy người dùng để cập nhật.", 404);

        const userObj = (updated as any).toObject ? (updated as any).toObject() : updated;
        delete userObj.passwordHash;
        return userObj;
    }

    /**
     * Cập nhật trạng thái hoạt động của người dùng (online, offline, busy).
     */
    async updateStatus(userId: string, status: "online" | "offline" | "busy") {
        const allowedStatuses = ["online", "offline", "busy"];
        if (!allowedStatuses.includes(status)) {
            throw new AppError("Trạng thái không hợp lệ.", 400);
        }

        const updated = await userRepository.update(userId, { status });
        if (!updated) throw new AppError("Không tìm thấy người dùng.", 404);

        return { id: userId, status };
    }

    /**
     * Tải ảnh đại diện lên Cloudinary, cập nhật URL mới vào DB của user và trả về kết quả.
     */
    async updateAvatar(userId: string, fileBuffer: Buffer) {
        if (!fileBuffer) {
            throw new AppError("Vui lòng tải lên một file ảnh.", 400);
        }

        // Upload buffer ảnh lên Cloudinary
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

    /**
     * Lấy danh sách ID các agent mà người dùng đang sở hữu.
     */
    async getOwnedAgents(userId: string) {
        const user = await userRepository.findById(userId);
        if (!user) throw new AppError("Không tìm thấy người dùng.", 404);
        return { ownedAgentIds: user.ownedAgentIds || [] };
    }

    /**
     * Thêm một agent mới vào danh sách sở hữu của người dùng (tránh trùng lặp ID).
     */
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

    /**
     * Xóa một agent khỏi danh sách sở hữu của người dùng.
     */
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

    /**
     * Cập nhật thông số kỹ thuật phần cứng (Hardware Node) dùng để tính toán AI của người dùng.
     */
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

    /**
     * Lấy thông tin cấu hình phần cứng hiện tại của một người dùng.
     */
    async getHardwareNode(userId: string) {
        if (!userId) throw new AppError("ID người dùng không hợp lệ.", 400);

        const user = await userRepository.findById(userId);
        if (!user) throw new AppError("Không tìm thấy người dùng.", 404);

        return user.hardwareNode || null;
    }

    /**
     * Lấy danh sách tất cả các node phần cứng trong hệ thống có khả năng chạy AI (`canRunAI: true`),
     * chỉ chọn lọc một số trường cần thiết để tối ưu hiệu năng truy vấn (`lean()`).
     */
    async getAllHardwareNodes() {
        return await UserModel.find(
            { 'hardwareNode.canRunAI': true },
            'username email avatarUrl status hardwareNode'
        ).lean();
    }
}

// Khởi tạo và export ra một instance duy nhất (Singleton) của UserService
export const userService = new UserService();