import { Router } from "express";
import { sellerController } from "../controllers/seller.controller";
import { generalLimiter } from "../middlewares/rateLimiter";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware";

const router = Router();

// 1. Áp dụng giới hạn tốc độ chung cho các API seller
router.use(generalLimiter);

// 2. Bắt buộc tất cả các route bên dưới phải đăng nhập và có role là SELLER hoặc ADMIN
router.use(requireAuth);

//test tam tat di
// router.use(requireRoles(["SELLER", "ADMIN"]));

// --- Các tuyến đường quản lý node và tài nguyên dành riêng cho Seller ---
router.post("/register-node", sellerController.registerNode);
router.post("/heartbeat", sellerController.pingHeartbeat);
router.get("/node", sellerController.getNodeDetails);

export default router;