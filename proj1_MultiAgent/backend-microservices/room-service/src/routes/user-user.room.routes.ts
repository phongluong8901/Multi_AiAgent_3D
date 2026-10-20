import { Router } from "express";
import { userUserRoomController } from "../controllers/user-user.room.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

// --- Public Routes (hoặc dùng chung) ---
router.get("/", userUserRoomController.getRooms);
router.get("/:id", userUserRoomController.getRoomById);

// --- Protected Routes (Yêu cầu đăng nhập / Token) ---
router.use(requireAuth);

router.post("/", userUserRoomController.createRoom);
router.put("/:id", userUserRoomController.updateRoom);

// Quản lý thành viên trong phòng
router.post("/:id/members", userUserRoomController.addMember);
router.delete("/:id/members/:memberId", userUserRoomController.removeMember);

export default router;