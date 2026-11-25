import { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger";

/**
 * Middleware xu ly loi tap trung (Global Error Handler) cho Owner Service:
 * Bat moi ngoai le unhandled tu controller, service va tra ve JSON loi chuan muc.
 * 
 * @param err Doi tuong loi
 * @param req Express Request
 * @param res Express Response
 * @param next NextFunction
 */
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    logger.error("Unhandled Error:", err.stack || err.message);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
    });
};
