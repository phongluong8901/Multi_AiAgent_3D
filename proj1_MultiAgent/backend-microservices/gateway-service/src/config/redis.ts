import { createClient } from "redis";

export const redisClient = createClient({
    url: process.env.REDIS_URL || "redis://redis:6379",
});

redisClient.connect().catch((err) => console.error("[Redis] Connection Error:", err));