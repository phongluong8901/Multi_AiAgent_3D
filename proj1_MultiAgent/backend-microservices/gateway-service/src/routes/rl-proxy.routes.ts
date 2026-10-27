import { Router, Response } from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";

const router = Router();
const RL_SERVICE_URL = process.env.RL_SERVICE_URL || "http://localhost:5009";
const RL_PATHS = ["/api/v1/rl"];

router.use(
    createProxyMiddleware({
        target: RL_SERVICE_URL,
        changeOrigin: true,
        pathFilter: (pathname) => RL_PATHS.some((p) => pathname.startsWith(p)),
        on: {
            proxyReq: (proxyReq, req: any) => {
                const fullPath = req.url || "";
                console.log(`[Gateway Proxy] 🤖 Chuyển tiếp RL Train: ${req.method} ${fullPath} -> ${RL_SERVICE_URL}`);
                fixRequestBody(proxyReq, req);
            },
            error: (err, req, res) => {
                console.error(`[Gateway Proxy] ❌ Lỗi kết nối xuống RL Train Service:`, err);
                const expressRes = res as Response;
                if (expressRes && !expressRes.headersSent) {
                    expressRes.status(502).json({ success: false, message: "Bad Gateway: RL Train Service đang bảo trì hoặc chưa bật" });
                }
            }
        },
    })
);

export default router;
