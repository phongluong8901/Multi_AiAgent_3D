import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { connectDB } from "./config/db";
import { connectRabbitMQ } from "./events/rabbitmq";
import { startRoomConsumers } from "./events/consumers";
import userUserRoomRoutes from "./routes/user-user.room.routes";
import agentAgentRoomRoutes from "./routes/agent-agent.room.routes";
import userAgentRoomRoutes from "./routes/user-agent.room.routes";
import { errorHandler } from "./middlewares/error.middleware";
import { initSocket } from "./config/socket";
import fs from "fs";
import path from "path";
import { swaggerSpecs } from "./config/swagger";
import swaggerUi from "swagger-ui-express";

import crypto from "crypto";
if (!(globalThis as any).crypto) {
    (globalThis as any).crypto = crypto;
}

// Kiểm tra xem có file .env thật không (dùng khi chạy local)
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log("◇ Loaded env from local .env file");
} else {
    // Nếu ở trên Docker (không có file .env), giữ nguyên biến do Docker Compose cung cấp
    dotenv.config();
}

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5002;

// Khởi tạo Socket.IO Server thông qua file config riêng
initSocket(server);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/v1/rooms/user-user", userUserRoomRoutes);
app.use("/api/v1/rooms/agent-agent", agentAgentRoomRoutes);
app.use("/api/v1/rooms/user-agent", userAgentRoomRoutes);

app.get("/", (req, res) => {
    res.status(200).json({ message: "Room Service is running smoothly!" });
});

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "room-service" });
});

// Đăng ký route hiển thị giao diện Swagger UI tại đường dẫn /docs
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

app.use(errorHandler);

// Start Server, Connect DB, Connect RabbitMQ
connectDB().then(async () => {
    try {
        await connectRabbitMQ();
        await startRoomConsumers();
    } catch (err: any) {
        console.warn("[room-service] RabbitMQ not available, continuing without it:", err.message);
    }

    // Dùng server.listen thay vì app.listen để Socket.io hoạt động chính xác trên cổng 5002
    server.listen(PORT, () => {
        console.log(`[room-service] Server is running on http://localhost:${PORT}`);
    });
});