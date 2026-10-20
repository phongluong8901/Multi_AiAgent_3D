import { Router } from "express";
import { sellerController } from "../controllers/seller.controller";
import { generalLimiter } from "../middlewares/rateLimiter";

const router = Router();

// Áp dụng giới hạn tốc độ chung cho các API seller
router.use(generalLimiter);

// Các tuyến đường quản lý node và tài nguyên dành riêng cho Seller
router.post("/register-node", sellerController.registerNode);
router.post("/heartbeat", sellerController.pingHeartbeat);
router.get("/node", sellerController.getNodeDetails);

export default router;