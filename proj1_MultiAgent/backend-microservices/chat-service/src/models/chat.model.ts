import { Schema, model, Document } from "mongoose";

export interface IChat extends Document {
    roomId: string;                 // ID phòng lấy từ room-service
    senderId: string;               // userId hoặc agentId
    senderType: "user" | "agent" | "system";
    senderName: string;
    message: string;
    metadata?: Record<string, any>; // Lưu thông tin phụ trợ (tool calls, state 3D,...)
    createdAt: Date;
}

const ChatSchema = new Schema<IChat>(
    {
        roomId: { type: String, required: true, index: true },
        senderId: { type: String, required: true },
        senderType: { type: String, enum: ["user", "agent", "system"], required: true },
        senderName: { type: String, required: true },
        message: { type: String, required: true },
        metadata: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

export const ChatModel = model<IChat>("Chat", ChatSchema);