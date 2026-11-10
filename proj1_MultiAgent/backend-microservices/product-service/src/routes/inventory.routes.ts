import { Router } from "express";
import { inventoryController } from "../controllers/inventory.controller";

/**
 * Router định tuyến các API liên quan đến kho lưu trữ Agent của người dùng và xác thực quyền kích hoạt.
 */
const router = Router();

// Lấy danh sách toàn bộ Agent trong kho của một User
router.get("/inventory/user/:userId", inventoryController.getUserInventory.bind(inventoryController));

// Kiểm tra quyền sử dụng Agent (phục vụ Room-service / Agent-service trước khi gọi model)
router.get("/inventory/check-access", inventoryController.checkAgentAccess.bind(inventoryController));

export default router;
