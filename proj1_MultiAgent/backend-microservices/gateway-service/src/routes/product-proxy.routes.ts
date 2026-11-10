import { Router, Response } from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { gatewayAuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || "http://localhost:5004";

// Middleware kiểm tra auth cho các tác vụ mua/thuê/ví (yêu cầu đăng nhập), các API get products public có thể xem tự do
const checkProductAuth = (req: any, res: any, next: any) => {
    const fullPath = req.url.split("?")[0];
    // Xem danh sách sản phẩm agent là public
    if (fullPath.startsWith("/api/v1/products") && req.method === "GET") {
        return next();
    }
    // Mua, thuê, xem ví, kiểm tra inventory yêu cầu auth
    if (
        fullPath.startsWith("/api/v1/orders") ||
        fullPath.startsWith("/api/v1/wallet") ||
        fullPath.startsWith("/api/v1/inventory") ||
        fullPath.startsWith("/api/v1/products")
    ) {
        return gatewayAuthMiddleware(req, res, next);
    }
    next();
};

router.use(
    checkProductAuth,
    createProxyMiddleware({
        target: PRODUCT_SERVICE_URL,
        changeOrigin: true,
        pathFilter: (pathname) =>
            pathname.startsWith("/api/v1/products") ||
            pathname.startsWith("/api/v1/orders") ||
            pathname.startsWith("/api/v1/inventory") ||
            pathname.startsWith("/api/v1/wallet"),
        on: {
            proxyReq: (proxyReq, req: any) => {
                // Tự động inject userId và userName từ JWT vào Header để downstream service nhận diện
                if (req.user) {
                    proxyReq.setHeader("x-user-id", req.user.id || req.user._id || "");
                    proxyReq.setHeader("x-user-name", encodeURIComponent(req.user.name || ""));
                    proxyReq.setHeader("x-user-email", req.user.email || "");
                }
                fixRequestBody(proxyReq, req);
            },
            error: (err, req, res) => {
                console.error("[Gateway Proxy] Product Service error:", err);
                const expressRes = res as Response;
                if (expressRes && !expressRes.headersSent) {
                    expressRes.status(502).json({
                        success: false,
                        message: "Bad Gateway: Product Service (Marketplace) đang gặp sự cố hoặc chưa khởi động",
                    });
                }
            },
        },
    })
);

export default router;
