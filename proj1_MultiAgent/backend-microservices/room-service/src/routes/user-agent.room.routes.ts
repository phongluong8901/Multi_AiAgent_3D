import { Router } from "express";
import { userAgentRoomController } from "../controllers/user-agent.room.controller"; // Import controller xử lý logic liên kết giữa User và Agent
import { requireAuth } from "../middlewares/auth.middleware";                              // Import middleware xác thực JWT để bảo vệ các route yêu cầu đăng nhập

const router = Router(); // Khởi tạo một Router instance độc lập của Express

// Đăng ký middleware xác thực cho toàn bộ các route bên dưới (bắt buộc phải có token hợp lệ mới được truy cập)
router.use(requireAuth);

// Route POST: Gán một AI Agent cho User cụ thể trong phòng (URL: /api/v1/rooms/user-agent/:id/user-agents)
router.post("/:id/user-agents", userAgentRoomController.assignUserAgent);

// Route DELETE: Gỡ bỏ liên kết gán agent khỏi user trong phòng dựa vào ID phòng và agentId (URL: /api/v1/rooms/user-agent/:id/user-agents/:agentId)
router.delete("/:id/user-agents/:agentId", userAgentRoomController.removeUserAgent);

export default router; // Xuất router ra ngoài để file khởi động chính (index.ts) gắn vào hệ thống API endpoints