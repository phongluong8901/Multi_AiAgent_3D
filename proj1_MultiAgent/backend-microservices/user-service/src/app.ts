// src/app.ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import userRoutes from "./routes/user.routes";
import authRoutes from "./routes/auth.routes";
import sellerRoutes from "./routes/seller.routes";
import adminRoutes from "./routes/admin.routes";
import crypto from "crypto";

import swaggerUi from "swagger-ui-express";
import { swaggerSpecs } from "./config/swagger";

import { metricsMiddleware } from "./middlewares/metrics.middleware";

// Polyfill đối tượng crypto toàn cục (globalThis)
if (!(globalThis as any).crypto) {
    (globalThis as any).crypto = crypto;
}

// Khởi tạo ứng dụng Express chính
const app = express();

// --- Middleware ---
app.use(metricsMiddleware); //tracing + metrics

app.use(cors({
    origin: true, // Hoặc cấu hình domain cụ thể của Gateway/Frontend
    credentials: true // Cho phép nhận cookie (refreshToken)
}));

app.use(express.json()); // Middleware phân tích dữ liệu đầu vào dạng JSON từ request body
app.use(cookieParser()); // Middleware phân tích cú pháp cookie gửi từ client lên server

// --- Routes ---
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/seller", sellerRoutes);
app.use("/api/v1/admin", adminRoutes);

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