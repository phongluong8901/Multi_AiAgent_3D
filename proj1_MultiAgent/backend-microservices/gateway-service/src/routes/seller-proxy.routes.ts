import { Router, Response } from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";

const router = Router();
const SELLER_SERVICE_URL = process.env.SELLER_SERVICE_URL || "http://seller-service:5011";
const SELLER_PATHS = ["/api/v1/seller", "/api/v1/api/v1/seller"];

router.use(
    createProxyMiddleware({
        target: SELLER_SERVICE_URL,
        changeOrigin: true,
        pathFilter: (pathname) => SELLER_PATHS.some((p) => pathname.startsWith(p)),
        pathRewrite: {
            "^/api/v1/api/v1/seller": "/api/v1/seller",
        },
        on: {
            proxyReq: (proxyReq, req: any) => {
                const fullPath = req.url || "";
                console.log(`[Gateway Proxy] ⚡ Seller: ${req.method} ${fullPath} -> ${SELLER_SERVICE_URL}`);
                fixRequestBody(proxyReq, req);
            },
            error: (err, req, res) => {
                console.error(`[Gateway Proxy] ❌ Lỗi kết nối xuống Seller Service:`, err);
                const expressRes = res as Response;
                if (expressRes && !expressRes.headersSent) {
                    expressRes.status(502).json({
                        success: false,
                        message: "Bad Gateway: Seller Service đang gặp sự cố hoặc chưa khởi động",
                    });
                }
            },
        },
    })
);

export default router;
