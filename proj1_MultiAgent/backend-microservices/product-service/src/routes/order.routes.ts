import { Router } from "express";
import { orderController } from "../controllers/order.controller";

const router = Router();

router.post("/orders/buy", orderController.buyAgent.bind(orderController));
router.post("/orders/rent", orderController.rentAgent.bind(orderController));
router.get("/orders/user/:userId", orderController.getUserOrders.bind(orderController));

export default router;
