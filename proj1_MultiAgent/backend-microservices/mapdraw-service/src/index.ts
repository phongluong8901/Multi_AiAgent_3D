import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db";
import mapRoutes from "./routes/map.routes";
import agentBodyRoutes from "./routes/agentBody.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5005;

app.use(cors());
app.use(express.json({ limit: "20mb" })); // Tăng limit vì dữ liệu bản đồ 3D nhiều item

// Health check
app.get("/", (req, res) => {
    res.status(200).json({
        service: "mapdraw-service",
        message: "3D Map Drawing & Spatial World Storage Microservice is active!",
        port: PORT,
        timestamp: new Date().toISOString(),
    });
});

// Gắn routes
app.use("/api/v1", mapRoutes);
app.use("/api/v1", agentBodyRoutes);

async function startServer() {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`[mapdraw-service] Running on http://localhost:${PORT}`);
    });
}

startServer().catch((err) => {
    console.error("[mapdraw-service] Fatal startup error:", err);
});
