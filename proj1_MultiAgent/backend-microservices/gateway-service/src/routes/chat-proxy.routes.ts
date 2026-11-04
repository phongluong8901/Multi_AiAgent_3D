// src/routes/chat-proxy.routes.ts
import { Router, Response } from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { gatewayAuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();
const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || "http://localhost:5003";

// 1. ROUTE SOCKET.IO: Xử lý chuẩn cả HTTP Handshake và WebSocket Upgrade cho Socket.IO
// Dùng path /api/v1/chats/socket.io để phân biệt với room-service (/api/v1/rooms/socket.io)
router.use(
    createProxyMiddleware({
        target: CHAT_SERVICE_URL,
        changeOrigin: true,
        ws: true, // Bật WebSocket proxy
        pathFilter: (pathname) => pathname.startsWith("/api/v1/chats/socket.io"),
        on: {
            error: (err, req, res) => {
                console.error(`[Gateway WS Proxy] ❌ Lỗi WebSocket/Socket.IO Chat Service:`, err);
                if (res && 'writeHead' in res && !res.headersSent) {
                    (res as Response).status(502).json({
                        success: false,
                        message: "Bad Gateway: Chat Service Socket không phản hồi"
                    });
                }
            }
        }
    })
);

// Middleware kiểm tra auth cho các REST API thông thường của Chat Service (bỏ qua /api/v1/chats/socket.io)
const checkChatAuth = (req: any, res: any, next: any) => {
    const fullPath = req.url.split("?")[0];
    if (fullPath.startsWith("/api/v1/chats/socket.io")) {
        return next();
    }
    if (fullPath.startsWith("/api/v1/chats")) {
        return gatewayAuthMiddleware(req, res, next);
    }
    next();
};

// 2. ROUTE REST API THÔNG THƯỜNG: VẪN GIỮ AUTH MIDDLEWARE
router.use(
    checkChatAuth,
    createProxyMiddleware({
        target: CHAT_SERVICE_URL,
        changeOrigin: true,
        pathFilter: (pathname) => pathname.startsWith("/api/v1/chats") && !pathname.startsWith("/api/v1/chats/socket.io"),
        on: {
            proxyReq: (proxyReq, req: any) => {
                const fullPath = req.url || "";
                console.log(`[Gateway Proxy] 📥 Chuyển tiếp Chat: ${req.method} ${fullPath} -> ${CHAT_SERVICE_URL}`);
                fixRequestBody(proxyReq, req);
            },
            error: (err, req, res) => {
                console.error(`[Gateway Proxy] ❌ Lỗi kết nối xuống Chat Service:`, err);
                const expressRes = res as Response;
                if (expressRes && !expressRes.headersSent) {
                    expressRes.status(502).json({ success: false, message: "Bad Gateway: Chat Service đang gặp sự cố" });
                }
            }
        },
    })
);

export default router;