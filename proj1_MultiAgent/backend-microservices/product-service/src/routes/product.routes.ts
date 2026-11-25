import { Router } from "express";
import { productController } from "../controllers/product.controller";

/**
 * Router định tuyến các API liên quan đến danh mục sản phẩm AI Agent trên Marketplace.
 */
const router = Router();

// Lấy danh sách sản phẩm theo bộ lọc (category, modelTier, search)
router.get("/products", productController.getProducts.bind(productController));

// Lấy chi tiết thông tin một sản phẩm Agent theo _id hoặc agentId
router.get("/products/:id", productController.getProductById.bind(productController));

// Đăng tải hoặc niêm yết một Agent mới lên sàn Marketplace
router.post("/products", productController.createProduct.bind(productController));

export default router;
