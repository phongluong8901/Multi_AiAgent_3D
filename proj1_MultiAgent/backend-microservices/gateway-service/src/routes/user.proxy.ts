import { Router } from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { gatewayAuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://localhost:5001";

const PUBLIC_PATHS = [
    "/api/v1/users/register",
    "/api/v1/users/login",
    "/api/v1/users/google",
    "/api/v1/users/github",
    "/api/v1/users/verify-otp",
    "/api/v1/users/resend-otp",
    "/api/v1/users/forgot-password",
    "/api/v1/users/reset-password",
];

// Dùng pathFilter thay vì mount path để Express không bị cắt mất chuỗi /api/v1/users
router.use(
    createProxyMiddleware({
        target: USER_SERVICE_URL,
        changeOrigin: true,
        pathFilter: (pathname) => pathname.startsWith("/api/v1/users"),
        on: {
            proxyReq: (proxyReq, req) => {
                const fullPath = req.url || "";
                console.log(`[Gateway Proxy Debug] 📥 Nhận request: ${req.method} ${fullPath}`);

                const isPublic = PUBLIC_PATHS.includes(fullPath);
                console.log(`[Gateway Proxy Debug] 🔓 Public Path Check: ${isPublic ? "YES" : "NO (Cần Auth)"}`);

                // Nếu không phải public path thì có thể chèn logic check auth ở đây hoặc qua middleware riêng
                console.log(`[Gateway Proxy Debug] ➡️ Đang chuyển tiếp chính xác sang: ${USER_SERVICE_URL}${fullPath}`);

                fixRequestBody(proxyReq, req);
            },
            error: (err, req, res) => {
                console.error(`[Gateway Proxy Debug] ❌ Lỗi Proxy kết nối xuống User Service:`, err);
            }
        },
    })
);

export default router;