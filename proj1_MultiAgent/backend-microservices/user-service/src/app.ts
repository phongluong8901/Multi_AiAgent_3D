// src/app.ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import userRoutes from "./routes/user.routes";
import profileRoutes from "./routes/profile.routes";
import crypto from "crypto";

import swaggerUi from "swagger-ui-express";
import { swaggerSpecs } from "./config/swagger";

if (!(globalThis as any).crypto) {
    (globalThis as any).crypto = crypto;
}

const app = express();

// --- Middleware ---
app.use(cors({
    origin: true, // Hoặc cấu hình domain cụ thể của Gateway/Frontend
    credentials: true // Cho phép nhận cookie (refreshToken)
}));
app.use(express.json());
app.use(cookieParser());

// --- Routes ---
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/users", profileRoutes); // /me, /me/agents, /logout

// --- Swagger UI ---
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// --- Root & Health Check ---
app.get("/", (req, res) => {
    res.status(200).json({ message: "User Service is running smoothly!" });
});

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "user-service" });
});

export default app;