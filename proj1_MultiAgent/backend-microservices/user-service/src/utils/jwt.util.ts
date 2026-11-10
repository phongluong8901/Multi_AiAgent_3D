import jwt from "jsonwebtoken";
import { RefreshTokenPayload, TokenPayload } from "../types/user.types";


/** Tạo Access Token (Mặc định 15 phút) */
// export const generateToken = (payload: TokenPayload, expiresIn: string | number = "15m"): string => {
export const generateToken = (payload: TokenPayload, expiresIn: string | number = "3600m"): string => {
    const secret = process.env.JWT_SECRET || "fallback_secret";
    // Mã hóa payload thành chuỗi JWT kèm thời hạn sống
    return jwt.sign(payload, secret, { expiresIn: expiresIn as any });
};

/** Xác thực Access Token */
export const verifyToken = (token: string): TokenPayload => {
    const secret = process.env.JWT_SECRET || "fallback_secret";
    // Kiểm tra tính hợp lệ của token và ép kiểu về TokenPayload
    return jwt.verify(token, secret) as TokenPayload;
};

/** Tạo Refresh Token (Sống lâu hơn, mặc định 7 ngày) */
export const generateRefreshToken = (payload: RefreshTokenPayload, expiresIn: string | number = "7d"): string => {
    const secret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET || "fallback_refresh_secret";
    // Mã hóa Refresh Token với secret tương ứng
    return jwt.sign(payload, secret, { expiresIn: expiresIn as any });
};

/** Xác thực Refresh Token */
export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
    const secret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET || "fallback_refresh_secret";
    // Kiểm tra tính hợp lệ của refresh token
    return jwt.verify(token, secret) as RefreshTokenPayload;
};