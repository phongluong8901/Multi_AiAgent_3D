import { Router, Response } from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";

const router = Router();
const MAPDRAW_SERVICE_URL = process.env.MAPDRAW_SERVICE_URL || "http://localhost:5005";
const MAP_PATHS = ["/api/v1/maps"];

router.use(
    createProxyMiddleware({
        target: MAPDRAW_SERVICE_URL,
        changeOrigin: true,
        pathFilter: (pathname) => MAP_PATHS.some((p) => pathname.startsWith(p)),
        on: {
            proxyReq: (proxyReq, req: any) => {
                const fullPath = req.url || "";
                console.log(`[Gateway Proxy] 🗺️ Chuyển tiếp MapDraw: ${req.method} ${fullPath} -> ${MAPDRAW_SERVICE_URL}`);
                fixRequestBody(proxyReq, req);
            },
            error: (err, req, res) => {
                console.error(`[Gateway Proxy] ❌ Lỗi kết nối xuống MapDraw Service:`, err);
                const expressRes = res as Response;
                if (expressRes && !expressRes.headersSent) {
                    expressRes.status(502).json({ success: false, message: "Bad Gateway: MapDraw Service đang gặp sự cố" });
                }
            },
        },
    })
);

export default router;
