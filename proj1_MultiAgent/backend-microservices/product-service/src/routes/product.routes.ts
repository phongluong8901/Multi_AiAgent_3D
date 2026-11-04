import { Router } from "express";
import { productController } from "../controllers/product.controller";

const router = Router();

router.get("/products", productController.getProducts.bind(productController));
router.get("/products/:id", productController.getProductById.bind(productController));
router.post("/products", productController.createProduct.bind(productController));

export default router;
