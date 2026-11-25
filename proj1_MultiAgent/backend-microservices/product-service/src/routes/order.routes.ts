import { Router } from "express";
import { orderController } from "../controllers/order.controller";

/**
 * Router định tuyến các giao dịch mua đứt, thuê Agent và tra cứu đơn hàng.
 */
const router = Router();

// Mua đứt bản quyền vĩnh viễn AI Agent
router.post("/orders/buy", orderController.buyAgent.bind(orderController));

// Thuê AI Agent theo chu kỳ giờ, ngày, tháng
router.post("/orders/rent", orderController.rentAgent.bind(orderController));

// Lấy lịch sử giao dịch đơn hàng của một người dùng
router.get("/orders/user/:userId", orderController.getUserOrders.bind(orderController));

export default router;
