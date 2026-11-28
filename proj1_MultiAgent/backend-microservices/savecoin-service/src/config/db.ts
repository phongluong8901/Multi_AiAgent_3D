import mongoose from "mongoose";

/**
 * Khởi tạo kết nối cơ sở dữ liệu MongoDB cho SaveCoin Service.
 * Quản lý số dư ví, lịch sử biến động số dư và tiến độ nhiệm vụ Plan Tasks của người dùng.
 * Tự động thử lại kết nối sau mỗi 5 giây nếu cơ sở dữ liệu tạm thời chưa sẵn sàng.
 */
export async function connectDB(): Promise<void> {
    const uri = process.env.MONGO_URI || "mongodb://localhost:27017/savecoin_db";
    try {
        await mongoose.connect(uri);
        console.log("[INFO] [savecoin-service] Connected to MongoDB Atlas successfully");
    } catch (error) {
        console.error("[ERROR] [savecoin-service] MongoDB connection error:", error);
        // Tự động kết nối lại sau 5s
        setTimeout(connectDB, 5000);
    }
}
