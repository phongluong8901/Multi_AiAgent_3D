import { Schema, model, Document } from "mongoose";

export interface IHardwareNode {
    cpuCores: number;
    deviceMemoryGB: number;
    hasWebGPU: boolean;
    gpuName?: string;
    recommendedModels: string[];
    canRunAI: boolean;
    status?: 'IDLE' | 'BUSY' | 'OFFLINE'; // Trạng thái hiện tại của node
    lastSeen?: Date;                      // Lần cuối cùng trình duyệt gửi tín hiệu/ping lên
    updatedAt?: Date;
}

export interface IUser extends Document {
    username: string;
    email: string;
    passwordHash?: string;
    googleId?: string;
    githubId?: string;
    role: "admin" | "employee" | "guest";
    avatarUrl?: string;
    bio?: string;
    status: "online" | "offline" | "busy";
    ownedAgentIds: string[];
    isVerified: boolean;
    otpCode?: string;
    otpExpiresAt?: Date;
    refreshToken?: string;              // Lưu refresh token để quản lý phiên
    resetPasswordOtp?: string;          // OTP quên mật khẩu
    resetPasswordExpiresAt?: Date;      // Thời gian hết hạn OTP quên mật khẩu
    createdAt: Date;
    updatedAt: Date;
    hardwareNode?: IHardwareNode;
}

const UserSchema = new Schema<IUser>(
    {
        username: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        passwordHash: { type: String, required: false },
        googleId: { type: String, unique: true, sparse: true },
        githubId: { type: String, unique: true, sparse: true },
        role: { type: String, enum: ["admin", "employee", "guest"], default: "employee" },
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

export const UserModel = model<IUser>("User", UserSchema);