import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
    user?: {
        userId: string;
        email: string;
        role: string;
    };
}

export const authMiddleware = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ success: false, message: "No token provided" });
        return;
    }

    const token = authHeader.split(" ")[1];
    const secret = process.env.JWT_SECRET || "fallback_secret";

    try {
        const decoded = jwt.verify(token, secret) as {
            userId: string;
            email: string;
            role: string;
        };
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
};
