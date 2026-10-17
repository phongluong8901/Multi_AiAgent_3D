import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware chung cho Gateway
app.use(cors());

// Kiểm tra sức khỏe Gateway
app.get("/", (req, res) => {
    res.status(200).json({ message: "API Gateway is running smoothly!" });
});

// --- ROUTING / PROXY CONFIGURATION ---

// 1. User Service Proxy (/api/v1/users/**)
app.use(
    createProxyMiddleware({
        target: process.env.USER_SERVICE_URL || "http://localhost:5001",
        changeOrigin: true,
        pathFilter: (pathname) => pathname.startsWith("/api/v1/users"),
        on: { proxyReq: fixRequestBody },
    })
);

// 2. Room Service Proxy (/api/v1/rooms/**)
app.use(
    createProxyMiddleware({
        target: process.env.ROOM_SERVICE_URL || "http://localhost:5002",
        changeOrigin: true,
        pathFilter: (pathname) => pathname.startsWith("/api/v1/rooms"),
        on: { proxyReq: fixRequestBody },
    })
);

// 3. Chat Service REST API Proxy (/api/v1/chats/**)
app.use(
    createProxyMiddleware({
        target: process.env.CHAT_SERVICE_URL || "http://localhost:5003",
        changeOrigin: true,
        pathFilter: (pathname) => pathname.startsWith("/api/v1/chats"),
        on: { proxyReq: fixRequestBody },
    })
);

// 4. Chat Service Real-time WebSocket Proxy (/socket.io)
app.use(
    createProxyMiddleware({
        target: process.env.CHAT_SERVICE_URL || "http://localhost:5003",
        changeOrigin: true,
        ws: true,
        pathFilter: (pathname) => pathname.startsWith("/socket.io"),
    })
);

// 5. Models Endpoint for Frontend Hub
app.get("/api/v1/models", (req, res) => {
    res.status(200).json([
        { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "Google AI", description: "Default fast reasoning engine" },
        { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", description: "Advanced multi-agent reasoning" },
        { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet", provider: "Anthropic", description: "Analytical & code execution" },
        { id: "local-ollama", name: "Local LLM", provider: "Ollama / vLLM", description: "On-premise private inference" }
    ]);
});

// 6. Agent Service Proxy (FastAPI: /api/v1/agents, /api/v1/prompts, /api/v1/tools, /api/v1/memory, /api/v1/executors, docs)
app.use(
    createProxyMiddleware({
        target: process.env.AGENT_SERVICE_URL || "http://localhost:8000",
        changeOrigin: true,
        pathFilter: (pathname) =>
            pathname.startsWith("/api/v1/agents") ||
            pathname.startsWith("/api/v1/prompts") ||
            pathname.startsWith("/api/v1/tools") ||
            pathname.startsWith("/api/v1/memory") ||
            pathname.startsWith("/api/v1/executors") ||
            pathname.startsWith("/docs") ||
            pathname.startsWith("/openapi.json"),
        on: { proxyReq: fixRequestBody },
    })
);

// Khởi chạy Gateway Server
app.listen(PORT, () => {
    console.log(`[api-gateway] Gateway is running on http://localhost:${PORT}`);
});