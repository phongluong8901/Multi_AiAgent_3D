import jwt from "jsonwebtoken";

export interface TokenPayload {
    userId: string;
    email: string;
    role: string;
}

export const generateToken = (payload: TokenPayload): string => {
    const secret = process.env.JWT_SECRET || "fallback_secret";
    const expiresIn = (process.env.JWT_EXPIRES_IN as any) || "7d";
    return jwt.sign(payload, secret, { expiresIn });
};

export const verifyToken = (token: string): TokenPayload => {
    const secret = process.env.JWT_SECRET || "fallback_secret";
    return jwt.verify(token, secret) as TokenPayload;
};