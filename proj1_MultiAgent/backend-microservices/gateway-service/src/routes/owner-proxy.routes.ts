import { Router, Response } from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";

const router = Router();
const OWER_SERVICE_URL = process.env.OWER_SERVICE_URL || "http://ower-service:5012";
const OWNER_PATHS = [
    "/api/v1/owner",
    "/api/v1/ower",
    "/api/v1/api/v1/owner",
    "/api/v1/api/v1/ower",
];

router.use(
    createProxyMiddleware({
        target: OWER_SERVICE_URL,
        changeOrigin: true,
        pathFilter: (pathname) => OWNER_PATHS.some((p) => pathname.startsWith(p)),
        pathRewrite: {
            "^/api/v1/api/v1/owner": "/api/v1/owner",
            "^/api/v1/api/v1/ower": "/api/v1/owner",
            "^/api/v1/ower": "/api/v1/owner",
        },
        on: {
            proxyReq: (proxyReq, req: any) => {
                const fullPath = req.url || "";
                console.log(`[Gateway Proxy] ⚡ Owner/Renter: ${req.method} ${fullPath} -> ${OWER_SERVICE_URL}`);
                fixRequestBody(proxyReq, req);
            },
            error: (err, req, res) => {
                console.error(`[Gateway Proxy] ❌ Lỗi kết nối xuống Owner/Ower Service:`, err);
                const expressRes = res as Response;
                if (expressRes && !expressRes.headersSent) {
                    expressRes.status(502).json({
                        success: false,
                        message: "Bad Gateway: Owner/Ower Service đang gặp sự cố hoặc chưa khởi động",
                    });
                }
            },
        },
    })
);

export default router;
