import { Router } from "express";
import { userUserRoomController } from "../controllers/user-user.room.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireRoomAdminOrOwner } from "../middlewares/room-auth.middleware";

const router = Router();

// --- CÁC ROUTE CÔNG KHAI (PUBLIC ROUTES) ---
router.get("/", userUserRoomController.getRooms);
router.get("/presence/summary", userUserRoomController.getPresenceSummary);
router.get("/:id/presence", userUserRoomController.getRoomPresence);
router.post("/:id/presence", userUserRoomController.updateRoomPresence);

// --- XÁC THỰC CHO CÁC ROUTE PHÍA DƯỚI ---
router.use(requireAuth);

router.get("/invites/me", userUserRoomController.myInvites);
router.post("/", userUserRoomController.createRoom);
router.post("/:id/join", userUserRoomController.joinRoom);
router.post("/:id/invites", userUserRoomController.invite);
router.post("/:id/invites/accept", userUserRoomController.acceptInvite);
router.post("/:id/invites/decline", userUserRoomController.declineInvite);
router.post("/:id/leave", requireAuth, userUserRoomController.leaveRoom);
router.post("/:id/members", userUserRoomController.addMember);
router.put("/:id", requireRoomAdminOrOwner, userUserRoomController.updateRoom);
router.put("/:id/workflow", requireRoomAdminOrOwner, userUserRoomController.updateWorkflow);
router.delete("/:id", userUserRoomController.deleteRoom);
router.delete(
    "/:id/members/:memberId",
    requireRoomAdminOrOwner,
    userUserRoomController.removeMember
);

// --- ROUTE LẤY CHI TIẾT THEO ID ĐẶT Ở CUỐI ---
router.get("/:id", userUserRoomController.getRoomById);

export default router;
