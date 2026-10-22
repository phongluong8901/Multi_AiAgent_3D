import { Schema, model, Document } from "mongoose";

// Định nghĩa cấu trúc cho file đính kèm (Ảnh hoặc Tài liệu/CSV/Excel)
export interface IChatAttachment {
    fileUrl: string;                                    // Đường dẫn Cloudinary URL công khai
    fileName: string;                                   // Tên file gốc (vd: dataset.csv, diagram.png)
    fileSize?: number;                                  // Dung lượng file (bytes)
    category: "image" | "document";                     // Phân loại: "image" (ảnh) hoặc "document" (csv, xlsx, pdf,...)
    extension: string;                                  // Phần mở rộng định dạng (vd: "png", "jpg", "csv", "xlsx")
}

export interface IChat extends Document {
    roomId: string;                                     // ID phòng lấy từ room-service
    typeChat: "team" | "direct" | "system" | "workflow"; // Phân loại luồng chat (nhóm, 1-1, hệ thống, tự động hóa)
    senderId: string;                                   // userId hoặc agentId
    senderType: "user" | "agent" | "system";
    senderName: string;
    message: string;
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
            enum: ["team", "direct", "system", "workflow"],
            default: "team",
            required: true,
            index: true
        },
        senderId: { type: String, required: true },
        senderType: { type: String, enum: ["user", "agent", "system"], required: true },
        senderName: { type: String, required: true },
        message: { type: String, required: true },
        attachments: { type: [ChatAttachmentSchema], default: [] }, // Thêm trường lưu ảnh và file đính kèm
        metadata: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

// Đánh Compound Index giúp tối ưu truy vấn lọc lịch sử theo phòng và loại chat cực nhanh
ChatSchema.index({ roomId: 1, typeChat: 1, createdAt: -1 });

export const ChatModel = model<IChat>("Chat", ChatSchema);