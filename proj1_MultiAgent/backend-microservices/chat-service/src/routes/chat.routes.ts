import { Router } from "express";
import { chatController } from "../controllers/chat.controller";

const router = Router();

// Chat History & REST Send
router.get("/history/:roomId", (req, res) => chatController.getHistory(req, res));
router.post("/send", (req, res) => chatController.sendMessage(req, res));

// Realtime SSE stream & Room Presence
router.get("/stream/:roomId", (req, res) => chatController.streamEvents(req, res));
router.get("/presence/:roomId", (req, res) => chatController.getPresence(req, res));
router.post("/presence/:roomId", (req, res) => chatController.updatePresence(req, res));

// Memory & Context endpoints
router.get("/memory/short/:roomId", (req, res) => chatController.getShortMemory(req, res));
router.get("/memory/long/:agentId", (req, res) => chatController.getLongMemory(req, res));
router.post("/memory/long/:agentId", (req, res) => chatController.addLongMemory(req, res));
router.get("/memory/context/:agentId", (req, res) => chatController.getAgentContext(req, res));

export default router;