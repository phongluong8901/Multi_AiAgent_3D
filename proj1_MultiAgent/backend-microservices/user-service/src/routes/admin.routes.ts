import { Router } from "express";
import { adminController } from "../controllers/admin.controller";
import { generalLimiter } from "../middlewares/rateLimiter";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware";

const router = Router();

// 1. Áp dụng giới hạn tốc độ chung cho các API quản trị
router.use(generalLimiter);

// 2. Bắt buộc tất cả các route trong file này phải đăng nhập và có role ADMIN
//    (Hỗ trợ kiểm tra x-user-id và x-user-role từ API Gateway truyền xuống)
router.use(requireAuth);

//test tam tat di
// router.use(requireRoles(["ADMIN"]));

// --- Các tuyến đường quản lý hệ thống dành riêng cho Admin ---

// Quản lý người dùng
router.get("/users", adminController.getUsers);
router.get("/users/:id", adminController.getUserById);
router.patch("/users/role", adminController.updateUserRole);
router.delete("/users/:id", adminController.deleteUser);

// Quản lý nút phần cứng (Hardware Nodes)
router.get("/hardware-nodes", adminController.getHardwareNodes);

export default router;