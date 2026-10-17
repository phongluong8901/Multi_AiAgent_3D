import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface GatewayRequest extends Request {
    user?: { userId: string; email: string; role: string };
}

export const gatewayAuthMiddleware = (req: GatewayRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Unauthorized: Missing or invalid token format" });
    }

    const token = authHeader.split(" ")[1];
    try {
        const secret = process.env.JWT_SECRET || "fallback_secret";
        const decoded = jwt.verify(token, secret) as any;

        // Đính kèm thông tin user vào headers để forward sang Microservices bên trong
        req.headers["x-user-id"] = decoded.userId;
        req.headers["x-user-role"] = decoded.role;

        next();
    } catch (error) {
        return res.status(403).json({ success: false, message: "Forbidden: Token is invalid or expired" });
    }
};