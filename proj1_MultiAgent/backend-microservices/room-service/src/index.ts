import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { connectDB } from "./config/db";                     // Import hàm kết nối MongoDB
import { connectRabbitMQ } from "./events/rabbitmq";         // Import hàm kết nối RabbitMQ message broker
import { startRoomConsumers } from "./events/consumers";     // Import hàm chạy các RabbitMQ consumers lắng nghe sự kiện
import userUserRoomRoutes from "./routes/user-user.room.routes";   // Import các routes quản lý phòng User-User
import agentAgentRoomRoutes from "./routes/agent-agent.room.routes"; // Import các routes quản lý Agent-Agent
import userAgentRoomRoutes from "./routes/user-agent.room.routes";   // Import các routes quản lý User-Agent bindings
import { errorHandler } from "./middlewares/error.middleware"; // Import middleware xử lý lỗi tập trung toàn hệ thống
import { initSocket } from "./config/socket";                // Import hàm khởi tạo Socket.IO realtime server
import fs from "fs";
import path from "path";
import { swaggerSpecs } from "./config/swagger";             // Import cấu hình tài liệu API Swagger
import swaggerUi from "swagger-ui-express";                  // Import UI hiển thị tài liệu Swagger

import crypto from "crypto";
// Polyfill dự phòng cho đối tượng crypto toàn cục nếu môi trường NodeJS cũ chưa hỗ trợ sẵn
if (!(globalThis as any).crypto) {
    (globalThis as any).crypto = crypto;
}

// Kiểm tra xem có file .env thật ở local hay không (dùng khi chạy môi trường local)
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log("◇ Loaded env from local .env file");
} else {
    // Nếu chạy trên Docker (không có file .env độc lập), tự động load các biến môi trường do Docker Compose cung cấp
    dotenv.config();
}

const app = express();
const server = http.createServer(app); // Khởi tạo HTTP server từ Express app để có thể dùng chung với Socket.IO

const PORT = process.env.PORT || 5002; // Lấy cổng từ biến môi trường hoặc mặc định là 5002

// Khởi tạo Socket.IO Server thông qua cấu hình riêng biệt đã tách file
initSocket(server);

// --- CÁC MIDDLEWARE CƠ BẢN ---
app.use(cors());          // Cho phép chia sẻ tài nguyên chéo nguồn (CORS)
app.use(express.json());  // Parse dữ liệu đầu vào dạng JSON từ request body

// --- ĐĂNG KÝ CÁC ROUTE API ---
app.use("/api/v1/rooms/user-user", userUserRoomRoutes);
app.use("/api/v1/rooms/agent-agent", agentAgentRoomRoutes);
app.use("/api/v1/rooms/user-agent", userAgentRoomRoutes);

// Route kiểm tra trạng thái hoạt động cơ bản của dịch vụ
app.get("/", (req, res) => {
    res.status(200).json({ message: "Room Service is running smoothly!" });
});

// Route kiểm tra sức khỏe hệ thống (Health Check cho Docker / Kubernetes)
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "room-service" });
});

// Đăng ký route hiển thị giao diện tài liệu Swagger UI tại đường dẫn /docs
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// Đăng ký Middleware xử lý lỗi toàn cục (đặt cuối cùng sau các routes)
app.use(errorHandler);

// --- KHỞI ĐỘNG HỆ THỐNG: KẾT NỐI DB, RABBITMQ VÀ LẮNG NGHE CỔNG ---
connectDB().then(async () => {
    try {
        await connectRabbitMQ();      // Kết nối tới RabbitMQ message broker
        await startRoomConsumers();   // Khởi động các luồng consumer lắng nghe message hàng đợi
    } catch (err: any) {
        // Nếu RabbitMQ chưa sẵn sàng, hệ thống vẫn cho phép chạy tiếp mà không bị crash ứng dụng
        console.warn("[room-service] RabbitMQ not available, continuing without it:", err.message);
    }

    // Bắt buộc dùng `server.listen` (thay vì `app.listen`) để HTTP Server và Socket.IO cùng hoạt động chính xác trên cổng 5002
    server.listen(PORT, () => {
        console.log(`[room-service] Server is running on http://localhost:${PORT}`);
    });
});