import { Schema, model, Document } from "mongoose";

export interface IRoomMember {
    memberId: string; // userId hoặc agentId
    memberType: "user" | "agent";
    role: "owner" | "participant" | "observer";
    name?: string;
    color?: string;
    avatar?: string;
    status?: string;
    joinedAt?: Date;
}

export interface IRoomSettings {
    allowCrossCommands?: boolean;
    autonomousHandoff?: boolean;
    maxAutoTurns?: number;
}

export interface IUserAgentBinding {
    userId: string;
    userName: string;
    userColor?: string;
    agentId: string;
    agentName?: string;
    assignedAt?: Date;
}

export interface IRoom extends Document {
    name: string;
    description?: string;
    maxCapacity: number;
    members: IRoomMember[];
    activeAgents: string[];
    userAgents: IUserAgentBinding[];
    settings: IRoomSettings;
    createdAt: Date;
    updatedAt: Date;
}

const RoomSchema = new Schema<IRoom>(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, default: "" },
        maxCapacity: { type: Number, default: 20 },
        activeAgents: {
            type: [String],
            default: ["agent_manager", "agent_ml", "agent_analyst", "agent_search", "agent_summarizer"],
        },
        userAgents: [
            {
                userId: { type: String, required: true },
                userName: { type: String, required: true },
                userColor: { type: String, default: "#3b82f6" },
                agentId: { type: String, required: true },
                agentName: { type: String, default: "" },
                assignedAt: { type: Date, default: Date.now },
            },
        ],
        settings: {
            allowCrossCommands: { type: Boolean, default: true },
            autonomousHandoff: { type: Boolean, default: true },
            maxAutoTurns: { type: Number, default: 3 },
        },
        members: [
            {
                memberId: { type: String, required: true },
                memberType: { type: String, enum: ["user", "agent"], required: true },
                role: { type: String, enum: ["owner", "participant", "observer"], default: "participant" },
                name: { type: String, default: "" },
                color: { type: String, default: "#3b82f6" },
                avatar: { type: String, default: "" },
                status: { type: String, default: "idle" },
                joinedAt: { type: Date, default: Date.now },
            },
        ],
    },
    { timestamps: true }
);

export const RoomModel = model<IRoom>("Room", RoomSchema);