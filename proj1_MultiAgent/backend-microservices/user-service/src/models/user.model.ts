import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
    username: string;
    email: string;
    passwordHash?: string;
    googleId?: string;
    role: "admin" | "employee" | "guest";
    avatarUrl?: string;
    bio?: string;
    status: "online" | "offline" | "busy";
    ownedAgentIds: string[];  // List of agent IDs from agent-service
    isVerified: boolean;      // Trạng thái kích hoạt tài khoản
    otpCode?: string;         // Mã OTP xác thực
    otpExpiresAt?: Date;      // Thời gian hết hạn của mã OTP
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
    {
        username: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        passwordHash: { type: String, required: false },
        googleId: { type: String, unique: true, sparse: true },
        role: { type: String, enum: ["admin", "employee", "guest"], default: "employee" },
        avatarUrl: { type: String, default: "" },
        bio: { type: String, default: "" },
        status: { type: String, enum: ["online", "offline", "busy"], default: "offline" },
        ownedAgentIds: { type: [String], default: [] },
        isVerified: { type: Boolean, default: false }, // Mặc định tài khoản đăng ký mới là chưa kích hoạt
        otpCode: { type: String, required: false },
        otpExpiresAt: { type: Date, required: false },
    },
    { timestamps: true }
);

export const UserModel = model<IUser>("User", UserSchema);