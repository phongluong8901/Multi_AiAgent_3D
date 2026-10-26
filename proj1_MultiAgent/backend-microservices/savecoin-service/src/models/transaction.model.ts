import mongoose, { Document, Schema } from "mongoose";

export type TransactionType = "reward" | "task_claim" | "spend" | "faucet" | "map_draw";

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
