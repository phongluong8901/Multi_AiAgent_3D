import { Schema, model, Document } from "mongoose";

/** Cấu trúc dữ liệu cho tệp đính kèm (Hình ảnh, CSV, Excel, PDF,...) */
export interface IAttachment {
    fileUrl: string;
    fileName: string;
    fileType: "image" | "csv" | "xlsx" | "pdf" | "other";
    fileSize?: number;
}

/** Cấu trúc dữ liệu thành viên trong phòng (User hoặc Agent) */
export interface IRoomMember {
    memberId: string;
    memberType: "user" | "agent"; // Phân biệt đây là Người dùng hay là Agent AI
    role: "owner" | "admin" | "participant" | "observer"; // Phân quyền: Chủ phòng, Quản trị viên phụ (như Zalo), Thành viên, Người xem
    name?: string;
    color?: string;
    avatar?: string;
    status?: string; // Trạng thái hoạt động
    joinedAt?: Date; // Thời điểm thành viên bắt đầu tham gia phòng
}

/** Lời mời đang chờ Accept */
export interface IPendingInvite {
    userId: string;
    userName?: string;
    invitedBy: string;
    invitedAt?: Date;
}

/** Cấu hình vận hành phòng làm việc & điều phối Agent */
export interface IRoomSettings {
    allowCrossCommands?: boolean; // Cho phép các Agent gọi chéo lệnh của nhau hay không
    autonomousHandoff?: boolean; // Cho phép Agent tự động bàn giao/chuyển tiếp công việc
    maxAutoTurns?: number; // Số lượt Auto-play tối đa trước khi cần con người can thiệp
    allowGuestJoin?: boolean; // Cho phép người lạ tham gia phòng (dạng Public Group)
}

/** Liên kết gán Agent cá nhân cho từng User cụ thể trong phòng */
export interface IUserAgentBinding {
    userId: string;
    userName: string;
    userColor?: string; // Mã màu nhận diện User
    agentId: string;
    agentName?: string;
    assignedAt?: Date; // Thời điểm gán Agent cho User
}

/** Chính sách phân cấp và hạn ngạch tài nguyên của phòng */
export interface IRoomPolicy {
    tier?: "standard" | "premium" | "enterprise";
    isPublic?: boolean; // Phòng công khai (ai cũng tìm thấy) hay riêng tư
    password?: string;
    maxActiveAgents?: number; // Số lượng Agent hệ thống tối đa hoạt động cùng lúc
    ownedAgentsCount?: number; // Số lượng Agent cá nhân tối đa mà người dùng được gán/sở hữu trong phòng
}

/** Chế độ thực thi workflow của các Agent trong phòng */
export type AgentWorkflowMode = "solo" | "sequential" | "routing" | "autonomous";

/** Quy tắc chuyển tiếp giữa các Agent khi ở chế độ routing */
export interface IWorkflowTransition {
    fromAgentId: string; // ID của Agent nguồn
    toAgentId: string;   // ID của Agent đích (hoặc 'end' nếu kết thúc luồng)
    condition?: string;  // Điều kiện / ghi chú nhiệm vụ bàn giao
}

/** Cấu hình Workflow Agent trong phòng làm việc */
export interface IAgentWorkflow {
    mode: AgentWorkflowMode; // 'solo': chạy đơn lẻ, 'sequential': tuần tự, 'routing': định tuyến quy tắc, 'autonomous': tự do
    order?: string[]; // Danh sách agent theo chuỗi tuần tự khi mode === 'sequential'
    stepTools?: Record<string, string>; // Công cụ chỉ định cho từng bước tuần tự (ví dụ: { "0": "web_search_tool" })
    agentTools?: Record<string, string[]>; // Danh sách công cụ được kích hoạt cho từng agent trong phòng
    transitions?: IWorkflowTransition[]; // Danh sách các bước chuyển tiếp khi mode === 'routing'
    enabled?: boolean; // Bật/tắt cấu hình workflow
    description?: string; // Ghi chú mục đích của workflow
}

/** Interface tổng thể của Document Room trong MongoDB */
export interface IRoom extends Document {
    name: string;
    description?: string;
    ownerId: string; // ID của Trưởng nhóm / Chủ phòng
    maxCapacity: number; // Sức chứa thành viên tối đa trong phòng
    policy: IRoomPolicy;
    members: IRoomMember[]; // Danh sách tất cả thành viên trong phòng
    pendingInvites: IPendingInvite[];
    activeAgents: string[]; // Danh sách các Agent hệ thống đang bật hoạt động trong phòng
    userAgents: IUserAgentBinding[]; // Danh sách các Agent cá nhân được gán cho từng User cụ thể trong phòng
    settings: IRoomSettings;
    workflow?: IAgentWorkflow; // Cấu hình workflow điều phối Agent trong phòng
    metadata?: Record<string, any>; // Dữ liệu metadata tuỳ chỉnh của phòng
    createdAt: Date;
    updatedAt: Date;
}

