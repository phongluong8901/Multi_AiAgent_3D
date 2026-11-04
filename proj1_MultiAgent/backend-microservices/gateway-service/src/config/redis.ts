import { createClient } from "redis";

export const redisClient = createClient({
    url: process.env.REDIS_URL || "redis://redis:6379",
    socket: {
        reconnectStrategy: (retries) => {
            if (retries > 10) {
                return 5000;
            }
            return Math.min(retries * 500, 3000);
        },
        connectTimeout: 5000,
    },
});

redisClient.on("error", (err) => {
    console.error("[Gateway Redis] Connection Error:", err?.message || err);
});

redisClient.on("connect", () => {
    console.log("[Gateway Redis] Connected successfully to Redis.");
});

redisClient.connect().catch((err) => {
    console.error("[Gateway Redis] Initial Connection Error:", err?.message || err);
});