import mongoose from "mongoose";

export const connectDB = async (maxRetries = 15, delay = 2000): Promise<void> => {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/chats_db";
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await mongoose.connect(mongoUri);
            console.log("[chat-service] MongoDB Connected Successfully to chats_db!");

            // Đảm bảo 4 collections riêng biệt tồn tại ngay trên Atlas
            try {
                const db = mongoose.connection.db;
                if (db) {
                    const collections = await db.listCollections().toArray();
                    const names = collections.map((c) => c.name);
                    const requiredCols = ["chats", "chats_user_user", "chats_user_agent", "chats_agent_agent"];
                    for (const col of requiredCols) {
                        if (!names.includes(col)) {
                            await db.createCollection(col);
                            console.log(`[chat-service] Initialized collection '${col}' in chats_db`);
                        }
                    }

                    // Xóa hoàn toàn database 'test' cũ trên MongoDB Atlas
                    try {
                        const client = mongoose.connection.getClient();
                        const testDb = client.db("test");
                        await testDb.dropDatabase();
                        console.log("[chat-service] Dropped legacy 'test' database from MongoDB.");
                    } catch (_) {}
                }
            } catch (initErr: any) {
                console.warn("[chat-service] Collection init warning:", initErr.message);
            }

            return;
        } catch (error) {
            console.warn(`[chat-service] Waiting for MongoDB (${attempt}/${maxRetries})...`);
            if (attempt === maxRetries) {
                console.error("[chat-service] MongoDB Connection Failed after retries:", error);
                process.exit(1);
            }
            await new Promise((res) => setTimeout(res, delay));
        }
    }
};