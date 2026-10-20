import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redisClient } from "../config/redis";

export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 10000, // Tối đa 100 requests mỗi 15 phút từ 1 IP
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
        prefix: "rl:gateway:",
    }),
    message: {
        success: false,
        message: "Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau.",
    },
});