import { Router } from "express";
import { inventoryController } from "../controllers/inventory.controller";

const router = Router();

router.get("/inventory/user/:userId", inventoryController.getUserInventory.bind(inventoryController));
router.get("/inventory/check-access", inventoryController.checkAgentAccess.bind(inventoryController));

export default router;
