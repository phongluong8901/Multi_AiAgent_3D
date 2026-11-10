import { Schema, model, Document } from "mongoose";

// Định nghĩa vị trí địa lý tùy chọn để tối ưu tốc độ chia sẻ model AI theo khoảng cách
export interface ILocation {
    type: "Point";
    coordinates: [number, number]; // [Kinh độ - longitude, Vĩ độ - latitude]
}

// Định nghĩa cấu trúc giao diện (Interface) cho thông tin phần cứng node (Hardware Node) của người dùng
export interface IHardwareNode {
    cpuCores: number;                     // Số lượng lõi CPU của thiết bị
    deviceMemoryGB: number;               // Dung lượng bộ nhớ RAM của thiết bị (tính bằng GB)
    hasWebGPU: boolean;                   // Cờ xác định trình duyệt có hỗ trợ công nghệ WebGPU hay không
    gpuName?: string;                     // Tên card đồ họa (GPU) của thiết bị (tùy chọn)
    recommendedModels: string[];          // Danh sách tên các mô hình AI được khuyến nghị chạy trên phần cứng này
    canRunAI: boolean;                    // Cờ xác định thiết bị có đủ năng lực chạy mô hình AI cục bộ hay không
    status?: 'IDLE' | 'BUSY' | 'OFFLINE'; // Trạng thái hiện tại của node phần cứng (Đang rảnh, Đang bận, hoặc Ngoại tuyến)
    lastSeen?: Date;                      // Thời điểm gần nhất trình duyệt gửi tín hiệu / ping lên hệ thống
    updatedAt?: Date;                     // Thời gian cập nhật thông tin phần cứng gần nhất
}

export interface IUser extends Document {
    username: string;
    email: string;
    passwordHash?: string;
    googleId?: string; // Mã định danh tài khoản Google (dùng khi đăng nhập SSO Google)
    githubId?: string; // Mã định danh tài khoản GitHub (dùng khi đăng nhập SSO GitHub)
    githubUsername?: string; // Bổ sung thông tin tài khoản GitHub
    huggingfaceId?: string; // Mã định danh tài khoản Hugging Face (dùng khi đăng nhập SSO Hugging Face)
    huggingfaceUsername?: string; // Tên tài khoản Hugging Face
    role: "guest" | "user" | "admin" | "seller";
    avatarUrl?: string;
    bio?: string;  // Đoạn tiểu sử hoặc giới thiệu ngắn cá nhân
    status: "online" | "offline" | "busy"; // Trạng thái trực tuyến của tài khoản trên hệ thống
    ownedAgentIds: string[]; // Danh sách các mã định danh (ID) Agent mà người dùng này sở hữu
    isVerified: boolean; // Cờ xác thực tài khoản qua email (đã xác thực hay chưa)
    otpCode?: string; // Mã OTP dùng cho các xác thực tạm thời
    otpExpiresAt?: Date;
    refreshToken?: string;              // Lưu refresh token để quản lý phiên
    resetPasswordOtp?: string;          // OTP quên mật khẩu
    resetPasswordExpiresAt?: Date;      // Thời gian hết hạn OTP quên mật khẩu
    hardwareNode?: IHardwareNode;
    location?: ILocation;
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
    {
        username: { type: String, required: true, trim: true }, //trim: tự động cắt khoảng trắng thừa
        email: { type: String, required: true, unique: true, lowercase: true, trim: true }, //lowercase: tự động chuyển chữ thường 
        passwordHash: { type: String, required: false }, //pass word đã được mã hóa SHA-256
        googleId: { type: String, unique: true, sparse: true }, //ID từ tài khoản Google
        githubId: { type: String, unique: true, sparse: true }, //ID từ tài khoản GitHub
        githubUsername: { type: String, default: "" },
        huggingfaceId: { type: String, unique: true, sparse: true }, // ID từ tài khoản Hugging Face
        huggingfaceUsername: { type: String, default: "" },
        role: { type: String, enum: ["guest", "user", "admin", "seller"], default: "user" },
        avatarUrl: { type: String, default: "" },
        bio: { type: String, default: "" },
        status: { type: String, enum: ["online", "offline", "busy"], default: "offline" },
        ownedAgentIds: { type: [String], default: [] },
        isVerified: { type: Boolean, default: false },
        otpCode: { type: String, required: false },
        otpExpiresAt: { type: Date, required: false },
        refreshToken: { type: String, default: "" },
        resetPasswordOtp: { type: String, required: false },
        resetPasswordExpiresAt: { type: Date, required: false },
        // Cấu hình định vị địa lý (hỗ trợ Geospatial Index để tìm kiếm user ở gần)
        location: {
            type: { type: String, enum: ["Point"], default: "Point" },
            coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
        },
        hardwareNode: {
            cpuCores: { type: Number, default: 0 },
            deviceMemoryGB: { type: Number, default: 0 },
            hasWebGPU: { type: Boolean, default: false },
            gpuName: { type: String, default: "" },
            recommendedModels: { type: [String], default: [] },
            canRunAI: { type: Boolean, default: false },
            status: { type: String, enum: ['IDLE', 'BUSY', 'OFFLINE'], default: 'IDLE' },
            lastSeen: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now }
        },
    },
    { timestamps: true }
);
// Tạo index không gian địa lý (2dsphere index) để dễ dàng truy vấn tìm kiếm user ở gần
UserSchema.index({ location: "2dsphere" });

export const UserModel = model<IUser>("User", UserSchema);