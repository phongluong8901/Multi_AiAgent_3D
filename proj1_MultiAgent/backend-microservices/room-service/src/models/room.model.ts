import { Schema, model, Document } from "mongoose";

export interface IRoomMember {
    memberId: string; // userId (ObjectId string từ user-service) hoặc agentId (từ FastAPI agent-service)
    memberType: "user" | "agent";
    role: "owner" | "participant" | "observer";
}

export interface IRoom extends Document {
    name: string;
    description?: string;
    maxCapacity: number;
    members: IRoomMember[];
    createdAt: Date;
    updatedAt: Date;
}

const RoomSchema = new Schema<IRoom>(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, default: "" },
        maxCapacity: { type: Number, default: 10 },
        members: [
            {
                memberId: { type: String, required: true },
                memberType: { type: String, enum: ["user", "agent"], required: true },
                role: { type: String, enum: ["owner", "participant", "observer"], default: "participant" },
            },
        ],
    },
    { timestamps: true }
);

export const RoomModel = model<IRoom>("Room", RoomSchema);