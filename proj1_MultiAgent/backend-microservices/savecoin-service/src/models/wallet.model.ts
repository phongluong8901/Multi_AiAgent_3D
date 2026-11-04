import mongoose, { Document, Schema } from "mongoose";

export interface IWallet extends Document {
    userId: string;
    userName: string;
    balance: number;
    totalEarned: number;
    totalSpent: number;
    updatedAt: Date;
}

const WalletSchema = new Schema<IWallet>(
    {
        userId: { type: String, required: true, unique: true, index: true },
        userName: { type: String, default: "User" },
        balance: { type: Number, default: 500 }, // Khởi nghiệp tặng 500 Coin
        totalEarned: { type: Number, default: 500 },
        totalSpent: { type: Number, default: 0 },
    },
    { timestamps: true }
);

export const WalletModel = mongoose.model<IWallet>("Wallet", WalletSchema);
