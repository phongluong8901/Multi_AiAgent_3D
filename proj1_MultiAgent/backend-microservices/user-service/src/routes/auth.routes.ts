// src/routes/auth.routes.ts
import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { authLimiter } from "../middlewares/rateLimiter";
const router = Router();

// ─── Authentication Routes (Dùng asyncHandler để tự động bắt lỗi) ───────────────────
router.post("/register", authLimiter, authController.register);
router.post("/login", authLimiter, authController.login);
router.post("/google", authLimiter, authController.googleAuth);
router.post("/github", authLimiter, authController.githubAuth);
router.post("/verify-otp", authLimiter, authController.verifyOtp);
router.post("/resend-otp", authLimiter, authController.resendOtp);

router.post("/forgot-password", authLimiter, authController.forgotPassword);
router.post("/reset-password", authLimiter, authController.resetPassword);

// Các route không cần giới hạn tốc độ (rateLimiter) thì chỉ cần bọc asyncHandler là đủ:
router.post("/change-password", authController.changePassword);
router.post("/refresh-token", authController.refreshToken);
router.post("/logout", authController.logout);

export default router;