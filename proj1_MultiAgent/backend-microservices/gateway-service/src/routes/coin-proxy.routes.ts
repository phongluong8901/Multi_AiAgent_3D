import { Router, Response } from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";

const router = Router();
const SAVECOIN_SERVICE_URL = process.env.SAVECOIN_SERVICE_URL || "http://localhost:5006";
const COIN_PATHS = ["/api/v1/coins"];

router.use(
    createProxyMiddleware({
        target: SAVECOIN_SERVICE_URL,
        changeOrigin: true,
        pathFilter: (pathname) => COIN_PATHS.some((p) => pathname.startsWith(p)),
        on: {
            proxyReq: (proxyReq, req: any) => {
                const fullPath = req.url || "";
                console.log(`[Gateway Proxy] 🪙 Chuyển tiếp SaveCoin: ${req.method} ${fullPath} -> ${SAVECOIN_SERVICE_URL}`);
                fixRequestBody(proxyReq, req);
            },
            error: (err, req, res) => {
                console.error(`[Gateway Proxy] ❌ Lỗi kết nối xuống SaveCoin Service:`, err);
                const expressRes = res as Response;
                if (expressRes && !expressRes.headersSent) {
                    expressRes.status(502).json({ success: false, message: "Bad Gateway: SaveCoin Service đang gặp sự cố" });
                }
            },
        },
    })
);

export default router;
