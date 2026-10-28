import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redisClient } from "../config/redis";

export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 10000, // Tối đa 10000 requests mỗi 15 phút từ 1 IP
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: true, // Nếu Redis bị timeout hoặc ngắt kết nối, cho phép request đi qua không gây lỗi 500
    store: new RedisStore({
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