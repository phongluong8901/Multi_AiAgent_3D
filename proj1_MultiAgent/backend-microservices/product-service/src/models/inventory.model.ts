import { Schema, model, Document, Types } from "mongoose";

/**
 * Interface biểu diễn thực thể Kho đồ AI Agent (IInventory) của người dùng.
 * Phản ánh quyền sở hữu vĩnh viễn (owned) hoặc quyền thuê giới hạn thời gian (rented).
 */
export interface IInventory extends Document {
    userId: string;
    agentId: string;
    agentName: string;
    productId: Types.ObjectId;
    ownershipType: "owned" | "rented";
    rentExpiresAt?: Date | null; // null nếu là quyền sở hữu vĩnh viễn (owned)
    isActive: boolean;
    autoRenew: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Mongoose Schema cho bảng lưu trữ Kho đồ Agent.
 * Ràng buộc unique index trên cặp `(userId, agentId)` đảm bảo tính toàn vẹn dữ liệu.
 */
const InventorySchema = new Schema<IInventory>(
    {
        userId: { type: String, required: true, index: true },
        agentId: { type: String, required: true, index: true },
        agentName: { type: String, required: true },
        productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
        ownershipType: { type: String, enum: ["owned", "rented"], required: true },
        rentExpiresAt: { type: Date, default: null },
        isActive: { type: Boolean, default: true },
        autoRenew: { type: Boolean, default: false },
    },
    { timestamps: true }
);

// Một user chỉ có 1 bản ghi inventory cho 1 agentId
InventorySchema.index({ userId: 1, agentId: 1 }, { unique: true });

export const InventoryModel = model<IInventory>("Inventory", InventorySchema);
