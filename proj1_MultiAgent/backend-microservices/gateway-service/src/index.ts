import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware chung cho Gateway
app.use(cors());

// --- GATEWAY AUTHENTICATION MIDDLEWARE ---
export interface GatewayRequest extends Request {
    user?: { userId: string; email: string; role: string };
}

const gatewayAuthMiddleware = (req: GatewayRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Unauthorized: Missing or invalid token format" });
    }

    const token = authHeader.split(" ")[1];
    try {
        const secret = process.env.JWT_SECRET || "fallback_secret";
        const decoded = jwt.verify(token, secret) as any;

        // Đính kèm thông tin user vào headers để forward sang Microservices bên trong
        req.headers["x-user-id"] = decoded.userId;
        req.headers["x-user-role"] = decoded.role;

        next();
    } catch (error) {
        return res.status(403).json({ success: false, message: "Forbidden: Token is invalid or expired" });
    }
};

// Kiểm tra sức khỏe Gateway
app.get("/", (req, res) => {
    res.status(200).json({ message: "API Gateway is running smoothly!" });
});

// --- ROUTING / PROXY CONFIGURATION ---

// ─── USER SERVICE PROXIES ───────────────────────────────────────
// 1. User Service - PUBLIC ROUTES (Không cần check token)
app.use(
    createProxyMiddleware({
        target: process.env.USER_SERVICE_URL || "http://localhost:5001",
        changeOrigin: true,
        pathFilter: (pathname) =>
            pathname === "/api/v1/users/register" ||
            pathname === "/api/v1/users/login" ||
            pathname === "/api/v1/users/google" ||
            pathname === "/api/v1/users/verify-otp" ||
            pathname === "/api/v1/users/resend-otp",
        on: { proxyReq: fixRequestBody },
    })
);

// 2. User Service - PROTECTED ROUTES (/api/v1/users/me và các nhánh con của nó)
app.use(
    (req, res, next) => {
        if (req.path.startsWith("/api/v1/users/me")) {
            return gatewayAuthMiddleware(req, res, next);
        }
        next();
    },
    createProxyMiddleware({
        target: process.env.USER_SERVICE_URL || "http://localhost:5001",
        changeOrigin: true,
        pathFilter: (pathname) => pathname.startsWith("/api/v1/users/me"),
        on: { proxyReq: fixRequestBody },
    })
);

// 3. User Service - Các route user chung còn lại
app.use(
    createProxyMiddleware({
        target: process.env.USER_SERVICE_URL || "http://localhost:5001",
        changeOrigin: true,
        pathFilter: (pathname) => pathname.startsWith("/api/v1/users"),
        on: { proxyReq: fixRequestBody },
    })
);

// 4. Room Service Proxy (/api/v1/rooms/**)
app.use(
    createProxyMiddleware({
        target: process.env.ROOM_SERVICE_URL || "http://localhost:5002",
        changeOrigin: true,
        pathFilter: (pathname) => pathname.startsWith("/api/v1/rooms"),
        on: { proxyReq: fixRequestBody },
    })
);

// 5. Chat Service REST API Proxy (/api/v1/chats/**)
app.use(
    createProxyMiddleware({
        target: process.env.CHAT_SERVICE_URL || "http://localhost:5003",
        changeOrigin: true,
        pathFilter: (pathname) => pathname.startsWith("/api/v1/chats"),
        on: { proxyReq: fixRequestBody },
    })
);

// 6. Chat Service Real-time WebSocket Proxy (/socket.io)
app.use(
    createProxyMiddleware({
        target: process.env.CHAT_SERVICE_URL || "http://localhost:5003",
        changeOrigin: true,
        ws: true,
        pathFilter: (pathname) => pathname.startsWith("/socket.io"),
    })
);

// 7. Models Endpoint for Frontend Hub
app.get("/api/v1/models", (req, res) => {
    res.status(200).json([
        { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "Google AI", description: "Default fast reasoning engine" },
        { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", description: "Advanced multi-agent reasoning" },
        { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet", provider: "Anthropic", description: "Analytical & code execution" },
        { id: "local-ollama", name: "Local LLM", provider: "Ollama / vLLM", description: "On-premise private inference" }
    ]);
});

// 8. Agent Service Proxy (FastAPI)
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