import mongoose, { Document, Schema } from "mongoose";

export interface IPlanTaskDefinition {
    code: string;
    title: string;
    description: string;
    category: "map_creation" | "iot_devices" | "robotics" | "engagement";
    rewardCoins: number;
    icon: string;
    targetCount: number;
    unit: string;
}

export const SYSTEM_PLAN_TASKS: IPlanTaskDefinition[] = [
    {
        code: "TASK_CREATE_MAP",
        title: "Kiến Trúc Sư Không Gian 3D",
        description: "Vẽ và lưu trữ thành công 1 bản đồ 3D mới lên Cloud",
        category: "map_creation",
        rewardCoins: 50,
        icon: "🗺️",
        targetCount: 1,
        unit: "bản đồ",
    },
    {
        code: "TASK_PLACE_LED",
        title: "Kỹ Sư Chiếu Sáng IoT",
        description: "Đặt thiết bị đèn Smart LED hoặc đèn đường thông minh vào bản đồ",
        category: "iot_devices",
        rewardCoins: 15,
        icon: "💡",
        targetCount: 3,
        unit: "thiết bị",
    },
    {
        code: "TASK_PLACE_ROBOT",
        title: "Chuyên Gia Robotics & Tự Hành",
        description: "Bố trí xe AMR, Vịt Rubber Duck hoặc Cyber Drone vào thế giới 3D",
        category: "robotics",
        rewardCoins: 30,
        icon: "🤖",
        targetCount: 2,
        unit: "robot",
    },
    {
        code: "TASK_SMARTHOME_SETUP",
        title: "Chủ Nhân Biệt Thự Smart Home",
        description: "Lắp đặt rèm cửa thông minh, vòi tưới tự động hoặc điều hòa",
        category: "iot_devices",
        rewardCoins: 25,
        icon: "🏠",
        targetCount: 2,
        unit: "thiết bị",
    },
    {
        code: "TASK_FACTORY_BUILDER",
        title: "Kỹ Sư Nhà Máy Công Nghiệp 4.0",
        description: "Bố trí băng chuyền hoặc cánh tay robot công nghiệp vào xưởng",
        category: "robotics",
        rewardCoins: 40,
        icon: "🏭",
        targetCount: 2,
        unit: "linh kiện",
    },
    {
        code: "TASK_DAILY_CHECKIN",
        title: "Điểm Danh Sáng Tạo Hàng Ngày",
        description: "Đăng nhập và truy cập Map Studio / Agent Store mỗi ngày",
        category: "engagement",
        rewardCoins: 20,
        icon: "⚡",
        targetCount: 1,
        unit: "lần",
    },
];

export interface IUserTaskProgress extends Document {
    userId: string;
    taskCode: string;
    progress: number;
    targetCount: number;
    completed: boolean;
    claimed: boolean;
    lastClaimedAt?: Date;
}

const UserTaskProgressSchema = new Schema<IUserTaskProgress>(
    {
        userId: { type: String, required: true, index: true },
        taskCode: { type: String, required: true, index: true },
        progress: { type: Number, default: 0 },
        targetCount: { type: Number, required: true },
        completed: { type: Boolean, default: false },
        claimed: { type: Boolean, default: false },
        lastClaimedAt: { type: Date },
    },
    { timestamps: true }
);

UserTaskProgressSchema.index({ userId: 1, taskCode: 1 }, { unique: true });

export const UserTaskProgressModel = mongoose.model<IUserTaskProgress>(
    "UserTaskProgress",
    UserTaskProgressSchema
);
