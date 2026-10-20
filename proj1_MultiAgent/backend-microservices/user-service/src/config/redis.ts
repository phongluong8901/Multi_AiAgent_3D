// src/config/redis.ts
import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

// Khởi tạo và export đối tượng redisClient dùng chung cho toàn bộ ứng dụng
export const redisClient = createClient({
    url: redisUrl,
});

// Xử lý lỗi khi Redis gặp sự cố
redisClient.on("error", (err) => console.error("[Redis] Client Error:", err));

// Hàm kết nối tới Redis với cơ chế thử lại
export const connectRedis = async () => {
    try {
        if (!redisClient.isOpen) { // Kiểm tra xem Redis đã được kết nối hay chưa
            await redisClient.connect(); // Thực hiện kết nối tới Redis
            console.log("[Redis] Connected successfully.");
        }
    } catch (error) {
        console.error("[Redis] Connection failed:", error);
    }
};