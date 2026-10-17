import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db";
import userRoutes from "./routes/user.routes";
import profileRoutes from "./routes/profile.routes";

import crypto from "crypto";
if (!(globalThis as any).crypto) {
    (globalThis as any).crypto = crypto;
}

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/users", profileRoutes); // /me, /me/agents, /logout

// Root endpoint check
app.get("/", (req, res) => {
    res.status(200).json({ message: "User Service is running smoothly!" });
});

// Health check
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "user-service" });
});

// Start Server & Connect MongoDB
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`[user-service] Server is running on http://localhost:${PORT}`);
    });
});