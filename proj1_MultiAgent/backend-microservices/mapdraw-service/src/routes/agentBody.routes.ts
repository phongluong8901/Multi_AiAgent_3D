import { Router } from "express";
import { AgentBodyController } from "../controllers/agentBody.controller";

const router = Router();

// Routes cho Agent Body Studio (thiết kế thân robot + khớp)
router.post("/agent-bodies", AgentBodyController.saveBody);
router.get("/agent-bodies", AgentBodyController.getBodies);
router.get("/agent-bodies/:bodyId", AgentBodyController.getBodyById);
router.get("/agent-bodies/:bodyId/urdf", AgentBodyController.getBodyURDF);
router.get("/agent-bodies/:bodyId/training-spec", AgentBodyController.getBodyTrainingSpec);
router.delete("/agent-bodies/:bodyId", AgentBodyController.deleteBody);
router.post("/agent-bodies/:bodyId/clone", AgentBodyController.cloneBody);

export default router;

