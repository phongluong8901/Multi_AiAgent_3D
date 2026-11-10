import { Router } from "express";
import { agentAgentRoomController } from "../controllers/agent-agent.room.controller"; // Import controller xử lý logic agent-agent
import { requireAuth } from "../middlewares/auth.middleware";                              // Import middleware xác thực JWT để bảo vệ các route

const router = Router(); // Khởi tạo một Router instance độc lập của Express

// Đăng ký middleware xác thực cho toàn bộ các route nằm bên dưới trong file này (bắt buộc phải có token hợp lệ mới được gọi API)
router.use(requireAuth);

// Route POST: Đồng bộ toàn bộ danh sách các AI Agent đang hoạt động trong phòng (URL: /api/v1/rooms/agent-agent/:id/agents)
router.post("/:id/agents", agentAgentRoomController.syncAgents);

// Route POST: Thêm mới một AI Agent cụ thể vào phòng chat (URL: /api/v1/rooms/agent-agent/:id/agents/:agentId)
router.post("/:id/agents/:agentId", agentAgentRoomController.addAgent);

// Route DELETE: Gỡ bỏ một AI Agent cụ thể khỏi phòng chat (URL: /api/v1/rooms/agent-agent/:id/agents/:agentId)
router.delete("/:id/agents/:agentId", agentAgentRoomController.removeAgent);

export default router; // Xuất router ra ngoài để server chính (index.ts) gắn vào hệ thống API endpoints