import { Schema, model, Document } from "mongoose";

export interface IProduct extends Document {
    agentId: string;
    name: string;
    title: string;
    description: string;
    avatarUrl?: string;
    color: string;
    category: "AI Engineering" | "Research & Search" | "Data Analytics" | "Management" | "Content & Summary" | "DevOps & Cloud";
    pricing: {
        buyPrice: number;        // Giá mua đứt vĩnh viễn (Coin)
        rentHourlyRate: number;  // Giá thuê theo giờ (Coin/giờ)
        rentDailyRate: number;   // Giá thuê theo ngày (Coin/ngày)
        rentMonthlyRate: number; // Giá thuê theo tháng (Coin/tháng)
    };
    skills: string[];
    tools: string[];
    modelTier: string;
    rating: number;
    reviewsCount: number;
    totalRented: number;
    totalBought: number;
    isFeatured: boolean;
    isAvailableForRent: boolean;
    isAvailableForBuy: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
    {
        agentId: { type: String, required: true, unique: true, index: true },
        name: { type: String, required: true },
        title: { type: String, required: true },
        description: { type: String, required: true },
        avatarUrl: { type: String, default: "" },
        color: { type: String, default: "#3b82f6" },
        category: {
            type: String,
            required: true,
            enum: ["AI Engineering", "Research & Search", "Data Analytics", "Management", "Content & Summary", "DevOps & Cloud"],
            index: true
        },
        pricing: {
            buyPrice: { type: Number, required: true, default: 500 },
            rentHourlyRate: { type: Number, required: true, default: 10 },
            rentDailyRate: { type: Number, required: true, default: 50 },
            rentMonthlyRate: { type: Number, required: true, default: 800 },
        },
        skills: [{ type: String }],
        tools: [{ type: String }],
        modelTier: { type: String, default: "gemini-2.5-flash-lite" },
        rating: { type: Number, default: 5.0 },
        reviewsCount: { type: Number, default: 0 },
        totalRented: { type: Number, default: 0 },
        totalBought: { type: Number, default: 0 },
        isFeatured: { type: Boolean, default: false },
        isAvailableForRent: { type: Boolean, default: true },
        isAvailableForBuy: { type: Boolean, default: true },
    },
    { timestamps: true }
);

export const ProductModel = model<IProduct>("Product", ProductSchema);
