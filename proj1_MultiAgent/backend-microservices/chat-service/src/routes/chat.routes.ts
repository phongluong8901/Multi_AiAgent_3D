import { Router } from "express";
import { chatController } from "../controllers/chat.controller";
import { upload } from "../middlewares/upload.middleware";

const router = Router();

// Floating Chat Bubble Quick Rooms Summary (kèm tin nhắn cuối + Online/Offline)
router.get("/bubble/rooms", chatController.getBubbleRooms);

// Chat History & REST Send (Dự phòng qua HTTP)
router.get("/history/:roomId", chatController.getHistory);
router.post("/send", chatController.sendMessage);

// Upload file đính kèm (Ảnh, CSV, Excel, PDF) lên Cloudinary
router.post("/upload", upload.single("file"), chatController.uploadAttachment);

// Room Presence (Quản lý trạng thái online/offline qua REST API)
router.get("/presence/:roomId", chatController.getPresence);
router.post("/presence/:roomId", chatController.updatePresence);

// Memory & Context endpoints (Lưu trữ và lấy ngữ cảnh cho AI Agents)
router.get("/memory/short/:roomId", chatController.getShortMemory);
router.get("/memory/long/:agentId", chatController.getLongMemory);
router.post("/memory/long/:agentId", chatController.addLongMemory);
router.get("/memory/context/:agentId", chatController.getAgentContext);

export default router;
