import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db";
import chatRoutes from "./routes/chat.routes";
import { configureSocketChat } from "./sockets/chat.gateway";

import crypto from "crypto";
if (!(globalThis as any).crypto) {
    (globalThis as any).crypto = crypto;
}

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

const PORT = process.env.PORT || 5003;

// Middleware
app.use(cors());
app.use(express.json());

// REST Routes
app.use("/api/v1/chats", chatRoutes);

app.get("/", (req, res) => {
    res.status(200).json({ message: "Chat Service & Socket.IO Gateway is running smoothly!" });
});

// Configure Socket.IO
configureSocketChat(io);

// Start Server & Connect DB
connectDB().then(() => {
    server.listen(PORT, () => {
        console.log(`[chat-service] Server & Socket.IO running on http://localhost:${PORT}`);
    });
});