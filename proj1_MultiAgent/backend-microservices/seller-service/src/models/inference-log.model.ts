import { Schema, model, Document } from "mongoose";

/**
 * Interface biểu diễn thực thể Nhật ký suy luận AI (IInferenceLog).
 * Lưu trữ chi tiết từng prompt gửi tới Node, phản hồi đầu ra, số lượng token, độ trễ và chi phí thanh toán Coin.
 */
export interface IInferenceLog extends Document {
    taskId: string;
    nodeId: string;
    renterId: string;
    prompt: string;
    systemPrompt?: string;
    output: string;
    tokens: number;
    latencyMs: number;
    coinsBilled: number;
    status: "SUCCESS" | "FAILED";
    createdAt: Date;
}

/**
 * Mongoose Schema cho bảng `inference_logs`.
 */
const InferenceLogSchema = new Schema<IInferenceLog>(
    {
        taskId: { type: String, required: true, unique: true, index: true },
        nodeId: { type: String, required: true, index: true },
        renterId: { type: String, required: true, index: true },
        prompt: { type: String, required: true },
        systemPrompt: { type: String, default: "" },
        output: { type: String, default: "" },
        tokens: { type: Number, default: 0 },
        latencyMs: { type: Number, default: 0 },
        coinsBilled: { type: Number, default: 0 },
        status: { type: String, enum: ["SUCCESS", "FAILED"], default: "SUCCESS" },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

export const InferenceLogModel = model<IInferenceLog>("InferenceLog", InferenceLogSchema, "inference_logs");
