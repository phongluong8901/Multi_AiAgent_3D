import mongoose from "mongoose";

export const connectDB = async (maxRetries = 15, delay = 2000): Promise<void> => {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/rooms_db";
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await mongoose.connect(mongoUri);
            console.log("[room-service] MongoDB Connected Successfully to rooms_db!");

            // Đảm bảo 4 collections riêng biệt tồn tại ngay trên Atlas
            try {
                const db = mongoose.connection.db;
                if (db) {
                    const collections = await db.listCollections().toArray();
                    const names = collections.map((c) => c.name);
                    const requiredCols = ["rooms", "rooms_user_user", "rooms_user_agent", "rooms_agent_agent"];
                    for (const col of requiredCols) {
                        if (!names.includes(col)) {
                            await db.createCollection(col);
                            console.log(`[room-service] Initialized collection '${col}' in rooms_db`);
                        }
                    }
                }
            } catch (initErr: any) {
                console.warn("[room-service] Collection init warning:", initErr.message);
            }

            return;
        } catch (error) {
            console.warn(`[room-service] Waiting for MongoDB (${attempt}/${maxRetries})...`);
            if (attempt === maxRetries) {
                console.error("[room-service] MongoDB Connection Failed after retries:", error);
                process.exit(1);
            }
            await new Promise((res) => setTimeout(res, delay));
        }
    }
};