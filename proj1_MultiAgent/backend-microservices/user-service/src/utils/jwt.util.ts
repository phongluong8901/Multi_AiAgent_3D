import jwt from "jsonwebtoken";

export interface TokenPayload {
    userId: string;
    email: string;
    role: string;
}

export interface RefreshTokenPayload {
    userId: string;
}

/** Tạo Access Token (Mặc định 15 phút) */
export const generateToken = (payload: TokenPayload, expiresIn: string | number = "15m"): string => {
    const secret = process.env.JWT_SECRET || "fallback_secret";
    return jwt.sign(payload, secret, { expiresIn: expiresIn as any });
};

/** Xác thực Access Token */
export const verifyToken = (token: string): TokenPayload => {
    const secret = process.env.JWT_SECRET || "fallback_secret";
    return jwt.verify(token, secret) as TokenPayload;
};

/** Tạo Refresh Token (Sống lâu hơn, mặc định 7 ngày) */
export const generateRefreshToken = (payload: RefreshTokenPayload, expiresIn: string | number = "7d"): string => {
    const secret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET || "fallback_refresh_secret";
    return jwt.sign(payload, secret, { expiresIn: expiresIn as any });
};

/** Xác thực Refresh Token */
export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
    const secret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET || "fallback_refresh_secret";
    return jwt.verify(token, secret) as RefreshTokenPayload;
};