import { Router, Response } from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { gatewayAuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();
const ROOM_SERVICE_URL = process.env.ROOM_SERVICE_URL || "http://localhost:5002";

// 1. ROUTE SOCKET.IO: Xử lý chuẩn cả HTTP Handshake và WebSocket Upgrade
// Không gắn prefix "/api/v1/rooms/socket.io" vào router.use để tránh bị Express cắt mất đường dẫn
router.use(
    createProxyMiddleware({
        target: ROOM_SERVICE_URL,
        changeOrigin: true,
        ws: true, // Bật WebSocket proxy
        pathFilter: (pathname) => pathname.startsWith("/api/v1/rooms/socket.io"),
        on: {
            error: (err, req, res) => {
                console.error(`[Gateway WS Proxy] ❌ Lỗi WebSocket/Socket.IO Room Service:`, err);
                if (res && 'writeHead' in res && !res.headersSent) {
                    (res as Response).status(502).json({
                        success: false,
                        message: "Bad Gateway: Room Service Socket không phản hồi"
                    });
                }
            }
        }
    })
);

// Middleware kiểm tra auth cho các REST API thông thường của Room Service (bỏ qua socket.io)
const checkRoomAuth = (req: any, res: any, next: any) => {
    const fullPath = req.url.split("?")[0];
    if (fullPath.startsWith("/api/v1/rooms/socket.io")) {
        return next();
    }
    if (fullPath.startsWith("/api/v1/rooms")) {
        return gatewayAuthMiddleware(req, res, next);
    }
    next();
};

// 2. ROUTE REST API THÔNG THƯỜNG: VẪN GIỮ AUTH MIDDLEWARE
router.use(
    checkRoomAuth,
    createProxyMiddleware({
        target: ROOM_SERVICE_URL,
        changeOrigin: true,
        pathFilter: (pathname) => pathname.startsWith("/api/v1/rooms") && !pathname.startsWith("/api/v1/rooms/socket.io"),
        on: {
            proxyReq: (proxyReq, req: any) => {
                fixRequestBody(proxyReq, req);
            },
            error: (err, req, res) => {
                const expressRes = res as Response;
                if (expressRes && !expressRes.headersSent) {
                    expressRes.status(502).json({ success: false, message: "Bad Gateway: Room Service đang gặp sự cố" });
                }
            }
        },
    })
);

export default router;