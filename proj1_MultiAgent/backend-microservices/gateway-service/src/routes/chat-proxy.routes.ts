import { Router, Response } from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { gatewayAuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();
const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || "http://localhost:5003";

// Chat REST API (Yêu cầu xác thực)
router.use(
    gatewayAuthMiddleware,
    createProxyMiddleware({
        target: CHAT_SERVICE_URL,
        changeOrigin: true,
        pathFilter: (pathname) => pathname.startsWith("/api/v1/chats"),
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

// Chat Real-time WebSocket Proxy (/socket.io)
router.use(
    createProxyMiddleware({
        target: CHAT_SERVICE_URL,
        changeOrigin: true,
        ws: true,
        pathFilter: (pathname) => pathname.startsWith("/socket.io"),
        on: {
            error: (err, req, res) => {
                console.error(`[Gateway Proxy] ❌ Lỗi kết nối WebSocket Chat Service:`, err);
            }
        }
    })
);

export default router;