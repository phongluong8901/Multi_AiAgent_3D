import mongoose from "mongoose";

/**
 * Khởi tạo kết nối cơ sở dữ liệu MongoDB cho Product Service.
 * Hỗ trợ tự động thử lại kết nối sau mỗi 5 giây nếu máy chủ MongoDB bị gián đoạn.
 */
export async function connectDB(): Promise<void> {
    const uri = process.env.MONGO_URI || "mongodb://localhost:27017/products_db";
    try {
        await mongoose.connect(uri);
        console.log("[INFO] [product-service] Connected to MongoDB Atlas successfully");
    } catch (error) {
        console.error("[ERROR] [product-service] MongoDB connection error:", error);
        // Tự động thử lại kết nối sau 5s
        setTimeout(connectDB, 5000);
    }
}
