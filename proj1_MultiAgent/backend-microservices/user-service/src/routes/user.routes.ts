import { Router } from "express";
import { userController } from "../controllers/user.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// ─── Public routes ───────────────────────────────────────────
router.post("/register", (req, res) => userController.register(req, res));
router.post("/login", (req, res) => userController.login(req, res));
router.get("/", (req, res) => userController.getUsers(req, res));

// ─── Authenticated: Current user profile ─────────────────────
// IMPORTANT: /me routes MUST be registered BEFORE /:id to avoid
// "me" being treated as an :id parameter
router.get("/me", authMiddleware, (req, res) => userController.getMe(req as any, res));
router.put("/me", authMiddleware, (req, res) => userController.updateMe(req as any, res));

// ─── Authenticated: Agent ownership ──────────────────────────
router.get("/me/agents", authMiddleware, (req, res) => userController.getMyAgents(req as any, res));
router.post("/me/agents/:agentId", authMiddleware, (req, res) => userController.addMyAgent(req as any, res));
router.delete("/me/agents/:agentId", authMiddleware, (req, res) => userController.removeMyAgent(req as any, res));

// ─── Public: Get any user by id ───────────────────────────────
router.get("/:id", (req, res) => userController.getUserProfile(req, res));

export default router;