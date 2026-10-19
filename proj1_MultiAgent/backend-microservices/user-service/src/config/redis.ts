// src/config/redis.ts
import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redisClient = createClient({
    url: redisUrl,
});

redisClient.on("error", (err) => console.error("[Redis] Client Error:", err));

export const connectRedis = async () => {
    try {
        if (!redisClient.isOpen) {
            await redisClient.connect();
            console.log("[Redis] Connected successfully.");
        }
    } catch (error) {
        console.error("[Redis] Connection failed:", error);
    }
};