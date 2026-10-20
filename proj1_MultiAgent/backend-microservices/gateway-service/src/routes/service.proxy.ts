import { Router } from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { gatewayAuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// 1. Models Endpoint (Public - Không cần token)
router.get("/api/v1/models", (req, res) => {
    res.status(200).json([
        { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "Google AI", description: "Default fast reasoning engine" },
        { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", description: "Advanced multi-agent reasoning" },
        { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet", provider: "Anthropic", description: "Analytical & code execution" },
        { id: "local-ollama", name: "Local LLM", provider: "Ollama / vLLM", description: "On-premise private inference" }
    ]);
});

// 2. Room Service Proxy (Yêu cầu đăng nhập)
router.use(
    "/api/v1/rooms",
    gatewayAuthMiddleware, // Chặn ngay tại cổng nếu không có token hợp lệ
    createProxyMiddleware({
        target: process.env.ROOM_SERVICE_URL || "http://localhost:5002",
        changeOrigin: true,
        on: { proxyReq: fixRequestBody },
    })
);

// 3. Chat Service REST API Proxy (Yêu cầu đăng nhập)
router.use(
    "/api/v1/chats",
    gatewayAuthMiddleware,
    createProxyMiddleware({
        target: process.env.CHAT_SERVICE_URL || "http://localhost:5003",
        changeOrigin: true,
        on: { proxyReq: fixRequestBody },
    })
);

// 4. Chat Service Real-time WebSocket Proxy (/socket.io)
// Lưu ý: WebSocket thường truyền token qua query params hoặc auth handshake, 
// nên nếu dùng ws proxy trực tiếp ta có thể bỏ qua gatewayAuthMiddleware ở đây và để Chat Service tự xử lý handshake token.
router.use(
    createProxyMiddleware({
        target: process.env.CHAT_SERVICE_URL || "http://localhost:5003",
        changeOrigin: true,
        ws: true,
        pathFilter: (pathname) => pathname.startsWith("/socket.io"),
    })
);

// 5. Agent Service Proxy - FastAPI (Yêu cầu đăng nhập)
const AGENT_PATHS = ["/api/v1/agents", "/api/v1/prompts", "/api/v1/tools", "/api/v1/memory", "/api/v1/executors"];

router.use(
    (req, res, next) => {
        if (AGENT_PATHS.some((p) => req.path.startsWith(p))) {
            return gatewayAuthMiddleware(req, res, next);
        }
        next();
    },
    createProxyMiddleware({
        target: process.env.AGENT_SERVICE_URL || "http://localhost:8000",
        changeOrigin: true,
        pathFilter: (pathname) => AGENT_PATHS.some((p) => pathname.startsWith(p)),
        on: { proxyReq: fixRequestBody },
    })
);

export default router;