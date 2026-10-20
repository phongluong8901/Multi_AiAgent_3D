// src/routes/user.routes.ts
import { Router } from "express";
import { generalLimiter } from "../middlewares/rateLimiter";
import { userController } from "../controllers/user.controller";
import { upload } from "../middlewares/upload.middleware";
import { asyncHandler } from "../middlewares/async.middleware"; // Import asyncHandler

const router = Router();

// Áp dụng rate limiter chung cho tất cả các route bên dưới
router.use(generalLimiter);

// ─── User Profile & Hardware Node Routes ─────
router.get("/", userController.getUsers);
router.get("/hardware-nodes", userController.getHardwareNodes);

// IMPORTANT: Các route /me phải đặt trước /:id để tránh trùng khớp tham số
router.get("/me", userController.getMe);
router.put("/me", userController.updateMe);
router.put("/me/status", userController.updateStatus);
router.put("/me/avatar", upload.single("avatar"), userController.updateAvatar);

router.post("/me/hardware-node", userController.updateHardwareNode);
router.get("/me/hardware-node", userController.getHardwareNode);

// Agent ownership management
router.get("/me/agents", userController.getMyAgents);
router.post("/me/agents/:agentId", userController.addMyAgent);
router.delete("/me/agents/:agentId", userController.removeMyAgent);

// Public: Get user profile by ID (Phải đặt ở cuối cùng)
router.get("/:id", userController.getUserProfile);

export default router;