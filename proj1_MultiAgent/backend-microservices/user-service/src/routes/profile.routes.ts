import { Router } from "express";
import { profileController } from "../controllers/profile.controller";
import { generalLimiter } from "../middlewares/rateLimiter"; // Import general limiter

const router = Router();

// Áp dụng generalLimiter cho toàn bộ các route trong router này (hoặc chọn lọc từng route)
router.use(generalLimiter);

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