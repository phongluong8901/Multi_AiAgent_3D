import { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger";

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    logger.error("Unhandled Error:", err.stack || err.message);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
    });
};
