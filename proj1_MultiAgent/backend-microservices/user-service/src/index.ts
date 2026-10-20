// src/index.ts
import "./tracing"; // LUÔN PHẢI ĐẶT Ở DÒNG ĐẦU TIÊN

import dotenv from "dotenv";
import app from "./app";
import { connectDB } from "./config/db";
import { connectRabbitMQ } from "./config/rabbitmq"; // Import hàm kết nối RabbitMQ
import { startEmailWorker } from "./workers/email.worker"; // Import worker gửi email ngầm (nếu có)
import { connectRedis } from "./config/redis";
import { logger } from "./config/logger";

dotenv.config();

const PORT = process.env.PORT || 5001;

// Sử dụng Promise.all để khởi tạo đồng thời các kết nối cơ bản (MongoDB, RabbitMQ, Redis) trước khi bật server
Promise.all([
    connectDB(),       // Thực hiện kết nối tới MongoDB
    connectRabbitMQ(), // Thực hiện kết nối tới RabbitMQ
    connectRedis()     // Thực hiện kết nối tới Redis
]).then(() => {
    // Sau khi tất cả các kết nối hạ tầng thành công, khởi động Background Worker để lắng nghe và xử lý tin nhắn email từ RabbitMQ
    startEmailWorker();

    // Bắt đầu lắng nghe các yêu cầu HTTP từ client trên cổng đã định nghĩa
    app.listen(PORT, () => {
        console.log(`[user-service] Server is running on http://localhost:${PORT}`); // In thông báo server hoạt động thành công
        logger.info(`[user-service] Server is running on http://localhost:${PORT}`);
    });
}).catch((error) => {
    // Bắt lỗi toàn cục nếu có bất kỳ dịch vụ hạ tầng nào (DB, RabbitMQ, Redis) kết nối thất bại
    console.error("[user-service] Failed to start server due to connection error:", error);
    logger.error("[user-service] Failed to start server due to connection error:", error);
    process.exit(1); // Buộc dừng ứng dụng với mã lỗi 1 để ngăn chặn service chạy ở trạng thái thiếu kết nối
});