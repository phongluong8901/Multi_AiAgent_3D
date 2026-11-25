import { AgentBindingModel, IAgentBinding } from "../models/agent-binding.model";

/**
 * Repository tuong tac voi Collection `agent_bindings`:
 * Quan ly viec luu tru, truy van va cap nhat lien ket giua AI Agent va phien thue may phan cung.
 */
export class AgentBindingRepository {
    /**
     * Tao moi hoac cap nhat lien ket giua Agent va Phien thue (Upsert)
     */
    async createOrUpdate(data: Partial<IAgentBinding>): Promise<IAgentBinding> {
        return await AgentBindingModel.findOneAndUpdate(
            { agentId: data.agentId, ownerId: data.ownerId },
            { $set: data },
            { upsert: true, new: true }
        );
    }

    /**
     * Tim tat ca lien ket dang hoat dong cua mot Owner
     */
    async findByOwnerId(ownerId: string): Promise<IAgentBinding[]> {
        return await AgentBindingModel.find({ ownerId, isActive: true });
    }

    /**
     * Tim lien ket phan cung dang hoat dong cua mot Agent cu the
     */
    async findByAgentId(agentId: string): Promise<IAgentBinding | null> {
        return await AgentBindingModel.findOne({ agentId, isActive: true });
    }

    /**
     * Tang bo dem tong so prompt da suy luan thanh cong qua lien ket
     */
    async incrementPrompts(bindingId: string): Promise<void> {
        await AgentBindingModel.updateOne({ bindingId }, { $inc: { totalPromptsHandled: 1 } });
    }
}

export const agentBindingRepository = new AgentBindingRepository();
