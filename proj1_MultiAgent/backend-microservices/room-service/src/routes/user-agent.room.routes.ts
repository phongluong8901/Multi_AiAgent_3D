import { Router } from "express";
import { userAgentRoomController } from "../controllers/user-agent.room.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.use(requireAuth);
router.post("/:id/user-agents", userAgentRoomController.assignUserAgent);
router.delete("/:id/user-agents/:agentId", userAgentRoomController.removeUserAgent);

export default router;