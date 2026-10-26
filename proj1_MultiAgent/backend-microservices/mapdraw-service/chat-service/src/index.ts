import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { connectDB } from "./config/db";
import { connectRabbitMQ } from "./events/rabbitmq";
import { startChatConsumers } from "./events/consumers";
import chatRoutes from "./routes/chat.routes";
import { initSocket } from "./config/socket";
import fs from "fs";
import path from "path";

import crypto from "crypto";
// Polyfill dự phòng cho đối tượng crypto toàn cục nếu môi trường NodeJS cũ chưa hỗ trợ sẵn
if (!(globalThis as any).crypto) {
    (globalThis as any).crypto = crypto;
}

// Kiểm tra và load file .env ở môi trường local
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log("◇ Loaded env from local .env file");
} else {
    // Nếu chạy trên Docker (không có file .env), lấy biến môi trường từ Docker Compose
    dotenv.config();
}

const app = express();
const server = http.createServer(app); // BẮT BUỘC: Tạo HTTP server từ Express để dùng chung với Socket.IO

const PORT = process.env.PORT || 5003; // Cổng chạy của chat-service (ví dụ: 5003)

// 1. Khởi tạo Socket.IO Server và gắn vào HTTP Server
const io = initSocket(server);

// Middleware cơ bản
app.use(cors());
app.use(express.json());

// Đăng ký các API Routes của Chat
app.use("/api/v1/chats", chatRoutes);

// Route kiểm tra sức khỏe hệ thống (Health Check cho Docker / Compose)
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "chat-service" });
});

app.get("/", (req, res) => {
    res.status(200).json({ message: "Chat Service is running smoothly with Socket.IO!" });
});

// 2. Khởi động hệ thống: Kết nối Database, RabbitMQ và lắng nghe cổng
connectDB().then(async () => {
    try {
        // Kết nối RabbitMQ và truyền instance `io` vào consumers để agent reply đẩy realtime xuống client qua Socket.IO
        await connectRabbitMQ();
        await startChatConsumers(io);
    } catch (err: any) {
        console.warn("[chat-service] RabbitMQ not available, continuing via HTTP fallback:", err.message);
    }

    // BẮT BUỘC: Dùng server.listen thay vì app.listen để Socket.IO hoạt động chính xác
    server.listen(PORT, () => {
        console.log(`[chat-service] Server & Socket.IO running on http://localhost:${PORT}`);
    });
});