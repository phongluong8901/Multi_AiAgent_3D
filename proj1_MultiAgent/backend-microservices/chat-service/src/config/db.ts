import mongoose from "mongoose";

export const connectDB = async (maxRetries = 15, delay = 2000): Promise<void> => {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/chats_db";
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await mongoose.connect(mongoUri);
            console.log("[chat-service] MongoDB Connected Successfully!");
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