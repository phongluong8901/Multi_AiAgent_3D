import { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger";

/**
 * Middleware xử lý lỗi tập trung (Global Error Handler) cho Seller Service.
 * Bắt tất cả các ngoại lệ không được xử lý (unhandled exceptions) từ controller và service layers,
 * ghi log chi tiết stack trace để debug và trả về phản hồi JSON chuẩn hóa cho client.
 * 
 * @param err Đối tượng lỗi phát sinh trong quá trình xử lý request
 * @param req Request HTTP từ client
 * @param res Response HTTP trả về
 * @param next Hàm chuyển tiếp middleware tiếp theo (nếu có)
 */
export const errorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    // 1. Ghi log lỗi có đầy đủ stack trace vào winston logger
    logger.error("Unhandled Error:", err.stack || err.message);

    // 2. Xác định mã HTTP status (mặc định 500 Internal Server Error nếu lỗi không định nghĩa)
    const statusCode = err.statusCode || 500;

    // 3. Trả về cấu trúc phản hồi JSON đồng nhất
    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
    });
};
