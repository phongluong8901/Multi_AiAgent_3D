import { Router, Response } from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { gatewayAuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();
const ROOM_SERVICE_URL = process.env.ROOM_SERVICE_URL || "http://localhost:5002";

// Room service toàn bộ đều yêu cầu xác thực qua gateway
router.use(
    gatewayAuthMiddleware,
    createProxyMiddleware({
        target: ROOM_SERVICE_URL,
        changeOrigin: true,
        pathFilter: (pathname) => {
            return pathname.startsWith("/api/v1/rooms");
        },
        on: {
            proxyReq: (proxyReq, req: any) => {
                const fullPath = req.url || "";
                console.log(`[Gateway Proxy] 📥 Chuyển tiếp Room: ${req.method} ${fullPath} -> ${ROOM_SERVICE_URL}`);
                fixRequestBody(proxyReq, req);
            },
            error: (err, req, res) => {
                console.error(`[Gateway Proxy] ❌ Lỗi kết nối xuống Room Service:`, err);
                const expressRes = res as Response;
                if (expressRes && !expressRes.headersSent) {
                    expressRes.status(502).json({ success: false, message: "Bad Gateway: Room Service đang gặp sự cố" });
                }
            }
        },
    })
);

export default router;