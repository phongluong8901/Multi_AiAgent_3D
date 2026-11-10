import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

/**
 * Interface mở rộng từ Express Request để lưu trữ thông tin định danh của người dùng sau khi giải mã JWT token.
 * Được truyền tiếp qua các controller hoặc proxy routing của API Gateway.
 */
export interface GatewayRequest extends Request {
    /**
     * Dữ liệu payload của người dùng được trích xuất từ JWT token đã xác thực hợp lệ.
     */
    user?: {
        userId: string;
        email: string;
        role: string;
    };
}

/**
 * Middleware xác thực Bearer JWT Token tại cổng API Gateway.
 * 
 * Luồng hoạt động:
 * 1. Kiểm tra header `Authorization` có tiền tố `Bearer <token>` hay không. Nếu thiếu -> trả về mã lỗi 401 Unauthorized.
 * 2. Giải mã và kiểm tra chữ ký số của token bằng `JWT_SECRET`.
 * 3. Đính kèm các thông tin định danh quan trọng (`x-user-id`, `x-user-role`) vào HTTP headers trước khi chuyển tiếp (reverse-proxy) tới các downstream microservices.
 * 4. Bắt ngoại lệ và trả về mã lỗi 403 Forbidden nếu token bị giả mạo hoặc đã hết hạn.
 * 
 * @param req Request HTTP đầu vào từ client
 * @param res Response HTTP gửi về client
 * @param next Hàm chuyển tiếp xử lý sang middleware/route tiếp theo
 */
export const gatewayAuthMiddleware = (
    req: GatewayRequest,
    res: Response,
    next: NextFunction
): Response | void => {
    // 1. Trích xuất Authorization Header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized: Thiếu hoặc sai định dạng token",
        });
    }

    // 2. Lấy chuỗi token nguyên bản
    const token = authHeader.split(" ")[1];

    try {
        const secret = process.env.JWT_SECRET || "fallback_secret";
        const decoded = jwt.verify(token, secret) as any;

        // Lưu trữ payload vào đối tượng request hiện tại
        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role,
        };

        // 3. Đính kèm thông tin user vào headers để forward sang Microservices nội bộ
        req.headers["x-user-id"] = decoded.userId;
        req.headers["x-user-role"] = decoded.role;

        // Tiếp tục chuỗi xử lý middleware
        next();
    } catch (error) {
        // 4. Token không hợp lệ, hết hạn hoặc sai bí mật mã hóa
        return res.status(403).json({
            success: false,
            message: "Forbidden: Token không hợp lệ hoặc đã hết hạn",
        });
    }
};