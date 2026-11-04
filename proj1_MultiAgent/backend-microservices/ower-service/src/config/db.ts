import mongoose from "mongoose";
import { logger } from "./logger";

export const connectDB = async (maxRetries = 10, delay = 2000): Promise<void> => {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/owner_db";

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await mongoose.connect(mongoUri, {
                serverSelectionTimeoutMS: 5000,
            });
            logger.info("MongoDB Connected Successfully to owner_db!");

            try {
                const db = mongoose.connection.db;
                if (db) {
                    const collections = await db.listCollections().toArray();
                    const names = collections.map((c) => c.name);
                    if (!names.includes("rental_sessions")) {
                        await db.createCollection("rental_sessions");
                        logger.info("Initialized collection 'rental_sessions' in owner_db");
                    } else {
                        // Tự động dọn dẹp các session thuê mẫu ảo cũ
                        const dummyNodeIds = [
                            "node_seller_qwen_01",
                            "node_seller_deepseek_02",
                            "node_seller_llama_03",
                            "node-hanoi-cluster",
                            "node-saigon-worker",
                        ];
                        const cleanRes = await db.collection("rental_sessions").deleteMany({
                            $or: [
                                { sessionId: "rent_sess_init_01" },
                                { nodeId: { $in: dummyNodeIds } },
                            ],
                        });
                        if (cleanRes.deletedCount > 0) {
                            logger.info(`Cleaned up ${cleanRes.deletedCount} legacy dummy rental session(s).`);
                        }
                    }
                }
            } catch (initErr: any) {
                logger.warn("Collection init warning:", initErr.message);
            }

            return;
        } catch (error: any) {
            logger.warn(`Waiting for MongoDB (${attempt}/${maxRetries}): ${error.message}`);
            if (attempt === maxRetries) {
                logger.error("MongoDB Connection Failed after max retries. Running with resilient memory cache mode for development.");
                return;
            }
            await new Promise((res) => setTimeout(res, delay));
        }
    }
};
