import { Router } from "express";
import { ownerController } from "../controllers/owner.controller";

const router = Router();

// Khám phá Marketplace các Node AI đang online
router.get("/marketplace", ownerController.getMarketplace);

// Bắt đầu thuê 1 máy
router.post("/rentals/start", ownerController.startRental);

// Kết thúc thuê máy
router.post("/rentals/:id/stop", ownerController.stopRental);

// Danh sách máy đã/đang thuê
router.get("/rentals/my", ownerController.getMyRentals);

// Gán Model từ máy đã thuê vào Agent
router.post("/agents/bind", ownerController.bindAgent);

// Gửi prompt suy luận thông qua Model của máy thuê
router.post("/agents/inference", ownerController.runAgentInference);

// Báo cáo Dashboard quản lý thuê của Owner
router.get("/dashboard", ownerController.getDashboard);

// Danh sách toàn bộ các phiên kết nối Seller ⇄ Owner đang truyền tải LLM
router.get("/connections/active", ownerController.getAllActiveConnections);

export default router;
