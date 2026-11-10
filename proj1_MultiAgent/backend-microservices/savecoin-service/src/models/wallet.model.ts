import mongoose, { Document, Schema } from "mongoose";

/**
 * Interface dai dien cho Vi SaveCoin cua nguoi dung
 */
export interface IWallet extends Document {
    userId: string;
    userName: string;
    balance: number;
    totalEarned: number;
    totalSpent: number;
    updatedAt: Date;
}

/**
 * Mongoose Schema cho Wallet:
 * - Quan ly so du SaveCoin hien tai cua User
 * - Ghi nhan tong so coin kiem duoc (totalEarned) va tong chi tieu (totalSpent)
 */
const WalletSchema = new Schema<IWallet>(
    {
        userId: { type: String, required: true, unique: true, index: true },
        userName: { type: String, default: "User" },
        balance: { type: Number, default: 500 }, // Khoi tao mac dinh tang 500 Coin
        totalEarned: { type: Number, default: 500 },
        totalSpent: { type: Number, default: 0 },
    },
    { timestamps: true }
);

export const WalletModel = mongoose.model<IWallet>("Wallet", WalletSchema);
