// Định nghĩa và export lớp AppError kế thừa từ lớp Error chuẩn của JavaScript
export class AppError extends Error {
    public statusCode: number; // Khai báo thuộc tính công khai lưu mã trạng thái HTTP (ví dụ: 400, 404, 500)

    // Hàm khởi tạo (constructor) nhận thông điệp lỗi và mã trạng thái (mặc định là 400 nếu không truyền)
    constructor(message: string, statusCode: number = 400) {
        super(message); // Gọi constructor của lớp cha (Error) để truyền thông điệp lỗi
        this.statusCode = statusCode; // Gán mã trạng thái cho thuộc tính statusCode của đối tượng hiện tại
        this.name = "AppError"; // Gán tên lớp vào thuộc tính name để dễ dàng nhận diện loại lỗi
        Error.captureStackTrace(this, this.constructor); // Thiết lập stack trace để theo dõi lỗi chính xác
    }
}

/** Ngoại lệ dùng khi dữ liệu người dùng gửi lên không hợp lệ (Mã HTTP 400) */
export class BadRequestError extends AppError {
    constructor(message: string = "Dữ liệu yêu cầu không hợp lệ.") {
        super(message, 400);
        this.name = "BadRequestError";
    }
}

/** Ngoại lệ dùng khi người dùng chưa xác thực hoặc token không hợp lệ/hết hạn (Mã HTTP 401) */
export class UnauthorizedError extends AppError {
    constructor(message: string = "Xác thực không thành công hoặc phiên đăng nhập đã hết hạn.") {
        super(message, 401);
        this.name = "UnauthorizedError";
    }
}

/** Ngoại lệ dùng khi người dùng không đủ quyền hạn để truy cập tài nguyên (Mã HTTP 403) */
export class ForbiddenError extends AppError {
    constructor(message: string = "Bạn không có quyền thực hiện hành động này.") {
        super(message, 403);
        this.name = "ForbiddenError";
    }
}

/** Ngoại lệ dùng khi không tìm thấy tài nguyên trong cơ sở dữ liệu (Mã HTTP 404) */
export class NotFoundError extends AppError {
    constructor(message: string = "Không tìm thấy tài nguyên yêu cầu.") {
        super(message, 404);
        this.name = "NotFoundError";
    }
}

/** Ngoại lệ dùng khi xảy ra xung đột dữ liệu, ví dụ trùng lặp email hoặc tên tài khoản (Mã HTTP 409) */
export class ConflictError extends AppError {
    constructor(message: string = "Dữ liệu bị xung đột hoặc đã tồn tại trong hệ thống.") {
        super(message, 409);
        this.name = "ConflictError";
    }
}

/** Ngoại lệ dùng cho các lỗi liên quan đến quá nhiều yêu cầu trong thời gian ngắn (Mã HTTP 429) */
export class TooManyRequestsError extends AppError {
    constructor(message: string = "Quá nhiều yêu cầu được gửi lên, vui lòng thử lại sau.") {
        super(message, 429);
        this.name = "TooManyRequestsError";
    }
}
