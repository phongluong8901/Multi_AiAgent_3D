import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { globalLimiter } from "./middlewares/rateLimiter";

// Import các router proxy đã tách riêng
import userRouter from "./routes/user-proxy.routes";
import roomRouter from "./routes/room-proxy.routes";
import chatRouter from "./routes/chat-proxy.routes";
import agentRouter from "./routes/agent-proxy.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware chung
app.use(cors());

// Áp dụng Global Rate Limiter cho toàn cổng Gateway
app.use(globalLimiter);

// Health check endpoint
app.get("/", (req, res) => {
    res.status(200).json({ message: "API Gateway is running smoothly!" });
});

// Models Endpoint (Public - nếu Gateway giữ lại phần này)
app.get("/api/v1/models", (req, res) => {
    res.status(200).json([
        { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "Google AI", description: "Default fast reasoning engine" },
        { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", description: "Advanced multi-agent reasoning" },
        { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet", provider: "Anthropic", description: "Analytical & code execution" },
        { id: "local-ollama", name: "Local LLM", provider: "Ollama / vLLM", description: "On-premise private inference" }
    ]);
});

// Gắn toàn bộ các modules route proxy vào app
app.use(userRouter);
app.use(roomRouter);
app.use(chatRouter);
app.use(agentRouter);

// Khởi chạy Gateway Server
app.listen(PORT, () => {
    console.log(`[api-gateway] Gateway is running on http://localhost:${PORT}`);
});