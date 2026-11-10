// src/routes/user-proxy.routes.ts
import { Router, Response } from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { gatewayAuthMiddleware } from "../middlewares/auth.middleware";
import dns from "dns/promises";

const router = Router();
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://localhost:5001";

// Cache trạng thái phân giải hostname user-service để tránh lookup liên tục
let resolvedUserTarget: string | null = null;
async function resolveUserTarget(): Promise<string> {
    if (resolvedUserTarget) return resolvedUserTarget;
    if (USER_SERVICE_URL.includes("user-service")) {
        try {
            await dns.lookup("user-service");
            resolvedUserTarget = USER_SERVICE_URL;
        } catch {
            console.log("[Gateway Proxy] [INFO] Không tìm thấy hostname 'user-service', tự động fallback sang http://localhost:5001");
            resolvedUserTarget = "http://localhost:5001";
        }
    } else {
        resolvedUserTarget = USER_SERVICE_URL;
    }
    return resolvedUserTarget;
}

// Các đường dẫn public không cần token xác thực
const PUBLIC_PATHS = [
    "/api/v1/auth/register",
    "/api/v1/auth/login",
    "/api/v1/auth/google",
    "/api/v1/auth/github",
    "/api/v1/auth/huggingface",
    "/api/v1/auth/verify-otp",
    "/api/v1/auth/resend-otp",
    "/api/v1/auth/forgot-password",
    "/api/v1/auth/reset-password",
    "/api/v1/auth/refresh-token",
];

const USER_BASE_PATHS = [
    "/api/v1/auth",
    "/api/v1/users",
    "/api/v1/admin",
];

// Middleware kiểm tra xem request có phải là public path hay không
const checkAuthIfNeeded = (req: any, res: any, next: any) => {
    // Luôn cho phép preflight OPTIONS đi qua không cần kiểm tra token
    if (req.method === "OPTIONS") {
        return next();
    }

    const rawPath = (req.originalUrl || req.url || "").split("?")[0];
    const fullPath = rawPath.endsWith("/") && rawPath.length > 1 ? rawPath.slice(0, -1) : rawPath;

    // Nếu request không thuộc các route của User Service, bỏ qua để các route sau xử lý
    if (!USER_BASE_PATHS.some((p) => fullPath.startsWith(p))) {
        return next();
    }

    const isPublic = PUBLIC_PATHS.some((p) => {
        const cleanP = p.endsWith("/") && p.length > 1 ? p.slice(0, -1) : p;
        return cleanP === fullPath;
    });

    if (isPublic) {
        return next();
    }

    return gatewayAuthMiddleware(req, res, next);
};

// Áp dụng middleware check auth trước khi đi qua proxy
router.use(
    checkAuthIfNeeded,
    createProxyMiddleware({
        target: USER_SERVICE_URL,
        changeOrigin: true,
        router: async () => {
            return await resolveUserTarget();
        },
        pathFilter: (pathname) => {
            return (
                pathname.startsWith("/api/v1/auth") ||
                pathname.startsWith("/api/v1/users") ||
                pathname.startsWith("/api/v1/admin")
            );
        },
        on: {
            proxyReq: (proxyReq, req: any) => {
                const fullPath = req.url || "";
                console.log(`[Gateway Proxy] [DISPATCH] Chuyển tiếp: ${req.method} ${fullPath} -> ${resolvedUserTarget || USER_SERVICE_URL}`);
                fixRequestBody(proxyReq, req);
            },
            error: (err, req, res) => {
                console.error(`[Gateway Proxy] [ERROR] Lỗi kết nối xuống User Service:`, err);

                // Ép kiểu res về Response của Express để TypeScript nhận diện headersSent và status
                const expressRes = res as Response;
                if (expressRes && !expressRes.headersSent) {
                    expressRes.status(502).json({ success: false, message: "Bad Gateway: User Service đang gặp sự cố" });
                }
            }
        },
    })
);

export default router;
