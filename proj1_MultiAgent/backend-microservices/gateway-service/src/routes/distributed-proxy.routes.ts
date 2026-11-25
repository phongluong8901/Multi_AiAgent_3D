import { Router, Response } from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";

const router = Router();
const DISTRIBUTED_SERVICE_URL = process.env.DISTRIBUTED_SERVICE_URL || "http://localhost:5010";
const DISTRIBUTED_PATHS = ["/api/v1/distributed", "/api/v1/api/v1/distributed"];

// Proxy chuyển tiếp HTTP, SSE và WebSocket xuống Distributed Service (Go).
export const distributedProxy = createProxyMiddleware({
    target: DISTRIBUTED_SERVICE_URL,
    changeOrigin: true,
    ws: true, // Hỗ trợ nâng cấp WebSocket /api/v1/distributed/ws
    proxyTimeout: 180000,
    timeout: 180000,
    pathFilter: (pathname) => DISTRIBUTED_PATHS.some((p) => pathname.startsWith(p)),
    pathRewrite: {
        "^/api/v1/api/v1/distributed": "/api/v1/distributed",
    },
    on: {
        proxyReq: (proxyReq, req: any) => {
            const fullPath = req.url || "";
            console.log(`[INFO] [Gateway Proxy] Chuyển tiếp Distributed: ${req.method} ${fullPath} -> ${DISTRIBUTED_SERVICE_URL}`);
            fixRequestBody(proxyReq, req);
        },
        proxyRes: (proxyRes) => {
            if (proxyRes.headers["content-type"]?.includes("text/event-stream")) {
                proxyRes.headers["cache-control"] = "no-cache, no-transform";
                proxyRes.headers["x-accel-buffering"] = "no";
            }
        },
        error: (err, req, res) => {
            console.error(`[ERROR] [Gateway Proxy] Lỗi kết nối xuống Distributed Service:`, err);
            const expressRes = res as Response;
            if (expressRes && !expressRes.headersSent) {
                expressRes.status(502).json({
                    success: false,
                    message: "Bad Gateway: Distributed Service (Go) đang gặp sự cố hoặc chưa khởi động",
                });
            }
        },
    },
});

router.use(distributedProxy);

export default router;
