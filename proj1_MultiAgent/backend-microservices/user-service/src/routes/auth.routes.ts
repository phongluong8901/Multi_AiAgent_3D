// src/routes/auth.routes.ts
import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { authLimiter } from "../middlewares/rateLimiter";
import { asyncHandler } from "../middlewares/async.middleware"; // 1. Import asyncHandler vào đây

const router = Router();

// ─── Authentication Routes (Dùng asyncHandler để tự động bắt lỗi) ───────────────────
router.post("/register", authLimiter, asyncHandler(authController.register));
router.post("/login", authLimiter, asyncHandler(authController.login));
router.post("/google", authLimiter, asyncHandler(authController.googleAuth));
router.post("/github", authLimiter, asyncHandler(authController.githubAuth));
router.post("/verify-otp", authLimiter, asyncHandler(authController.verifyOtp));
router.post("/resend-otp", authLimiter, asyncHandler(authController.resendOtp));

router.post("/forgot-password", authLimiter, asyncHandler(authController.forgotPassword));
router.post("/reset-password", authLimiter, asyncHandler(authController.resetPassword));

// Các route không cần giới hạn tốc độ (rateLimiter) thì chỉ cần bọc asyncHandler là đủ:
router.post("/change-password", asyncHandler(authController.changePassword));
router.post("/refresh-token", asyncHandler(authController.refreshToken));
router.post("/logout", asyncHandler(authController.logout));

export default router;