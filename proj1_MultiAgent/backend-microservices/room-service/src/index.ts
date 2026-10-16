import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db";
import roomRoutes from "./routes/room.routes";

import crypto from "crypto";
if (!(globalThis as any).crypto) {
    (globalThis as any).crypto = crypto;
}

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5002;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/v1/rooms", roomRoutes);

app.get("/", (req, res) => {
    res.status(200).json({ message: "Room Service is running smoothly!" });
});

// Start Server & Connect DB
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`[room-service] Server is running on http://localhost:${PORT}`);
    });
});