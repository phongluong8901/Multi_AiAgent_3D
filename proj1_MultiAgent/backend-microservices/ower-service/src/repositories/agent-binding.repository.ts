import { AgentBindingModel, IAgentBinding } from "../models/agent-binding.model";

export class AgentBindingRepository {
    async createOrUpdate(data: Partial<IAgentBinding>): Promise<IAgentBinding> {
        return await AgentBindingModel.findOneAndUpdate(
            { agentId: data.agentId, ownerId: data.ownerId },
            { $set: data },
            { upsert: true, new: true }
        );
    }

    async findByOwnerId(ownerId: string): Promise<IAgentBinding[]> {
        return await AgentBindingModel.find({ ownerId, isActive: true });
    }

    async findByAgentId(agentId: string): Promise<IAgentBinding | null> {
        return await AgentBindingModel.findOne({ agentId, isActive: true });
    }

    async incrementPrompts(bindingId: string): Promise<void> {
        await AgentBindingModel.updateOne({ bindingId }, { $inc: { totalPromptsHandled: 1 } });
    }
}

export const agentBindingRepository = new AgentBindingRepository();
