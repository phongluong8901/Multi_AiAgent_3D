import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db";
import { connectRabbitMQ } from "./events/rabbitmq";
import { startRoomConsumers } from "./events/consumers";
import userUserRoomRoutes from "./routes/user-user.room.routes";
import agentAgentRoomRoutes from "./routes/agent-agent.room.routes";
import userAgentRoomRoutes from "./routes/user-agent.room.routes";
import { errorHandler } from "./middlewares/error.middleware";
import { Server } from "socket.io";
import http from "http";

import crypto from "crypto";
if (!(globalThis as any).crypto) {
    (globalThis as any).crypto = crypto;
}

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5002;

// Khởi tạo Socket.IO Server
export const io = new Server(server, {
    cors: { origin: "*" }
});

io.on("connection", (socket) => {
    // Khi client gửi event 'identity' kèm theo userId của họ
    socket.on("identity", (userId: string) => {
        socket.join(userId); // Cho client gia nhập vào một room riêng mang tên chính userId đó
        console.log(`[Socket.IO] User ${userId} connected & joined personal room`);
    });
});

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

app.use(errorHandler);

// Start Server, Connect DB, Connect RabbitMQ
connectDB().then(async () => {
    try {
        await connectRabbitMQ();
        await startRoomConsumers();
    } catch (err: any) {
        console.warn("[room-service] RabbitMQ not available, continuing without it:", err.message);
    }

    app.listen(PORT, () => {
        console.log(`[room-service] Server is running on http://localhost:${PORT}`);
    });
});