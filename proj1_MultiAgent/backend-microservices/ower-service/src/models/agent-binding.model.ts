import { Schema, model, Document } from "mongoose";

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
