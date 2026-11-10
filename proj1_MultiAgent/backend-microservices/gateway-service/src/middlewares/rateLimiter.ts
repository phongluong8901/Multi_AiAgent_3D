import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redisClient } from "../config/redis";

/**
 * Middleware giới hạn tốc độ yêu cầu (Rate Limiter) trên toàn cổng API Gateway.
 * 
 * Tính năng chính:
 * 1. Khung thời gian trượt (Sliding window): 15 phút.
 * 2. Ngưỡng tối đa: 10,000 yêu cầu / 15 phút trên mỗi địa chỉ IP (đáp ứng tốt nhu cầu real-time streaming, SSE và polling).
 * 3. Bộ lưu trữ phân tán: Redis (`rl:gateway:` key prefix) giúp đồng bộ hạn ngạch khi triển khai nhiều gateway instance.
 * 4. Chế độ Fail-Safe: `passOnStoreError: true` đảm bảo nếu Redis gặp sự cố hoặc gián đoạn mạng, request vẫn được chuyển tiếp an toàn mà không làm sập gateway.
 */
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Cửa sổ giới hạn 15 phút
    max: 10000, // Tối đa 10,000 requests mỗi 15 phút từ 1 IP
    standardHeaders: true, // Trả về RateLimit-* headers theo tiêu chuẩn IETF
    legacyHeaders: false, // Tắt các X-RateLimit-* headers cũ
    passOnStoreError: true, // Nếu Redis bị timeout hoặc ngắt kết nối, cho phép request đi qua không gây lỗi 500
    store: new RedisStore({
        /**
         * Hàm gửi lệnh Redis nguyên tử để tăng bộ đếm và đặt TTL cho IP.
         * @param args Các đối số lệnh gửi tới Redis server
         */
        sendCommand: async (...args: string[]) => {
            if (!redisClient.isOpen) {
                // Redis chưa sẵn sàng, ném lỗi để passOnStoreError bỏ qua an toàn
                throw new Error("Redis client is not ready");
            }
            return redisClient.sendCommand(args);
        },
        prefix: "rl:gateway:",
    }),
    message: {
        success: false,
        message: "Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau.",
    },
});