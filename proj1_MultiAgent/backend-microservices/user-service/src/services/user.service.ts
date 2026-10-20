import { userRepository } from "../repositories/user.repository";
import { AppError } from "../utils/exceptions";
import { UpdateProfileInput } from "../types/user.types";
import { UserModel } from "../models/user.model";
import { uploadBufferToCloudinary } from "../utils/cloudinary.util";

// Khởi tạo và export lớp UserService chuyên quản lý thông tin người dùng, avatar, agent và node phần cứng
export class UserService {

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