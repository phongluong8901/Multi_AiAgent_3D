import { Router } from "express";
import { sellerController } from "../controllers/seller.controller";

const router = Router();

// Lấy danh sách Node cho thuê công khai trên Marketplace
router.get("/nodes/market", sellerController.getMarketNodes);

// Lấy danh sách Node của chính Seller
router.get("/nodes/my", sellerController.getMyNodes);

// Đăng ký Node phần cứng mới cho thuê
router.post("/nodes/register", sellerController.registerNode);

// Cập nhật trạng thái Node (ONLINE, BUSY, OFFLINE)
router.patch("/nodes/:id/status", sellerController.updateStatus);

// Điều chỉnh biểu phí cho thuê máy
router.patch("/nodes/:id/pricing", sellerController.updatePricing);

// Nhận lệnh chạy Model AI Local và sinh phản hồi
router.post("/nodes/:id/inference", sellerController.executeInference);
router.post("/inference", sellerController.executeInference);

// Báo cáo Dashboard doanh thu và hiệu suất máy
router.get("/dashboard", sellerController.getDashboard);

export default router;
