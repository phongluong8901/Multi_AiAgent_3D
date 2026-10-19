import { Router } from "express";
import { userController } from "../controllers/user.controller";
import { authLimiter } from "../middlewares/rateLimiter";
import { upload } from "../middlewares/upload.middleware";

const router = Router();

// ─── Public routes (Và các endpoint OTP có gắn Rate Limiter) ───────────────────────
router.post("/register", authLimiter, (req, res) => userController.register(req, res));
router.post("/login", authLimiter, (req, res) => userController.login(req, res));
router.post("/google", authLimiter, (req, res) => userController.googleAuth(req, res));
router.post("/github", authLimiter, (req, res) => userController.githubAuth(req, res));
router.post("/verify-otp", authLimiter, (req, res) => userController.verifyOtp(req, res));
router.post("/resend-otp", authLimiter, (req, res) => userController.resendOtp(req, res));
router.get("/", (req, res) => userController.getUsers(req, res));

router.post("/forgot-password", authLimiter, (req, res) => userController.forgotPassword(req, res));
router.post("/reset-password", authLimiter, (req, res) => userController.resetPassword(req, res));
router.post("/refresh-token", (req, res) => userController.refreshToken(req, res));
router.post("/logout", (req, res) => userController.logout(req, res));

// ─── Protected Routes (Đã được API Gateway chặn và kiểm tra token từ ngoài) ───
// IMPORTANT: /me routes MUST be registered BEFORE /:id to avoid
// "me" being treated as an :id parameter
router.get("/me", (req, res) => userController.getMe(req as any, res));
router.put("/me", (req, res) => userController.updateMe(req as any, res));
router.put("/me/avatar", upload.single("avatar"), (req, res) => userController.updateAvatar(req as any, res));
router.post("/change-password", (req, res) => userController.changePassword(req as any, res));


// ─── Authenticated: Agent ownership ──────────────────────────
router.get("/me/agents", (req, res) => userController.getMyAgents(req as any, res));
router.post("/me/agents/:agentId", (req, res) => userController.addMyAgent(req as any, res));
router.delete("/me/agents/:agentId", (req, res) => userController.removeMyAgent(req as any, res));

// ─── Public: Get any user by id ───────────────────────────────
router.get("/:id", (req, res) => userController.getUserProfile(req, res));

export default router;