import { InferenceLogModel, IInferenceLog } from "../models/inference-log.model";

export class InferenceLogRepository {
    async create(data: Partial<IInferenceLog>): Promise<IInferenceLog> {
        const log = new InferenceLogModel(data);
        return await log.save();
    }

    async findByNodeId(nodeId: string, limit = 20): Promise<IInferenceLog[]> {
        return await InferenceLogModel.find({ nodeId }).sort({ createdAt: -1 }).limit(limit);
    }

    async findByNodeIds(nodeIds: string[], limit = 20): Promise<IInferenceLog[]> {
        return await InferenceLogModel.find({ nodeId: { $in: nodeIds } }).sort({ createdAt: -1 }).limit(limit);
    }

    async findRecent(limit = 20): Promise<IInferenceLog[]> {
        return await InferenceLogModel.find().sort({ createdAt: -1 }).limit(limit);
    }
}

export const inferenceLogRepository = new InferenceLogRepository();
