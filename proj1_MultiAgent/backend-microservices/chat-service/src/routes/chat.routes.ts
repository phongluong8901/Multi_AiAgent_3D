import { Router } from "express";
import { chatController } from "../controllers/chat.controller";

const router = Router();

// Chat History & REST Send (Dự phòng qua HTTP)
router.get("/history/:roomId", chatController.getHistory);
router.post("/send", chatController.sendMessage);

// Room Presence (Quản lý trạng thái online qua REST API fallback)
router.get("/presence/:roomId", chatController.getPresence);
router.post("/presence/:roomId", chatController.updatePresence);

// Memory & Context endpoints (Lưu trữ và lấy ngữ cảnh cho AI Agents)
router.get("/memory/short/:roomId", chatController.getShortMemory);
router.get("/memory/long/:agentId", chatController.getLongMemory);
router.post("/memory/long/:agentId", chatController.addLongMemory);
router.get("/memory/context/:agentId", chatController.getAgentContext);

export default router;