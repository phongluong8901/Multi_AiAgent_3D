// src/middlewares/error.middleware.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/exceptions";

// Middleware xử lý lỗi toàn cục cho ứng dụng Express
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    const statusCode = err instanceof AppError ? err.statusCode : 500;
    const message = err.message || "Lỗi máy chủ nội bộ.";

    console.error(`[Error Handler] ${req.method} ${req.url}:`, err);

    return res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === "development" && { stack: err.stack })
    });
};