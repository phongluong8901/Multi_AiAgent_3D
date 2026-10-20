// src/routes/auth.routes.ts
import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { authLimiter } from "../middlewares/rateLimiter";
import { requireAuth } from "../middlewares/auth.middleware"; // Import middleware xác thực

const router = Router();

// ─── 1. NHÓM PUBLIC ROUTES (Không cần token, ai cũng gọi được) ───────────────────
router.post("/register", authLimiter, authController.register);
router.post("/login", authLimiter, authController.login);
router.post("/google", authLimiter, authController.googleAuth);
router.post("/github", authLimiter, authController.githubAuth);
router.post("/verify-otp", authLimiter, authController.verifyOtp);
router.post("/resend-otp", authLimiter, authController.resendOtp);

router.post("/forgot-password", authLimiter, authController.forgotPassword);
router.post("/reset-password", authLimiter, authController.resetPassword);

// Refresh token thường dùng refreshToken nằm trong cookie hoặc body để cấp lại accessToken mới, 
// nên có thể giữ ở public hoặc xử lý riêng tùy cơ chế của bạn.
router.post("/refresh-token", authController.refreshToken);


// ─── 2. NHÓM PROTECTED ROUTES (Bắt buộc phải đăng nhập mới được gọi) ───────────
// Áp dụng middleware requireAuth cho toàn bộ các route khai báo bên dưới dòng này
router.use(requireAuth);

router.post("/change-password", authController.changePassword);
router.post("/logout", authController.logout);

export default router;