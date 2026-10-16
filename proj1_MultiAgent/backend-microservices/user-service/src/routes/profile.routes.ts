import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { profileController } from "../controllers/profile.controller";

const router = Router();

// Protected routes — yêu cầu JWT token
router.get("/me", authMiddleware, (req, res) => profileController.getMyProfile(req as any, res));
router.put("/me", authMiddleware, (req, res) => profileController.updateMyProfile(req as any, res));
router.put("/me/status", authMiddleware, (req, res) => profileController.updateStatus(req as any, res));
router.post("/logout", authMiddleware, (req, res) => profileController.logout(req as any, res));

// Agent management
router.get("/me/agents", authMiddleware, (req, res) => profileController.getMyAgents(req as any, res));
router.post("/me/agents/:agentId", authMiddleware, (req, res) => profileController.addAgentToProfile(req as any, res));
router.delete("/me/agents/:agentId", authMiddleware, (req, res) => profileController.removeAgentFromProfile(req as any, res));

export default router;
