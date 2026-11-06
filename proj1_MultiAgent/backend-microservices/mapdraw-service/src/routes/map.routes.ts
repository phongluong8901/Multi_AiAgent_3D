import { Router } from "express";
import { MapController } from "../controllers/map.controller";

/**
 * Router định tuyến các API quản lý và thiết kế bản đồ không gian 3D (3D Maps).
 */
const router = Router();

// Lưu hoặc cập nhật thiết kế bản đồ 3D (tính thưởng SaveCoins dựa trên các item IoT/Robot bố trí)
router.post("/maps", MapController.saveMap);

// Lấy danh sách các bản đồ công khai hoặc do người dùng tạo
router.get("/maps", MapController.getMaps);

// Xem chi tiết cấu hình không gian và danh sách vật thể 3D của bản đồ
router.get("/maps/:mapId", MapController.getMapById);

// Xóa bản đồ khỏi hệ thống
router.delete("/maps/:mapId", MapController.deleteMap);

// Nhân bản (Fork/Clone) bản đồ sang bản sao mới
router.post("/maps/:mapId/clone", MapController.cloneMap);

export default router;
