import { Schema, model, Document } from "mongoose";

export interface ITransaction {
    amount: number;
    type: "deposit" | "purchase" | "rental" | "refund";
    description: string;
    createdAt: Date;
}

export interface IWallet extends Document {
    userId: string;
    balance: number;
    transactions: ITransaction[];
    createdAt: Date;
    updatedAt: Date;
}

const WalletSchema = new Schema<IWallet>(
    {
        userId: { type: String, required: true, unique: true, index: true },
        balance: { type: Number, required: true, default: 1000 }, // Tặng sẵn 1000 Coin trải nghiệm
        transactions: [
            {
                amount: { type: Number, required: true },
                type: { type: String, enum: ["deposit", "purchase", "rental", "refund"], required: true },
                description: { type: String, default: "" },
                createdAt: { type: Date, default: Date.now },
            },
        ],
    },
    { timestamps: true }
);

export const WalletModel = model<IWallet>("Wallet", WalletSchema);
