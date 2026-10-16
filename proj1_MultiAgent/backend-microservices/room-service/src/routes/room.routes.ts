import { Router } from "express";
import { roomController } from "../controllers/room.controller";

const router = Router();

router.post("/", (req, res) => roomController.createRoom(req, res));
router.get("/", (req, res) => roomController.getRooms(req, res));
router.get("/:id", (req, res) => roomController.getRoomById(req, res));
router.post("/:id/members", (req, res) => roomController.addMember(req, res));
router.delete("/:id/members/:memberId", (req, res) => roomController.removeMember(req, res));

export default router;