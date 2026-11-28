import mongoose from "mongoose";

// Định nghĩa và export hàm bất đồng bộ connectDB thực hiện kết nối MongoDB với cơ chế thử lại (mặc định thử 15 lần, mỗi lần cách nhau 2 giây)
export const connectDB = async (maxRetries = 15, delay = 2000): Promise<void> => {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/users_db";

    // Vòng lặp thực hiện kết nối lại nhiều lần trong trường hợp cơ sở dữ liệu chưa sẵn sàng (ví dụ khi chạy Docker Compose)
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await mongoose.connect(mongoUri);
            console.log("[user-service] MongoDB Connected Successfully to users_db!");

            // Đảm bảo collection 'users' được tạo ngay trên Atlas
            try {
                const db = mongoose.connection.db;
                if (db) {
                    const collections = await db.listCollections().toArray();
                    const names = collections.map((c) => c.name);
                    if (!names.includes("users")) {
                        await db.createCollection("users");
                        console.log("[user-service] Initialized collection 'users' in users_db");
                    }
                }
            } catch (initErr: any) {
                console.warn("[user-service] Collection init warning:", initErr.message);
            }

            return;
        } catch (error) {
            console.warn(`[user-service] Waiting for MongoDB (${attempt}/${maxRetries})...`);
            if (attempt === maxRetries) {
                console.error("[user-service] MongoDB Connection Failed after retries:", error);
                process.exit(1); // Buộc dừng ứng dụng với mã lỗi 1 để container hoặc tiến trình biết có sự cố nghiêm trọng
            }
            // Đợi một khoảng thời gian (delay bằng mili-giây) trước khi thực hiện vòng lặp thử lại kết nối tiếp theo
            await new Promise((res) => setTimeout(res, delay));
        }
    }
};