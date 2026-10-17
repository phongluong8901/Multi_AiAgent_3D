import { Router } from "express";
import { roomController } from "../controllers/room.controller";

const router = Router();

router.post("/", (req, res) => roomController.createRoom(req, res));
router.get("/", (req, res) => roomController.getRooms(req, res));
router.get("/:id", (req, res) => roomController.getRoomById(req, res));
router.put("/:id", (req, res) => roomController.updateRoom(req, res));
router.post("/:id/members", (req, res) => roomController.addMember(req, res));
router.delete("/:id/members/:memberId", (req, res) => roomController.removeMember(req, res));
router.post("/:id/agents", (req, res) => roomController.syncAgents(req, res));
router.post("/:id/agents/:agentId", (req, res) => roomController.addAgent(req, res));
router.delete("/:id/agents/:agentId", (req, res) => roomController.removeAgent(req, res));
router.post("/:id/user-agents", (req, res) => roomController.assignUserAgent(req, res));
router.delete("/:id/user-agents/:agentId", (req, res) => roomController.removeUserAgent(req, res));

export default router;