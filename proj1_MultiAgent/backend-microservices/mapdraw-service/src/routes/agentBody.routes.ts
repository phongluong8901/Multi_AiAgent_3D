import { Router } from "express";
import { AgentBodyController } from "../controllers/agentBody.controller";

/**
 * Router định tuyến các API thuộc Agent Body Studio (thiết kế cấu trúc thân robot, link và joint động học).
 */
const router = Router();

// Lưu hoặc cập nhật mô hình thân robot 3D
router.post("/agent-bodies", AgentBodyController.saveBody);

// Lấy danh sách các mẫu thân robot có sẵn
router.get("/agent-bodies", AgentBodyController.getBodies);

// Xem chi tiết cấu hình động học và hình học của một thân robot
router.get("/agent-bodies/:bodyId", AgentBodyController.getBodyById);

// Xuất mô hình robot dưới dạng tệp định dạng chuẩn công nghiệp URDF (XML)
router.get("/agent-bodies/:bodyId/urdf", AgentBodyController.getBodyURDF);

// Xuất thông số đặc tả huấn luyện RL (Action space và Observation space cho PyTorch)
router.get("/agent-bodies/:bodyId/training-spec", AgentBodyController.getBodyTrainingSpec);

// Xóa mô hình thân robot
router.delete("/agent-bodies/:bodyId", AgentBodyController.deleteBody);

// Nhân bản mẫu thân robot
router.post("/agent-bodies/:bodyId/clone", AgentBodyController.cloneBody);

export default router;
