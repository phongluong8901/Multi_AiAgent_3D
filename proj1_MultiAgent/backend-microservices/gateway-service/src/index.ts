import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { globalLimiter } from "./middlewares/rateLimiter";

// Import các router proxy đã tách riêng
import userRouter from "./routes/user-proxy.routes";
import roomRouter from "./routes/room-proxy.routes";
import chatRouter from "./routes/chat-proxy.routes";
import agentRouter from "./routes/agent-proxy.routes";
import productRouter from "./routes/product-proxy.routes";
import mapRouter from "./routes/map-proxy.routes";
import coinRouter from "./routes/coin-proxy.routes";
import rlRouter from "./routes/rl-proxy.routes";
import distributedRouter from "./routes/distributed-proxy.routes";
import sellerRouter from "./routes/seller-proxy.routes";
import ownerRouter from "./routes/owner-proxy.routes";
import firmwareRouter from "./routes/firmware-proxy.routes";
import fs from "fs";
import path from "path";

// Kiểm tra xem có file .env thật không (dùng khi chạy local)
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log("◇ Loaded env from local .env file");
} else {
    // Nếu ở trên Docker (không có file .env), giữ nguyên biến do Docker Compose cung cấp
    dotenv.config();
}

import http from "http";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

// Middleware chung
app.use(
    cors({
        origin: (origin, callback) => {
            callback(null, true);
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "x-user-id", "x-device-id"],
    })
);

// Hỗ trợ popup Google OAuth & Cross-Origin-Opener-Policy
app.use((req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    next();
});

// Áp dụng Global Rate Limiter cho toàn cổng Gateway
app.use(globalLimiter);

// Health check endpoint
app.get("/", (req, res) => {
    res.status(200).json({ message: "API Gateway is running smoothly!" });
});

// Models Endpoint (Public - Danh sách LLM Models khả dụng cho hệ thống Multi-Agent, bao gồm cả Cloud Gemini & Gói Thuê Local LLM)
app.get("/api/v1/models", async (req, res) => {
    const baseModels = [
        { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", provider: "Google AI", description: "Mặc định - Cực nhanh, tiết kiệm token, phản hồi tức thì" },
        { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "Google AI", description: "Thông minh, hỗ trợ đa nhiệm, tool calling sâu và phân tích logic" },
        { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "Google AI", description: "Bản Flash thế hệ 2 cân bằng giữa tốc độ và độ chuẩn xác" },
        { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", provider: "Google AI", description: "Độ ổn định cao, dự phòng tin cậy cho các tác vụ nhóm" },
        { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "Google AI", description: "Mô hình suy luận lớn 1M tokens, tổng hợp báo cáo chuyên sâu" },
        { id: "qwen2.5-coder:1.5b", name: "Qwen 2.5 Coder (1.5B Local)", provider: "Local Ollama / Seller P2P", description: "Mô hình Local AI chuyên lập trình, định tuyến qua máy Seller đang thuê" },
        { id: "deepseek-r1:7b", name: "DeepSeek-R1 Distill (7B Local)", provider: "Local Ollama / Seller P2P", description: "Mô hình suy luận chuỗi tư duy (CoT) chạy trên GPU của đối tác Seller" },
    ];

    const ownerUrls = [
        process.env.OWER_SERVICE_URL || "http://ower-service:5012",
        "http://localhost:5012",
    ];

    for (const oUrl of ownerUrls) {
        try {
            const activeRes = await fetch(`${oUrl}/api/v1/owner/connections/active`, {
                signal: AbortSignal.timeout(1500),
            });
            if (activeRes.ok) {
                const data: any = await activeRes.json();
                const sessions: any[] = data?.sessions || [];
                const rentalModels = sessions.map((s) => ({
                    id: `rental:${s.sessionId}`,
                    name: `⚡ [Đang Thuê] ${s.modelDisplayName} (${s.nodeName})`,
                    provider: `Seller Node (${s.sessionId.slice(-6)})`,
                    description: `Phiên thuê P2P đang ACTIVE • Giá: ${s.coinsPer1kTokens || 0.5} Coins/1k tokens`,
                }));
                return res.status(200).json([...rentalModels, ...baseModels]);
            }
        } catch {
            // Bỏ qua nếu ower-service chưa khởi động
        }
    }

    res.status(200).json(baseModels);
});

// Gắn toàn bộ các modules route proxy vào app
app.use(userRouter);
app.use(roomRouter);
app.use(chatRouter);
app.use(agentRouter);
app.use(productRouter);
app.use(mapRouter);
app.use(coinRouter);
app.use(rlRouter);
app.use(distributedRouter);
app.use(sellerRouter);
app.use(ownerRouter);
app.use(firmwareRouter);

// Khởi chạy Gateway Server bằng http.Server để hỗ trợ trơn tru WebSocket & HTTP
server.listen(PORT, () => {
    console.log(`[api-gateway] Gateway is running on http://localhost:${PORT}`);
});