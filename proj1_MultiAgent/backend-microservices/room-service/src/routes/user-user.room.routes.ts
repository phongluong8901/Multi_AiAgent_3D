import { Router } from "express";
import { userUserRoomController } from "../controllers/user-user.room.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireRoomAdminOrOwner } from "../middlewares/room-auth.middleware";

const router = Router();

// Public — static paths MUST come before dynamic /:id to avoid capture
router.get("/", userUserRoomController.getRooms);

// Auth
router.use(requireAuth);

// Invites — GET /invites/me trước /:id để tránh Express 5 bắt "invites" là :id
router.get("/invites/me", userUserRoomController.myInvites);

router.post("/", userUserRoomController.createRoom);
router.post("/:id/join", userUserRoomController.joinRoom);
router.post("/:id/invites", userUserRoomController.invite);
router.post("/:id/invites/accept", userUserRoomController.acceptInvite);
router.post("/:id/invites/decline", userUserRoomController.declineInvite);
router.post("/:id/leave", requireAuth, userUserRoomController.leaveRoom);

router.post("/:id/members", userUserRoomController.addMember);
router.put("/:id", requireRoomAdminOrOwner, userUserRoomController.updateRoom);
router.delete("/:id", userUserRoomController.deleteRoom);
router.delete(
    "/:id/members/:memberId",
    requireRoomAdminOrOwner,
    userUserRoomController.removeMember
);

// Public GET by ID — sau cùng để không nuốt static paths phía trên
router.get("/:id", userUserRoomController.getRoomById);

export default router;