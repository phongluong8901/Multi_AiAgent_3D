// src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from "express";

export interface AuthenticatedRequest extends Request {
    user?: {
        userId: string;
        role: string;
    };
}

// 1. Chỉ cần đăng nhập (USER, SELLER, ADMIN đều qua được, hoặc internal service)
export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.headers["x-user-id"] as string;
    const role = (req.headers["x-user-role"] as string) || "user";
    const internalService = req.headers["x-internal-service"] as string;

    if (internalService || userId === "system-internal") {
        req.user = { userId: userId || "system-internal", role: "admin" };
        return next();
    }

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized: Vui lòng đăng nhập để tiếp tục"
        });
    }

    req.user = { userId, role };
    next();
};

// 2. Phân quyền theo danh sách role cho phép
export const requireRoles = (allowedRoles: string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const role = req.headers["x-user-role"] as string;

        if (!role || !allowedRoles.includes(role)) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: Bạn không có quyền truy cập tài nguyên này"
            });
        }

        next();
    };
};