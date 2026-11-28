import { Router } from "express";
import { sellerController } from "../controllers/seller.controller";

/**
 * Bo dinh tuyen REST API cho Seller Service (`/api/v1/seller`):
 * - /nodes/market: Danh sach Node tren san Marketplace
 * - /nodes/my: Quan ly cac Node do Seller so huu
 * - /nodes/register: Dang ky va chia se phan cung may tram
 * - /nodes/:id/status: Cap nhat trang thai may (ONLINE, BUSY, OFFLINE)
 * - /nodes/:id/pricing: Dieu chinh bieu phi thue theo gio va token
 * - /nodes/:id/inference & /inference: Thuc thi suy luan mo hinh cuc bo
 * - /dashboard: Thong ke doanh thu va luong request phuc vu
 */
const router = Router();

// Lay danh sach Node cho thue cong khai tren Marketplace
router.get("/nodes/market", sellerController.getMarketNodes);

// Lay danh sach Node cua chinh Seller
router.get("/nodes/my", sellerController.getMyNodes);

// Dang ky Node phan cung moi cho thue
router.post("/nodes/register", sellerController.registerNode);

// Cap nhat trang thai Node (ONLINE, BUSY, OFFLINE)
router.patch("/nodes/:id/status", sellerController.updateStatus);

// Dieu chinh bieu phi cho thue may
router.patch("/nodes/:id/pricing", sellerController.updatePricing);

// Nhan lenh chay Model AI Local va sinh phan hoi
router.post("/nodes/:id/inference", sellerController.executeInference);
router.post("/inference", sellerController.executeInference);

// Bao cao Dashboard doanh thu va hieu suat may
router.get("/dashboard", sellerController.getDashboard);

export default router;
