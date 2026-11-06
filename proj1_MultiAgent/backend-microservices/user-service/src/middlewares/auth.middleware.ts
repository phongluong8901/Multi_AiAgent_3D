import { Request, Response, NextFunction } from "express";

/**
 * Interface mở rộng từ Express Request để lưu trữ thông tin tài khoản người dùng sau khi xác thực.
 */
export interface AuthenticatedRequest extends Request {
    user?: {
        userId: string;
        role: string;
    };
}

/**
 * Middleware yêu cầu người dùng phải đăng nhập trước khi truy cập tài nguyên.
 * Đọc header `x-user-id` do API Gateway chuyển tiếp sau khi giải mã JWT token.
 * 
 * @param req Request HTTP từ client hoặc gateway
 * @param res Response HTTP
 * @param next Chuyển tiếp sang middleware/controller tiếp theo
 */
export const requireAuth = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Response | void => {
    const userId = req.headers["x-user-id"] as string;
    const role = (req.headers["x-user-role"] as string) || "user";

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized: Vui lòng đăng nhập để tiếp tục",
        });
    }

    req.user = { userId, role };
    next();
};

/**
 * Factory Middleware kiểm tra phân quyền (RBAC - Role-Based Access Control).
 * 
 * @param allowedRoles Mảng danh sách các role được phép truy cập (vd: `["admin"]`, `["seller", "admin"]`)
 */
export const requireRoles = (allowedRoles: string[]) => {
    return (
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Response | void => {
        const role = req.headers["x-user-role"] as string;

        if (!role || !allowedRoles.includes(role)) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: Bạn không có quyền truy cập tài nguyên này",
            });
        }

        next();
    };
};
