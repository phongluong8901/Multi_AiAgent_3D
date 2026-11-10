import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db";
import mapRoutes from "./routes/map.routes";
import agentBodyRoutes from "./routes/agentBody.routes";

dotenv.config();

/**
 * Khởi tạo ứng dụng MapDraw Service.
 * Quản lý lưu trữ không gian bản đồ 3D Three.js và tùy biến hình thái Robot Agent Body.
 */
const app = express();
const PORT = process.env.PORT || 5005;

app.use(cors());
// Hỗ trợ kích thước tải trọng lớn (20MB) cho các cấu trúc mảng vật thể và mesh 3D phức tạp
app.use(express.json({ limit: "20mb" }));

// Health check endpoint
app.get("/", (req, res) => {
    res.status(200).json({
        service: "mapdraw-service",
        message: "3D Map Drawing & Spatial World Storage Microservice is active!",
        port: PORT,
        timestamp: new Date().toISOString(),
    });
});

// Gắn các API router bản đồ 3D và Agent Body
app.use("/api/v1", mapRoutes);
app.use("/api/v1", agentBodyRoutes);

/**
 * Khởi động server sau khi kết nối thành công MongoDB.
 */
async function startServer(): Promise<void> {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`[INFO] [mapdraw-service] Running on http://localhost:${PORT}`);
    });
}

startServer().catch((err) => {
    console.error("[ERROR] [mapdraw-service] Fatal startup error:", err);
});
