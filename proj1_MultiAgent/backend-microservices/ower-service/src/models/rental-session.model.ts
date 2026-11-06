import { Schema, model, Document } from "mongoose";

/**
 * Interface mo ta phien thue may GPU/NPU cua Owner tu Seller tren Marketplace:
 * - sessionId: Ma phien thue duy nhat
 * - renterId: User ID cua nguoi thue (Owner)
 * - nodeId: Dinh danh may tinh phan cung cua Seller
 * - coinsPerHour: Chi phi thue tinh theo gio (SaveCoin)
 * - coinsPer1kTokens: Chi phi suy luan tinh tren 1000 tokens
 * - status: Trang thai phien (ACTIVE: dang hoat dong, COMPLETED: da hoan tat, CANCELLED: bi huy)
 * - totalTokensUsed: Tong tokens da su dung trong phien
 * - totalCoinsSpent: Tong SaveCoins da thanh toan
 */
export interface IRentalSession extends Document {
    sessionId: string;
    renterId: string;
    renterName: string;
    nodeId: string;
    nodeName: string;
    sellerId: string;
    modelKey: string;
    modelDisplayName: string;
    coinsPerHour: number;
    coinsPer1kTokens: number;
    startTime: Date;
    endTime?: Date;
    status: "ACTIVE" | "COMPLETED" | "CANCELLED";
    totalTokensUsed: number;
    totalCoinsSpent: number;
    assignedAgentId?: string;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Mongoose Schema cho RentalSession
 */
const RentalSessionSchema = new Schema<IRentalSession>(
    {
        sessionId: { type: String, required: true, unique: true, index: true },
        renterId: { type: String, required: true, index: true },
        renterName: { type: String, default: "Agent Renter" },
        nodeId: { type: String, required: true, index: true },
        nodeName: { type: String, required: true },
        sellerId: { type: String, required: true },
        modelKey: { type: String, required: true },
        modelDisplayName: { type: String, required: true },
        coinsPerHour: { type: Number, default: 30 },
        coinsPer1kTokens: { type: Number, default: 0.5 },
        startTime: { type: Date, default: Date.now },
        endTime: { type: Date },
        status: { type: String, enum: ["ACTIVE", "COMPLETED", "CANCELLED"], default: "ACTIVE", index: true },
        totalTokensUsed: { type: Number, default: 0 },
        totalCoinsSpent: { type: Number, default: 0 },
        assignedAgentId: { type: String, default: "" },
    },
    {
        timestamps: true,
    }
);

export const RentalSessionModel = model<IRentalSession>("RentalSession", RentalSessionSchema, "rental_sessions");
