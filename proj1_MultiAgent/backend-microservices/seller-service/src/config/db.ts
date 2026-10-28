import mongoose from "mongoose";
import { logger } from "./logger";

export const connectDB = async (maxRetries = 10, delay = 2000): Promise<void> => {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/seller_db";

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await mongoose.connect(mongoUri, {
                serverSelectionTimeoutMS: 5000,
            });
            logger.info("MongoDB Connected Successfully to seller_db!");

            // Đảm bảo collection khởi tạo
            try {
                const db = mongoose.connection.db;
                if (db) {
                    const collections = await db.listCollections().toArray();
                    const names = collections.map((c) => c.name);
                    if (!names.includes("seller_nodes")) {
                        await db.createCollection("seller_nodes");
                        logger.info("Initialized collection 'seller_nodes' in seller_db");
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
