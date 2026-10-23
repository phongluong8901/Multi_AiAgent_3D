import { Schema, model, Document, Types } from "mongoose";

export interface IOrder extends Document {
    userId: string;
    userName: string;
    productId: Types.ObjectId;
    agentId: string;
    agentName: string;
    orderType: "buy" | "rent";
    rentalDuration?: "hourly" | "daily" | "monthly";
    durationUnits?: number; // Số giờ/ngày/tháng
    amount: number;         // Tổng chi phí Coin
    status: "active" | "expired" | "completed" | "refunded";
    startDate: Date;
    endDate?: Date | null;  // null nếu mua đứt vĩnh viễn
    createdAt: Date;
    updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
    {
        userId: { type: String, required: true, index: true },
        userName: { type: String, required: true },
        productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
        agentId: { type: String, required: true, index: true },
        agentName: { type: String, required: true },
        orderType: { type: String, enum: ["buy", "rent"], required: true },
        rentalDuration: { type: String, enum: ["hourly", "daily", "monthly"] },
        durationUnits: { type: Number, default: 1 },
        amount: { type: Number, required: true },
        status: { type: String, enum: ["active", "expired", "completed", "refunded"], default: "active", index: true },
        startDate: { type: Date, default: Date.now },
        endDate: { type: Date, default: null },
    },
    { timestamps: true }
);

export const OrderModel = model<IOrder>("Order", OrderSchema);
