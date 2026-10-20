import { userRepository } from "../repositories/user.repository";
import { AppError } from "../utils/exceptions";
import { redisClient } from "../config/redis";

// Khởi tạo và export lớp SellerService quản lý các nghiệp vụ chuyên sâu của người bán node AI
export class SellerService {

    /** 
     * Đăng ký nâng cấp tài khoản thành Seller và cấu hình thông số nút tính toán phần cứng AI chia sẻ 
     */
    async registerNode(userId: string, hardwareConfig: any) {
        if (!userId) throw new AppError("ID người dùng không hợp lệ.", 400);

        const updated = await userRepository.update(userId, {
            role: "seller", // Nâng cấp role người dùng thành seller
            hardwareNode: {
                cpuCores: Number(hardwareConfig.cpuCores) || 0,
                deviceMemoryGB: Number(hardwareConfig.deviceMemoryGB) || 0,
                hasWebGPU: Boolean(hardwareConfig.hasWebGPU),
                gpuName: hardwareConfig.gpuName || "",
                recommendedModels: Array.isArray(hardwareConfig.recommendedModels) ? hardwareConfig.recommendedModels : [],
                canRunAI: true,
                status: "IDLE",
                lastSeen: new Date(),
                updatedAt: new Date()
            }
        });

        if (!updated) throw new AppError("Không tìm thấy người dùng để đăng ký node.", 404);

        return {
            message: "Đăng ký Seller và Node phần cứng thành công!",
            user: {
                id: updated._id,
                username: updated.username,
                email: updated.email,
                role: updated.role,
                hardwareNode: updated.hardwareNode
            }
        };
    }

    /** 
     * Xử lý tín hiệu Ping / Heartbeat từ phần cứng AI của Seller qua Redis 
     * Cập nhật trạng thái sống lên Redis với TTL 45 giây và đồng thời cập nhật tọa độ vị trí (nếu có) 
     */
    async handleHeartbeat(userId: string, status: 'IDLE' | 'BUSY', location?: [number, number]) {
        if (!userId) throw new AppError("ID người dùng không hợp lệ.", 400);

        const payload = JSON.stringify({ status, lastSeen: Date.now() });
        // Lưu cờ hoạt động tức thì lên Redis, tự động hủy sau 45 giây nếu mất kết nối
        await redisClient.set(`ainode:active:${userId}`, payload, { EX: 45 });

        const updateData: any = {
            'hardwareNode.status': status,
            'hardwareNode.lastSeen': new Date()
        };

        if (location && Array.isArray(location) && location.length === 2) {
            updateData.location = { type: "Point", coordinates: location };
        }

        const updated = await userRepository.update(userId, updateData);
        if (!updated) throw new AppError("Không tìm thấy thông tin Seller.", 404);

        return { success: true, message: "Heartbeat recorded successfully" };
    }

    /** 
     * Lấy thông tin chi tiết cấu hình node phần cứng của Seller đang quản lý 
     */
    async getNodeDetails(userId: string) {
        if (!userId) throw new AppError("ID người dùng không hợp lệ.", 400);

        const user = await userRepository.findById(userId);
        if (!user) throw new AppError("Không tìm thấy người dùng.", 404);
        if (user.role !== "seller") throw new AppError("Tài khoản này không phải là Seller.", 403);

        return user.hardwareNode || null;
    }
}

export const sellerService = new SellerService();