const RoomSchema = new Schema<IRoom>(
    {
        // Tên phòng: Bắt buộc, tự động trim khoảng trắng thừa 2 đầu
        name: { type: String, required: true, trim: true },

        // Mô tả phòng: Mặc định là chuỗi rỗng
        description: { type: String, default: "" },

        // ID Chủ phòng: Bắt buộc có, đánh Index để tìm nhanh danh sách phòng do 1 user làm chủ
        ownerId: { type: String, required: true, index: true },

        // Giới hạn số lượng thành viên tối đa (Mặc định 20 người)
        maxCapacity: { type: Number, default: 20 },

        // Chính sách phân cấp phòng và hạn ngạch Agent
        policy: {
            tier: { type: String, enum: ["standard", "premium", "enterprise"], default: "standard" }, // Gói dịch vụ
            isPublic: { type: Boolean, default: true },      // Mặc định phòng công khai
            password: { type: String, default: "" },      // Mật khẩu phòng (nếu là private)
            maxActiveAgents: { type: Number, default: 10 },   // Tối đa 10 Agent hệ thống
            ownedAgentsCount: { type: Number, default: 3 },  // Tối đa 3 Agent cá nhân gán cho User
        },

        // Mảng chứa danh sách ID các System Agent mặc định khi khởi tạo phòng
        activeAgents: {
            type: [String],
            default: ["agent_manager", "agent_ml", "agent_analyst", "agent_search", "agent_summarizer"],
        },

        // Mảng lưu trữ danh sách các Agent cá nhân đã gán cho từng User
        userAgents: [
            {
                userId: { type: String, required: true },
                userName: { type: String, required: true },
                userColor: { type: String, default: "#3b82f6" },
                agentId: { type: String, required: true },
                agentName: { type: String, default: "" },
                assignedAt: { type: Date, default: Date.now }, // Tự động lưu thời điểm gán
            },
        ],

        // Cài đặt hành vi giao tiếp & phân quyền khách
        settings: {
            allowCrossCommands: { type: Boolean, default: true }, // Cho phép giao tiếp chéo giữa các agent
            autonomousHandoff: { type: Boolean, default: true },  // Cho phép chuyển tiếp công việc
            maxAutoTurns: { type: Number, default: 3 },           // Giới hạn 3 vòng phản hồi tự động
            allowGuestJoin: { type: Boolean, default: false },    // Mặc định không cho khách tự do vào
        },

        // Cấu hình quy trình Workflow Agent của phòng (Đơn lẻ / Tuần tự / Định tuyến / Tự do)
        workflow: {
            mode: {
                type: String,
                enum: ["solo", "sequential", "routing", "autonomous"],
                default: "autonomous",
            },
            order: { type: [String], default: [] },
            stepTools: { type: Schema.Types.Mixed, default: {} },
            agentTools: { type: Schema.Types.Mixed, default: {} },
            transitions: [
                {
                    fromAgentId: { type: String, required: true },
                    toAgentId: { type: String, required: true },
                    condition: { type: String, default: "" },
                },
            ],
            enabled: { type: Boolean, default: false },
            description: { type: String, default: "" },
        },

        // Danh sách thành viên (User & Agent) kèm phân quyền chuẩn nhóm Zalo
        members: [
            {
                memberId: { type: String, required: true },
                memberType: { type: String, enum: ["user", "agent"], required: true }, // Phân loại User / Agent
                role: {
                    type: String,
                    enum: ["owner", "admin", "participant", "observer"],
                    default: "participant" // Quyền hạn: Chủ phòng, Admin phụ, Thành viên, Quan sát viên
                },
                name: { type: String, default: "" },
                color: { type: String, default: "#3b82f6" },
                avatar: { type: String, default: "" },
                status: { type: String, default: "idle" },
                joinedAt: { type: Date, default: Date.now }, // Thời điểm gia nhập
            },
        ],
        // Lời mời chờ Accept
        pendingInvites: [
            {
                userId: { type: String, required: true },
                userName: { type: String, default: "" },
                invitedBy: { type: String, required: true },
                invitedAt: { type: Date, default: Date.now },
            },
        ],

        // Metadata dạng Map mở rộng linh hoạt dữ liệu không định hình
        metadata: { type: Map, of: Schema.Types.Mixed, default: {} },
    },
    {
        timestamps: true // Tự động thêm 2 trường `createdAt` và `updatedAt` vào database
    }
);

// Full-text search index cho tên và mô tả phòng (Phục vụ chức năng tìm kiếm phòng)
RoomSchema.index({ name: "text", description: "text" });

// Single field index trên `members.memberId` giúp tìm nhanh danh sách tất cả các phòng mà 1 User/Agent đang tham gia
RoomSchema.index({ "members.memberId": 1 });

export const RoomModel = model<IRoom>("Room", RoomSchema, "rooms");

// 1. Collection chuyên lưu cấu trúc phòng & thành viên Người dùng (User-User Track)
export const UserUserRoomModel = model<IRoom>("UserUserRoom", RoomSchema, "rooms_user_user");

// 2. Collection chuyên lưu cấu hình & trạng thái Agent trong phòng (Agent-Agent Track)
export const AgentAgentRoomModel = model<IRoom>("AgentAgentRoom", RoomSchema, "rooms_agent_agent");

// 3. Collection chuyên lưu liên kết gán Agent cá nhân cho User (User-Agent Track)
export const UserAgentRoomModel = model<IRoom>("UserAgentRoom", RoomSchema, "rooms_user_agent");