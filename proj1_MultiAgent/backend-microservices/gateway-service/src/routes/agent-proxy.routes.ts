import { Router, Response } from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { gatewayAuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();
const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8000";
const AGENT_PATHS = ["/api/v1/agents", "/api/v1/prompts", "/api/v1/tools", "/api/v1/memory", "/api/v1/executors", "/api/v1/lab"];

// Kiểm tra xác thực JWT cho các đường dẫn thuộc Agent Service
const checkAgentAuth = (req: any, res: any, next: any) => {
    if (AGENT_PATHS.some((p) => req.url.startsWith(p))) {
        return gatewayAuthMiddleware(req, res, next);
    }
    next();
};

// Định tuyến Proxy chuyển tiếp các yêu cầu quản lý Agent, Prompt, Tool, Memory và Lab xuống Agent Service.
// Cấu hình timeout dài (180s) và tắt bộ đệm cho luồng SSE streaming của LLM / LangGraph.
router.use(
    checkAgentAuth,
    createProxyMiddleware({
        target: AGENT_SERVICE_URL,
        changeOrigin: true,
        proxyTimeout: 180000,
        timeout: 180000,
        pathFilter: (pathname) => AGENT_PATHS.some((p) => pathname.startsWith(p)),
        on: {
            proxyReq: (proxyReq, req: any) => {
                const fullPath = req.url || "";
                console.log(`[INFO] [Gateway Proxy] Chuyển tiếp Agent: ${req.method} ${fullPath} -> ${AGENT_SERVICE_URL}`);
                fixRequestBody(proxyReq, req);
            },
            proxyRes: (proxyRes) => {
                if (proxyRes.headers["content-type"]?.includes("text/event-stream")) {
                    proxyRes.headers["cache-control"] = "no-cache, no-transform";
                    proxyRes.headers["x-accel-buffering"] = "no";
                }
            },
            error: (err, req, res) => {
                console.error(`[ERROR] [Gateway Proxy] Lỗi kết nối xuống Agent Service:`, err);
                const expressRes = res as Response;
                if (expressRes && !expressRes.headersSent) {
                    expressRes.status(502).json({ success: false, message: "Bad Gateway: Agent Service đang gặp sự cố" });
                }
            },
        },
    })
);

export default router;
