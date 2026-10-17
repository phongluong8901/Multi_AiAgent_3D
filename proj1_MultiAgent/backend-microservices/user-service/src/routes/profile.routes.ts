import { Router } from "express";
import { profileController } from "../controllers/profile.controller";

const router = Router();

// Protected routes — API Gateway đã chịu trách nhiệm check token và forward thông tin user qua headers
router.get("/me", (req, res) => profileController.getMyProfile(req, res));
router.put("/me", (req, res) => profileController.updateMyProfile(req, res));
router.put("/me/status", (req, res) => profileController.updateStatus(req, res));
router.post("/logout", (req, res) => profileController.logout(req, res));

// Agent management
router.get("/me/agents", (req, res) => profileController.getMyAgents(req, res));
router.post("/me/agents/:agentId", (req, res) => profileController.addAgentToProfile(req, res));
router.delete("/me/agents/:agentId", (req, res) => profileController.removeAgentFromProfile(req, res));

export default router;