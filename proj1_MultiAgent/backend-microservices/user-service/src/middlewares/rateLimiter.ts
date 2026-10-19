import { Redis } from "ioredis";
import { RedisStore } from "rate-limit-redis";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

dotenv.config();

// Khởi tạo ioredis client (tự động queue lệnh, khắc phục hoàn toàn ClientClosedError)
const redisClient = new Redis(process.env.REDIS_URL || "redis://redis:6379");

redisClient.on("connect", () => {
    console.log("[Redis] Connected successfully with ioredis.");
});

redisClient.on("error", (err) => {
    console.error("[Redis] Connection Error:", err);
});

// 1. Auth Rate Limiter (Dùng cho Login, Register, v.v.)
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 5, // Tối đa 5 lần thử
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        // @ts-expect-error - ioredis type compatibility with rate-limit-redis
        sendCommand: (...args: string[]) => redisClient.call(...args),
    }),
    message: {
        success: false,
        message: "Quá nhiều lần thử, vui lòng thử lại sau 15 phút.",
    },
});

// 2. General Rate Limiter (Dùng cho các API thông thường)
export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 100, // Tối đa 100 request
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        // @ts-expect-error - ioredis type compatibility with rate-limit-redis
        sendCommand: (...args: string[]) => redisClient.call(...args),
    }),
    message: {
        success: false,
        message: "Quá nhiều yêu cầu, vui lòng chậm lại.",
    },
});