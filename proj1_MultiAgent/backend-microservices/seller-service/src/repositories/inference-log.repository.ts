import { InferenceLogModel, IInferenceLog } from "../models/inference-log.model";

/**
 * Repository truy xuất dữ liệu lịch sử suy luận AI (Inference Logs) trong MongoDB.
 */
export class InferenceLogRepository {
    /** Tạo mới một bản ghi log sau khi hoàn tất phiên suy luận */
    async create(data: Partial<IInferenceLog>): Promise<IInferenceLog> {
        const log = new InferenceLogModel(data);
        return await log.save();
    }

    /** Lấy lịch sử suy luận của một Node cụ thể */
    async findByNodeId(nodeId: string, limit = 20): Promise<IInferenceLog[]> {
        return await InferenceLogModel.find({ nodeId }).sort({ createdAt: -1 }).limit(limit);
    }

    /** Lấy lịch sử suy luận của nhiều Node cùng lúc (dùng cho dashboard của Seller) */
    async findByNodeIds(nodeIds: string[], limit = 20): Promise<IInferenceLog[]> {
        return await InferenceLogModel.find({ nodeId: { $in: nodeIds } }).sort({ createdAt: -1 }).limit(limit);
    }

    /** Lấy danh sách các phiên suy luận mới nhất trên toàn hệ thống */
    async findRecent(limit = 20): Promise<IInferenceLog[]> {
        return await InferenceLogModel.find().sort({ createdAt: -1 }).limit(limit);
    }
}

export const inferenceLogRepository = new InferenceLogRepository();
