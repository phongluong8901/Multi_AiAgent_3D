// src/routes/user.routes.ts
import { Router } from "express";
import { generalLimiter } from "../middlewares/rateLimiter";
import { userController } from "../controllers/user.controller";
import { upload } from "../middlewares/upload.middleware";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware";

const router = Router();

router.use(generalLimiter);

// 1. Nhóm route cá nhân (Yêu cầu đăng nhập)
router.use("/me", requireAuth);

router.get("/me", userController.getMe);
router.put("/me", userController.updateMe);
router.put("/me/status", userController.updateStatus);
router.put("/me/avatar", upload.single("avatar"), userController.updateAvatar);

router.post("/me/hardware-node", userController.updateHardwareNode);
router.get("/me/hardware-node", userController.getHardwareNode);
router.delete("/me/hardware-node", userController.deleteHardwareNode);

router.get("/me/agents", userController.getMyAgents);
router.post("/me/agents/:agentId", userController.addMyAgent);
router.delete("/me/agents/:agentId", userController.removeMyAgent);

// 2. Nhóm route hệ thống & quản trị
router.get("/", requireAuth, requireRoles(["ADMIN"]), userController.getUsers);
router.get("/hardware-nodes", requireAuth, userController.getHardwareNodes);



// 3. Dynamic route
router.get("/online", requireAuth, userController.listOnlineUsers); //room service request
router.get("/:id", userController.getUserProfile);

export default router;