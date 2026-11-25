import { createClient } from "redis";

/**
 * Khởi tạo client kết nối Redis phân tán cho API Gateway.
 * Dùng làm kho lưu trữ bộ đếm cho Rate Limiting, token blacklist và caching.
 * Hỗ trợ chiến lược tự động thử lại kết nối tăng dần (Exponential backoff retry) và thời gian chờ 5s.
 */
export const redisClient = createClient({
    url: process.env.REDIS_URL || "redis://redis:6379",
    socket: {
        /**
         * Hàm tính toán khoảng thời gian chờ giữa các lần thử kết nối lại Redis.
         * @param retries Số lần đã thử kết nối lại
         */
        reconnectStrategy: (retries: number) => {
            if (retries > 10) {
                return 5000;
            }
            return Math.min(retries * 500, 3000);
        },
        connectTimeout: 5000,
    },
});

// Lắng nghe sự kiện lỗi kết nối từ socket Redis
redisClient.on("error", (err) => {
    console.error("[ERROR] [Gateway Redis] Connection Error:", err?.message || err);
});

// Lắng nghe sự kiện kết nối thành công tới Redis broker
redisClient.on("connect", () => {
    console.log("[INFO] [Gateway Redis] Connected successfully to Redis.");
});

// Khởi chạy tiến trình kết nối bất đồng bộ tới Redis server
redisClient.connect().catch((err) => {
    console.error("[ERROR] [Gateway Redis] Initial Connection Error:", err?.message || err);
});