import { Schema, model, Document } from "mongoose";

/**
 * Interface mo ta lien ket giua AI Agent va Node phan cung dang thue:
 * - agentId: Dinh danh cua Agent duoc cap quyen su dung
 * - rentalSessionId: ID phien thue dang hoat dong tren Marketplace
 * - nodeId: Dinh danh may Worker GPU/NPU cua Seller
 * - modelKey: Mo hinh LLM duoc chi dinh cho Agent
 * - totalPromptsHandled: So luong prompt suy luan da xu ly qua node
 */
export interface IAgentBinding extends Document {
    bindingId: string;
    agentId: string;
    agentName: string;
    rentalSessionId: string;
    nodeId: string;
    modelKey: string;
    ownerId: string;
    isActive: boolean;
    totalPromptsHandled: number;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Mongoose Schema cho Agent Binding
 */
const AgentBindingSchema = new Schema<IAgentBinding>(
    {
        bindingId: { type: String, required: true, unique: true, index: true },
        agentId: { type: String, required: true, index: true },
        agentName: { type: String, default: "Multi-Agent" },
        rentalSessionId: { type: String, required: true },
        nodeId: { type: String, required: true },
        modelKey: { type: String, required: true },
        ownerId: { type: String, required: true, index: true },
        isActive: { type: Boolean, default: true },
        totalPromptsHandled: { type: Number, default: 0 },
    },
    {
        timestamps: true,
    }
);

export const AgentBindingModel = model<IAgentBinding>("AgentBinding", AgentBindingSchema, "agent_bindings");
