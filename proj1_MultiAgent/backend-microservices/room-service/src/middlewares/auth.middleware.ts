import { Request, Response, NextFunction } from "express";

/**
 * Interface mở rộng từ Express Request để lưu trữ thông tin xác thực của người dùng hoặc service nội bộ trong Room Service.
 */
export interface AuthenticatedRequest extends Request {
    user?: {
        userId: string;
        role: string;
    };
}

/**
 * Middleware xác thực yêu cầu truy cập vào Room Service.
 * Hỗ trợ cả người dùng có header `x-user-id` và các microservice nội bộ (qua header `x-internal-service`).
 * 
 * @param req Request HTTP từ client hoặc gateway
 * @param res Response HTTP
 * @param next Chuyển tiếp sang middleware tiếp theo
 */
export const requireAuth = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Response | void => {
    const userId = req.headers["x-user-id"] as string;
    const role = (req.headers["x-user-role"] as string) || "user";
    const internalService = req.headers["x-internal-service"] as string;

    // Cho phép các microservice nội bộ (như chat-service, agent-service) gọi trực tiếp với quyền admin
    if (internalService || userId === "system-internal") {
        req.user = { userId: userId || "system-internal", role: "admin" };
        return next();
    }

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
 * Factory Middleware kiểm tra phân quyền người dùng trong phòng làm việc theo vai trò.
 * 
 * @param allowedRoles Mảng danh sách các vai trò hợp lệ (vd: `["admin"]`, `["creator", "admin"]`)
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
