import { Router } from "express";
import { agentAgentRoomController } from "../controllers/agent-agent.room.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.use(requireAuth);
router.post("/:id/agents", agentAgentRoomController.syncAgents);
router.post("/:id/agents/:agentId", agentAgentRoomController.addAgent);
router.delete("/:id/agents/:agentId", agentAgentRoomController.removeAgent);

export default router;