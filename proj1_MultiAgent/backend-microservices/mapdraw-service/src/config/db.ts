import mongoose from "mongoose";

/**
 * Khởi tạo kết nối cơ sở dữ liệu MongoDB cho MapDraw Service.
 * Quản lý lưu trữ thiết kế bản đồ 3D, tọa độ vật thể nội thất và Agent Body avatar.
 * Tự động thử lại kết nối sau mỗi 5 giây nếu cơ sở dữ liệu tạm thời chưa sẵn sàng.
 */
export async function connectDB(): Promise<void> {
    const uri = process.env.MONGO_URI || "mongodb://localhost:27017/mapdraw_db";
    try {
        await mongoose.connect(uri);
        console.log("[INFO] [mapdraw-service] Connected to MongoDB Atlas successfully");
    } catch (error) {
        console.error("[ERROR] [mapdraw-service] MongoDB connection error:", error);
        // Tự động thử lại sau 5s
        setTimeout(connectDB, 5000);
    }
}
