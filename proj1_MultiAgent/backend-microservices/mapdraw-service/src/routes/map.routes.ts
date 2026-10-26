import { Router } from "express";
import { MapController } from "../controllers/map.controller";

const router = Router();

// Routes cho Maps
router.post("/maps", MapController.saveMap);
router.get("/maps", MapController.getMaps);
router.get("/maps/:mapId", MapController.getMapById);
router.delete("/maps/:mapId", MapController.deleteMap);
router.post("/maps/:mapId/clone", MapController.cloneMap);

export default router;
