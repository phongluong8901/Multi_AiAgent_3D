import { Schema, model, Document } from "mongoose";

// Định nghĩa cấu trúc cho file đính kèm (Ảnh hoặc Tài liệu/CSV/Excel)
export interface IChatAttachment {
    fileUrl: string;                                    // Đường dẫn Cloudinary URL công khai
    fileName: string;                                   // Tên file gốc (vd: dataset.csv, diagram.png)
    fileSize?: number;                                  // Dung lượng file (bytes)
    category: "image" | "document";                     // Phân loại: "image" (ảnh) hoặc "document" (csv, xlsx, pdf,...)
    extension: string;                                  // Phần mở rộng định dạng (vd: "png", "jpg", "csv", "xlsx")
}

export type ChatType = "team" | "direct" | "agent" | "system" | "workflow" | "meeting";

export interface IChat extends Document {
    roomId: string;                                     // ID phòng lấy từ room-service
    typeChat: ChatType;                                 // Phân loại luồng chat: team, direct (1-1), agent (user-agent), workflow (agent-agent), meeting, system
    senderId: string;                                   // userId hoặc agentId
    senderType: "user" | "agent" | "system";
    senderName: string;
    message: string;
    targetUserId?: string;                              // Dành cho chat direct (1 người với 1 người)
    targetAgentId?: string;                             // Dành cho chat với agent cụ thể (user-agent)
    attachments?: IChatAttachment[];                    // Danh sách file/ảnh đính kèm
    metadata?: Record<string, any>;                     // Lưu thông tin phụ trợ (tool calls, state 3D, workflowTrace,...)
    createdAt: Date;
}

// Sub-schema cho từng file đính kèm
const ChatAttachmentSchema = new Schema<IChatAttachment>({
    fileUrl: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number },
    category: { type: String, enum: ["image", "document"], required: true },
    extension: { type: String, required: true },
}, { _id: false });

const ChatSchema = new Schema<IChat>(
    {
        roomId: { type: String, required: true, index: true },
        typeChat: {
            type: String,
            enum: ["team", "direct", "agent", "system", "workflow", "meeting"],
            default: "team",
            required: true,
            index: true
        },
        senderId: { type: String, required: true, index: true },
        senderType: { type: String, enum: ["user", "agent", "system"], required: true },
        senderName: { type: String, required: true },
        message: { type: String, required: true },
        targetUserId: { type: String, index: true },
        targetAgentId: { type: String, index: true },
        attachments: { type: [ChatAttachmentSchema], default: [] }, // Thêm trường lưu ảnh và file đính kèm
        metadata: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

// Đánh Compound Index giúp tối ưu truy vấn lọc lịch sử theo phòng và loại chat cực nhanh
ChatSchema.index({ roomId: 1, typeChat: 1, createdAt: -1 });

// Model dùng chung mặc định
export const ChatModel = model<IChat>("Chat", ChatSchema, "chats");

// 1. Collection chuyên lưu tin nhắn giữa Người dùng với Người dùng (Toàn phòng & Chat 1-1 Direct)
export const UserUserChatModel = model<IChat>("UserUserChat", ChatSchema, "chats_user_user");

// 2. Collection chuyên lưu tin nhắn giữa Người dùng và AI Agent (Hỏi đáp, chỉ đạo, đính kèm file)
export const UserAgentChatModel = model<IChat>("UserAgentChat", ChatSchema, "chats_user_agent");

// 3. Collection chuyên lưu tin nhắn tự động giữa Agent với Agent (Pipeline, Multi-Agent Handoff, Họp bàn tròn)
export const AgentAgentChatModel = model<IChat>("AgentAgentChat", ChatSchema, "chats_agent_agent");

/**
 * Helper lấy Model/Collection phù hợp dựa theo loại tương tác (User-User, User-Agent, Agent-Agent)
 */
export function getChatModelByType(typeChat?: string): typeof ChatModel {
    if (!typeChat) return ChatModel;
    if (typeChat === "direct" || typeChat === "team") {
        return UserUserChatModel;
    }
    if (typeChat === "agent") {
        return UserAgentChatModel;
    }
    if (typeChat === "workflow" || typeChat === "meeting" || typeChat === "system") {
        return AgentAgentChatModel;
    }
    return ChatModel;
}