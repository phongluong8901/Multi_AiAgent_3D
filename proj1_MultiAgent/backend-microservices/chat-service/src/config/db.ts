import mongoose from "mongoose";

/**
 * Khoi tao ket noi co so du lieu MongoDB cho Chat Service:
 * - Vong lap thu ket noi toi da `maxRetries` lan neu database chua khoi dong xong
 * - Tu dong khoi tao 4 collection rieng biet de luu lich su tin nhan:
 *   + `chats`: Bang chat tong hop
 *   + `chats_user_user`: Kenh trao doi truc tiep giua nguoi dung
 *   + `chats_user_agent`: Kenh hoi dap nguoi dung - AI Agent
 *   + `chats_agent_agent`: Kenh phoi hop quy trinh giua cac Agent voi nhau
 * - Tu dong don dep co so du lieu 'test' cu
 * 
 * @param maxRetries So lan thu lai toi da
 * @param delay Khoang thoi gian cho giua cac lan thu (ms)
 */
export const connectDB = async (maxRetries = 15, delay = 2000): Promise<void> => {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/chats_db";
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await mongoose.connect(mongoUri);
            console.log("[chat-service] [INFO] MongoDB Connected Successfully to chats_db!");

            // Dam bao 4 collections rieng biet ton tai ngay tren Atlas
            try {
                const db = mongoose.connection.db;
                if (db) {
                    const collections = await db.listCollections().toArray();
                    const names = collections.map((c) => c.name);
                    const requiredCols = ["chats", "chats_user_user", "chats_user_agent", "chats_agent_agent"];
                    for (const col of requiredCols) {
                        if (!names.includes(col)) {
                            await db.createCollection(col);
                            console.log(`[chat-service] [INFO] Initialized collection '${col}' in chats_db`);
                        }
                    }

                    // Xoa hoan toan database 'test' cu tren MongoDB Atlas
                    try {
                        const client = mongoose.connection.getClient();
                        const testDb = client.db("test");
                        await testDb.dropDatabase();
                        console.log("[chat-service] [INFO] Dropped legacy 'test' database from MongoDB.");
                    } catch (_) {}
                }
            } catch (initErr: any) {
                console.warn("[chat-service] [WARN] Collection init warning:", initErr.message);
            }

            return;
        } catch (error) {
            console.warn(`[chat-service] [WARN] Waiting for MongoDB (${attempt}/${maxRetries})...`);
            if (attempt === maxRetries) {
                console.error("[chat-service] [ERROR] MongoDB Connection Failed after retries:", error);
                process.exit(1);
            }
            await new Promise((res) => setTimeout(res, delay));
        }
    }
};
