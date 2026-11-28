import mongoose from "mongoose";

/**
 * Khoi tao ket noi MongoDB cho Room Service:
 * - Tu dong thu lai (retry loop) len toi `maxRetries` lan neu co so du lieu chua san sang
 * - Tu dong tao cac collection chuyen biet neu chua co:
 *   + `rooms`: Bang phong tong quat
 *   + `rooms_user_user`: Phong hoi thoai giua nguoi voi nguoi
 *   + `rooms_user_agent`: Phong hoi thoai nguoi voi AI Agent
 *   + `rooms_agent_agent`: Phong cong tac giua cac AI Agent voi nhau
 * 
 * @param maxRetries So lan thu ket noi toi da
 * @param delay Thoi gian cho giua moi lan thu (ms)
 */
export const connectDB = async (maxRetries = 15, delay = 2000): Promise<void> => {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/rooms_db";
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await mongoose.connect(mongoUri);
            console.log("[room-service] [INFO] MongoDB Connected Successfully to rooms_db!");

            // Dam bao 4 collections rieng biet ton tai ngay tren MongoDB
            try {
                const db = mongoose.connection.db;
                if (db) {
                    const collections = await db.listCollections().toArray();
                    const names = collections.map((c) => c.name);
                    const requiredCols = ["rooms", "rooms_user_user", "rooms_user_agent", "rooms_agent_agent"];
                    for (const col of requiredCols) {
                        if (!names.includes(col)) {
                            await db.createCollection(col);
                            console.log(`[room-service] [INFO] Initialized collection '${col}' in rooms_db`);
                        }
                    }
                }
            } catch (initErr: any) {
                console.warn("[room-service] [WARN] Collection init warning:", initErr.message);
            }

            return;
        } catch (error) {
            console.warn(`[room-service] [WARN] Waiting for MongoDB (${attempt}/${maxRetries})...`);
            if (attempt === maxRetries) {
                console.error("[room-service] [ERROR] MongoDB Connection Failed after retries:", error);
                process.exit(1);
            }
            await new Promise((res) => setTimeout(res, delay));
        }
    }
};
