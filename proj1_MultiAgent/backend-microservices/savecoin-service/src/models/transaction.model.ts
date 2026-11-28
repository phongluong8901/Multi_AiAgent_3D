import mongoose, { Document, Schema } from "mongoose";

/**
 * Loai bien dong so du SaveCoin:
 * - reward: Thuong tu hoat dong ve ban do / tao agent
 * - task_claim: Thuong nhiem vu Plan Task
 * - spend: Chi tieu mua / thue agent
 * - faucet: Nhan coin thu nghiem tu voi nuoc
 * - map_draw: Thuong ve ban do 3D
 */
export type TransactionType = "reward" | "task_claim" | "spend" | "faucet" | "map_draw";

/**
 * Interface cho lich su giao dich Coin
 */
export interface ICoinTransaction extends Document {
    transactionId: string;
    userId: string;
    amount: number;
    type: TransactionType;
    reason: string;
    source: string;
    metadata?: Record<string, any>;
    createdAt: Date;
}

/**
 * Mongoose Schema cho Coin Transaction
 */
const CoinTransactionSchema = new Schema<ICoinTransaction>(
    {
        transactionId: { type: String, required: true, unique: true, index: true },
        userId: { type: String, required: true, index: true },
        amount: { type: Number, required: true },
        type: { type: String, required: true },
        reason: { type: String, required: true },
        source: { type: String, default: "system" },
        metadata: { type: Schema.Types.Mixed },
    },
    { timestamps: true }
);

export const CoinTransactionModel = mongoose.model<ICoinTransaction>("CoinTransaction", CoinTransactionSchema);
