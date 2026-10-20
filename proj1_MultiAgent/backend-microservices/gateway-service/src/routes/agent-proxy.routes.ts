import { Router, Response } from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { gatewayAuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();
const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8000";
const AGENT_PATHS = ["/api/v1/agents", "/api/v1/prompts", "/api/v1/tools", "/api/v1/memory", "/api/v1/executors"];

const checkAgentAuth = (req: any, res: any, next: any) => {
    if (AGENT_PATHS.some((p) => req.url.startsWith(p))) {
        return gatewayAuthMiddleware(req, res, next);
    }
    next();
};

router.use(
    checkAgentAuth,
    createProxyMiddleware({
        target: AGENT_SERVICE_URL,
        changeOrigin: true,
        pathFilter: (pathname) => AGENT_PATHS.some((p) => pathname.startsWith(p)),
        on: {
            proxyReq: (proxyReq, req: any) => {
                const fullPath = req.url || "";
                console.log(`[Gateway Proxy] 📥 Chuyển tiếp Agent: ${req.method} ${fullPath} -> ${AGENT_SERVICE_URL}`);
                fixRequestBody(proxyReq, req);
            },
            error: (err, req, res) => {
                console.error(`[Gateway Proxy] ❌ Lỗi kết nối xuống Agent Service:`, err);
                const expressRes = res as Response;
                if (expressRes && !expressRes.headersSent) {
                    expressRes.status(502).json({ success: false, message: "Bad Gateway: Agent Service đang gặp sự cố" });
                }
            }
        },
    })
);

export default router;