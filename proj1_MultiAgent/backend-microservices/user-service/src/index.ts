// src/index.ts
import dotenv from "dotenv";
import app from "./app";
import { connectDB } from "./config/db";
import { connectRabbitMQ } from "./config/rabbitmq"; // Import hàm kết nối RabbitMQ
import { startEmailWorker } from "./workers/email.worker"; // Import worker gửi email ngầm (nếu có)
import { connectRedis } from "./config/redis";

dotenv.config();

const PORT = process.env.PORT || 5001;

// Khởi tạo kết nối đồng thời MongoDB Atlas và RabbitMQ trước khi chạy server
Promise.all([
    connectDB(),
    connectRabbitMQ(),
    connectRedis()
]).then(() => {
    // Khởi động Background Worker lắng nghe RabbitMQ (nếu bạn dùng mô hình worker gửi email)
    startEmailWorker();

    app.listen(PORT, () => {
        console.log(`[user-service] Server is running on http://localhost:${PORT}`);
    });
}).catch((error) => {
    console.error("[user-service] Failed to start server due to connection error:", error);
    process.exit(1);
});