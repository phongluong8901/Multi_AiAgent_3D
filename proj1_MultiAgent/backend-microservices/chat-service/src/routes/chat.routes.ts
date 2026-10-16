import { Router } from "express";
import { chatController } from "../controllers/chat.controller";

const router = Router();

router.get("/history/:roomId", (req, res) => chatController.getHistory(req, res));

export default router;