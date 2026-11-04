// src/middlewares/async.middleware.ts
import { Request, Response, NextFunction } from "express";

// Wrapper bọc các controller bất đồng bộ để tự động chuyển lỗi về Error Handler trung tâm
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Sơ đồ tổng quan luồng chạy (Request Lifecycle)
// Khi Client gửi một request (ví dụ: POST /api/auth/register), luồng đi sẽ như sau:

// Client $\rightarrow$ Gửi HTTP Request tới Route.
// Route $\rightarrow$ Gọi hàm đã được bọc: asyncHandler(authController.register).
// asyncHandler $\rightarrow$ Thực thi authController.register.

// Controller / Service $\rightarrow$
// Thành công $\rightarrow$ Trả về JSON phản hồi cho Client.
// Thất bại (ném lỗi throw new ConflictError(...)) $\rightarrow$ Promise bị Rejected.

// asyncHandler bắt được lỗi ở .catch(next) $\rightarrow$ Gọi lệnh next(err).

// Express nhận next(err) $\rightarrow$ Bỏ qua các middleware bình thường và nhảy thẳng vào errorHandler.

// errorHandler $\rightarrow$ Lấy statusCode, message và trả về JSON lỗi chuẩn cho Client.