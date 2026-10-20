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
router.get("/", asyncHandler(userController.getUsers));
router.get("/hardware-nodes", asyncHandler(userController.getHardwareNodes));

// IMPORTANT: Các route /me phải đặt trước /:id để tránh trùng khớp tham số
router.get("/me", asyncHandler(userController.getMe));
router.put("/me", asyncHandler(userController.updateMe));
router.put("/me/status", asyncHandler(userController.updateStatus));
router.put("/me/avatar", upload.single("avatar"), asyncHandler(userController.updateAvatar));

router.post("/me/hardware-node", asyncHandler(userController.updateHardwareNode));
router.get("/me/hardware-node", asyncHandler(userController.getHardwareNode));

// Agent ownership management
router.get("/me/agents", asyncHandler(userController.getMyAgents));
router.post("/me/agents/:agentId", asyncHandler(userController.addMyAgent));
router.delete("/me/agents/:agentId", asyncHandler(userController.removeMyAgent));

// Public: Get user profile by ID (Phải đặt ở cuối cùng)
router.get("/:id", asyncHandler(userController.getUserProfile));

export default router;