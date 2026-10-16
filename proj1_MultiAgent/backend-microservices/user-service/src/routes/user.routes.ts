import { Router } from "express";
import { userController } from "../controllers/user.controller";

const router = Router();

router.post("/register", (req, res) => userController.register(req, res));
router.post("/login", (req, res) => userController.login(req, res));
router.get("/", (req, res) => userController.getUsers(req, res));
router.get("/:id", (req, res) => userController.getUserProfile(req, res));

export default router;