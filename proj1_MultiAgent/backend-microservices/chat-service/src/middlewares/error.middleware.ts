import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/exceptions";

/**
 * Middleware xu ly loi toan cuc (Global Error Handler) cho Chat Service:
 * Tu dong nhan dien loi nghiep vu `AppError` hoac loi he thong 500,
 * an toan che dau stack trace tren moi truong production.
 * 
 * @param err Doi tuong loi
 * @param req Express Request
 * @param res Express Response
 * @param next NextFunction
 */
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    const statusCode = err instanceof AppError ? err.statusCode : 500;
    const message = err.message || "Lỗi máy chủ nội bộ.";

    console.error(`[chat-service] [ERROR] ${req.method} ${req.url}:`, err);

    return res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === "development" && { stack: err.stack })
    });
};
