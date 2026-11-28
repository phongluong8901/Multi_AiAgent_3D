import { Schema, model, Document } from "mongoose";

/**
 * Cấu trúc tọa độ địa lý GeoJSON Point hỗ trợ tìm kiếm khoảng cách gần nhất theo chuẩn 2dsphere.
 */
export interface IGeoLocation {
    type: "Point";
    coordinates: [number, number]; // [Kinh độ - longitude, Vĩ độ - latitude]
}

/**
 * Interface biểu diễn thực thể Node tài nguyên phần cứng cho thuê (ISellerNode).
 * Lưu trữ cấu hình phần cứng CPU/RAM/GPU, mô hình AI đang host, bảng giá và tọa độ địa lý.
 */
export interface ISellerNode extends Document {
    nodeId: string;
    sellerId: string;
    sellerName: string;
    nodeName: string;
    cpuCores: number;
    ramGB: number;
    gpuName: string;
    vramGB: number;
    hostedModel: string;
    modelDisplayName: string;
    localEndpoint: string;
    coinsPerHour: number;
    coinsPer1kTokens: number;
    status: "ONLINE" | "BUSY" | "OFFLINE";
    locationName: string;
    location: IGeoLocation;
    distanceKm?: number;
    totalInferenceRequests: number;
    totalTokensServed: number;
    totalCoinsEarned: number;
    rating: number;
    lastPingAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Mongoose Schema cho bảng `seller_nodes`.
 * Tích hợp chỉ mục 2dsphere index trên trường `location` hỗ trợ tính toán khoảng cách km chính xác.
 */
const SellerNodeSchema = new Schema<ISellerNode>(
    {
        nodeId: { type: String, required: true, unique: true, index: true },
        sellerId: { type: String, required: true, index: true },
        sellerName: { type: String, default: "Anonymous Host" },
        nodeName: { type: String, required: true },
        cpuCores: { type: Number, default: 8 },
        ramGB: { type: Number, default: 16 },
        gpuName: { type: String, default: "NVIDIA GeForce RTX" },
        vramGB: { type: Number, default: 8 },
        hostedModel: { type: String, required: true },
        modelDisplayName: { type: String, required: true },
        localEndpoint: { type: String, default: "http://localhost:11434" },
        coinsPerHour: { type: Number, default: 30 },
        coinsPer1kTokens: { type: Number, default: 0.5 },
        status: { type: String, enum: ["ONLINE", "BUSY", "OFFLINE"], default: "ONLINE", index: true },
        locationName: { type: String, default: "Hà Nội, Việt Nam" },
        location: {
            type: {
                type: String,
                enum: ["Point"],
                default: "Point",
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
                default: [105.8544, 21.0285], // Hà Nội
            },
        },
        totalInferenceRequests: { type: Number, default: 0 },
        totalTokensServed: { type: Number, default: 0 },
        totalCoinsEarned: { type: Number, default: 0 },
        rating: { type: Number, default: 5.0 },
        lastPingAt: { type: Date, default: Date.now },
    },
    {
        timestamps: true,
    }
);

// Khởi tạo chỉ mục không gian địa lý phục vụ truy vấn $near / $geoWithin
SellerNodeSchema.index({ location: "2dsphere" });

export const SellerNodeModel = model<ISellerNode>("SellerNode", SellerNodeSchema, "seller_nodes");
