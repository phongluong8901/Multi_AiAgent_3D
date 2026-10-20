// Định nghĩa cấu trúc dữ liệu đầu vào khi người dùng thực hiện đăng ký tài khoản
export interface RegisterInput {
    username: string;
    email: string;
    password: string;
    role?: "guest" | "user" | "admin" | "seller";
}

// Định nghĩa cấu trúc dữ liệu đầu vào khi người dùng thực hiện yêu cầu đăng nhập
export interface LoginInput {
    email: string;
    password: string;
}

// Định nghĩa cấu trúc dữ liệu cho phép tùy chọn cập nhật thông tin hồ sơ cá nhân
export interface UpdateProfileInput {
    username?: string;
    name?: string;
    avatarUrl?: string;
    bio?: string;
}

// Định nghĩa cấu trúc dữ liệu người dùng được trích xuất từ tài khoản Google
export interface GooglePayloadUser {
    googleId: string;
    email: string;
    name: string;
    avatarUrl: string;
}

// Định nghĩa cấu trúc dữ liệu người dùng được trích xuất từ tài khoản GitHub khi thực hiện xác thực OAuth
export interface GithubPayloadUser {
    githubId: string;       // Mã định danh duy nhất (ID) của tài khoản trên hệ thống GitHub
    githubUsername: string; // Tên đăng nhập (login/username) của tài khoản GitHub
    email: string;          // Địa chỉ email chính thức của tài khoản GitHub
    name: string;           // Tên hiển thị đầy đủ trên GitHub (nếu có)
    avatarUrl: string;      // Đường dẫn URL ảnh đại diện gốc lấy từ GitHub
}

// jwt token types
export interface TokenPayload {
    userId: string;
    email: string;
    role: string;
}

export interface RefreshTokenPayload {
    userId: string;
    deviceId?: string; // Thêm trường này để TypeScript không báo lỗi
    [key: string]: any;
}