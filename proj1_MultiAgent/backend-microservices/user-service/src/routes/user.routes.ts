import { Router } from "express";
import { userController } from "../controllers/user.controller";

const router = Router();

// ─── Public routes (Và các endpoint OTP) ───────────────────────
router.post("/register", (req, res) => userController.register(req, res));
router.post("/login", (req, res) => userController.login(req, res));
router.post("/google", (req, res) => userController.googleAuth(req, res));
router.post("/verify-otp", (req, res) => userController.verifyOtp(req, res));
router.post("/resend-otp", (req, res) => userController.resendOtp(req, res));
router.get("/", (req, res) => userController.getUsers(req, res));

// ─── Protected Routes (Đã được API Gateway chặn và kiểm tra token từ ngoài) ───
// IMPORTANT: /me routes MUST be registered BEFORE /:id to avoid
// "me" being treated as an :id parameter
router.get("/me", (req, res) => userController.getMe(req as any, res));
router.put("/me", (req, res) => userController.updateMe(req as any, res));

// ─── Authenticated: Agent ownership ──────────────────────────
router.get("/me/agents", (req, res) => userController.getMyAgents(req as any, res));
router.post("/me/agents/:agentId", (req, res) => userController.addMyAgent(req as any, res));
router.delete("/me/agents/:agentId", (req, res) => userController.removeMyAgent(req as any, res));

// ─── Public: Get any user by id ───────────────────────────────
router.get("/:id", (req, res) => userController.getUserProfile(req, res));

export default router;