import { Request, Response } from "express";
import { userService } from "../services/user.service";

export class UserController {
    async register(req: Request, res: Response) {
        try {
            const user = await userService.register(req.body);
            return res.status(201).json({ success: true, data: user });
        } catch (error: any) {
            return res.status(400).json({ success: false, message: error.message });
        }
    }

    async login(req: Request, res: Response) {
        try {
            const result = await userService.login(req.body);
            return res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            return res.status(401).json({ success: false, message: error.message });
        }
    }

    async getUsers(req: Request, res: Response) {
        try {
            const users = await userService.getAllUsers();
            return res.status(200).json({ success: true, data: users });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    async getUserProfile(req: Request, res: Response) {
        try {
            const user = await userService.getUserById(req.params.id as string);
            return res.status(200).json({ success: true, data: user });
        } catch (error: any) {
            return res.status(404).json({ success: false, message: error.message });
        }
    }
}

export const userController = new UserController();