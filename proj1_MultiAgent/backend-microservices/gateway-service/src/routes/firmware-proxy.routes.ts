import { Router, Response } from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";

const router = Router();
const FIRMWARE_SERVICE_URL = process.env.FIRMWARE_SERVICE_URL || "http://localhost:5014";
const FIRMWARE_PATHS = ["/api/v1/firmware", "/api/v1/api/v1/firmware"];

router.use(
    createProxyMiddleware({
        target: FIRMWARE_SERVICE_URL,
        changeOrigin: true,
        ws: true, // Hỗ trợ nâng cấp WebSocket /api/v1/firmware/ws/:deviceId cho ESP32/ESP32-S3
        pathFilter: (pathname) => FIRMWARE_PATHS.some((p) => pathname.startsWith(p)),
        pathRewrite: {
            "^/api/v1/api/v1/firmware": "/api/v1/firmware",
        },
        on: {
            proxyReq: (proxyReq, req: any) => {
                const fullPath = req.url || "";
                console.log(`[Gateway Proxy] 🤖 Chuyển tiếp Firmware: ${req.method} ${fullPath} -> ${FIRMWARE_SERVICE_URL}`);
                fixRequestBody(proxyReq, req);
            },
            proxyRes: (proxyRes) => {
                // Giữ luồng SSE (Server-Sent Events) không bị buffer để ESP32/ESP32-S3 nhận token tức thì
                if (proxyRes.headers["content-type"]?.includes("text/event-stream")) {
                    proxyRes.headers["cache-control"] = "no-cache, no-transform";
                    proxyRes.headers["x-accel-buffering"] = "no";
                }
            },
            error: (err, req, res) => {
                console.error(`[Gateway Proxy] ❌ Lỗi kết nối xuống Agent-Firmware Service:`, err);
                const expressRes = res as Response;
                if (expressRes && !expressRes.headersSent) {
                    expressRes.status(502).json({
                        success: false,
                        message: "Bad Gateway: Agent-Firmware Service đang gặp sự cố hoặc chưa khởi động",
                    });
                }
            },
        },
    })
);

export default router;

