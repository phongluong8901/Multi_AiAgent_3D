import { Request, Response } from "express";
import { adminService } from "../services/admin.service";
import { UnauthorizedError } from "../utils/exceptions";
import { asyncHandler } from "../middlewares/async.middleware";

export class AdminController {

    /** 
     * GET /api/v1/admin/users — Lấy danh sách toàn bộ người dùng (hỗ trợ query lọc theo role) 
     */
    getUsers = asyncHandler(async (req: Request, res: Response) => {
        const { role } = req.query;
        const users = await adminService.getAllUsers(role as any);
        return res.status(200).json({ success: true, data: users });
    });

    /** 
     * GET /api/v1/admin/users/:id — Lấy chi tiết thông tin một user bất kỳ 
     */
    getUserById = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const user = await adminService.getUserDetails(id as string);
        return res.status(200).json({ success: true, data: user });
    });

    /** 
     * PATCH /api/v1/admin/users/role — Cập nhật phân quyền (role) cho user 
     */
    updateUserRole = asyncHandler(async (req: Request, res: Response) => {
        const { userId, role } = req.body;
        const result = await adminService.updateUserRole(userId, role);
        return res.status(200).json({ success: true, ...result });
    });

    /** 
     * DELETE /api/v1/admin/users/:id — Xóa mềm tài khoản người dùng 
     */
    deleteUser = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const result = await adminService.softDeleteUser(id as string);
        return res.status(200).json({ success: true, ...result });
    });

    /** 
     * GET /api/v1/admin/hardware-nodes — Lấy danh sách toàn bộ node AI trong hệ thống 
     */
    getHardwareNodes = asyncHandler(async (req: Request, res: Response) => {
        const nodes = await adminService.getSystemHardwareNodes();
        return res.status(200).json({ success: true, data: nodes });
    });
}

export const adminController = new AdminController();