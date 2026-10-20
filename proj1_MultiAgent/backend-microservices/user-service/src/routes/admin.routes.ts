import { Router } from "express";
import { adminController } from "../controllers/admin.controller";
import { generalLimiter } from "../middlewares/rateLimiter";

const router = Router();

// Áp dụng giới hạn tốc độ chung cho các API quản trị
router.use(generalLimiter);

// Các tuyến đường quản lý hệ thống dành riêng cho Admin
router.get("/users", adminController.getUsers);
router.get("/users/:id", adminController.getUserById);
router.patch("/users/role", adminController.updateUserRole);
router.delete("/users/:id", adminController.deleteUser);

router.get("/hardware-nodes", adminController.getHardwareNodes);

export default router;