import {
    RoomModel,
    UserUserRoomModel,
    AgentAgentRoomModel,
    UserAgentRoomModel,
    IRoom,
    IRoomMember,
    IUserAgentBinding
} from "../models/room.model"; // Import Mongoose models và các TypeScript interface liên quan

export class RoomRepository {
    // --- 1. CRUD CƠ BẢN ---

    // Hàm tạo mới một phòng chat trong cơ sở dữ liệu và đồng bộ vào các collection chuyên biệt
    async create(roomData: Partial<IRoom>): Promise<IRoom> {
        const room = new RoomModel(roomData); // Khởi tạo instance document mới của Mongoose
        const saved = await room.save();       // Lưu vào MongoDB collection rooms

        // Đồng bộ bản ghi cấu trúc sang collection rooms_user_user
        try {
            await UserUserRoomModel.create(saved.toObject ? saved.toObject() : saved);
        } catch (_) {}

        return saved;
    }

    // Hàm lấy danh sách toàn bộ các phòng có trong hệ thống
    async findAll(): Promise<IRoom[]> {
        return await RoomModel.find();
    }

    // Hàm tìm kiếm một phòng cụ thể thông qua ID của phòng
    async findById(id: string): Promise<IRoom | null> {
        return await RoomModel.findById(id);
    }

    // Hàm cập nhật thông tin chung của phòng dựa vào ID
    async updateRoom(id: string, updateData: Partial<IRoom>): Promise<IRoom | null> {
        // Dùng toán tử $set để cập nhật các trường được truyền lên, trả về bản ghi sau khi đã update ({ new: true })
        return await RoomModel.findByIdAndUpdate(id, { $set: updateData }, { new: true });
    }

    // Hàm xóa phòng khỏi cơ sở dữ liệu theo ID
    async delete(id: string): Promise<boolean> {
        const result = await RoomModel.findByIdAndDelete(id);
        return result !== null; // Trả về true nếu xóa thành công (tìm thấy và xóa), ngược lại trả về false
    }

    // --- BỔ SUNG MỚI: Tìm phòng theo Chủ phòng (Owner) ---
    async findByOwner(ownerId: string): Promise<IRoom[]> {
        return await RoomModel.find({ ownerId }); // Truy vấn tất cả phòng có ownerId khớp với tham số truyền vào
    }

    // --- 2. QUẢN LÝ THÀNH VIÊN (USER-USER TRACK) ---

    async addMember(roomId: string, member: IRoomMember): Promise<IRoom | null> {
        // Bước 1: Thử cập nhật nếu thành viên đã tồn tại sẵn trong mảng members (dùng toán tử positional $)
        const updatedExisting = await RoomModel.findOneAndUpdate(
            { _id: roomId, "members.memberId": member.memberId }, // Điều kiện tìm phòng và tìm đúng phần tử trong mảng
            {
                $set: {
                    "members.$": { // Dấu $ đại diện cho phần tử mảng tìm thấy ở điều kiện trên
                        ...member,
                        joinedAt: member.joinedAt || new Date() // Giữ nguyên ngày tham gia hoặc gán mới nếu chưa có
                    }
                }
            },
            { new: true }
        );

        if (updatedExisting) {
            return updatedExisting; // Nếu đã tồn tại và update thành công thì trả về luôn
        }

        // Bước 2: Nếu chưa tồn tại trong phòng, thực hiện push thành viên mới vào cuối mảng members
        return await RoomModel.findByIdAndUpdate(
            roomId,
            {
                $push: {
                    members: {
                        ...member,
                        joinedAt: member.joinedAt || new Date()
                    }
                }
            },
            { new: true }
        );
    }

    // Hàm xóa một thành viên ra khỏi phòng dựa vào memberId
    async removeMember(roomId: string, memberId: string): Promise<IRoom | null> {
        return await RoomModel.findByIdAndUpdate(
            roomId,
            { $pull: { members: { memberId } } }, // Dùng toán tử $pull để lọc bỏ phần tử khỏi mảng
            { new: true }
        );
    }

    // --- BỔ SUNG MỚI: Cập nhật quyền hạn thành viên (Owner / Admin / Participant / Observer) giống Zalo ---
    async updateMemberRole(roomId: string, memberId: string, role: "owner" | "admin" | "participant" | "observer"): Promise<IRoom | null> {
        return await RoomModel.findOneAndUpdate(
            { _id: roomId, "members.memberId": memberId }, // Tìm phòng và đúng thành viên cần đổi quyền
            { $set: { "members.$.role": role } },          // Cập nhật giá trị trường role của phần tử đó
            { new: true }
        );
    }

    // --- 3. QUẢN LÝ AGENT (AGENT-AGENT TRACK) ---

    // Hàm ghi đè toàn bộ danh sách agent đang hoạt động trong phòng
    async updateActiveAgents(roomId: string, activeAgents: string[]): Promise<IRoom | null> {
        const updated = await RoomModel.findByIdAndUpdate(
            roomId,
            { $set: { activeAgents } },
            { new: true }
        );
        // Đồng bộ sang collection chuyên biệt rooms_agent_agent
        AgentAgentRoomModel.findByIdAndUpdate(roomId, { $set: { activeAgents } }, { upsert: true }).catch(() => {});
        return updated;
    }

    // Hàm thêm một agent vào danh sách activeAgents (dùng $addToSet để tránh bị trùng lặp)
    async addAgent(roomId: string, agentId: string): Promise<IRoom | null> {
        const updated = await RoomModel.findByIdAndUpdate(
            roomId,
            { $addToSet: { activeAgents: agentId } }, // Chỉ thêm vào mảng nếu agentId chưa tồn tại trước đó
            { new: true }
        );
        AgentAgentRoomModel.findByIdAndUpdate(roomId, { $addToSet: { activeAgents: agentId } }, { upsert: true }).catch(() => {});
        return updated;
    }

    // Hàm gỡ bỏ một agent khỏi phòng (xóa cả trong activeAgents lẫn danh sách liên kết userAgents)
    async removeAgent(roomId: string, agentId: string): Promise<IRoom | null> {
        const updated = await RoomModel.findByIdAndUpdate(
            roomId,
            {
                $pull: { activeAgents: agentId, userAgents: { agentId } }, // Xóa đồng thời ở cả 2 mảng
            },
            { new: true }
        );
        AgentAgentRoomModel.findByIdAndUpdate(roomId, { $pull: { activeAgents: agentId } }).catch(() => {});
        return updated;
    }

    // --- 4. QUẢN LÝ USER-AGENT BINDINGS (USER-AGENT TRACK) ---

    async addUserAgent(roomId: string, userAgent: IUserAgentBinding): Promise<IRoom | null> {
        // Bước 1: Xóa agent cũ nếu đã tồn tại trong mảng userAgents để tránh bị trùng lặp cấu hình binding
        await RoomModel.findByIdAndUpdate(
            roomId,
            { $pull: { userAgents: { agentId: userAgent.agentId } } }
        );

        // Bước 2: Push binding mới vào mảng userAgents và đồng thời đưa agentId vào activeAgents
        const updated = await RoomModel.findByIdAndUpdate(
            roomId,
            {
                $push: { userAgents: userAgent },
                $addToSet: { activeAgents: userAgent.agentId },
            },
            { new: true }
        );
        // Đồng bộ sang collection chuyên biệt rooms_user_agent
        UserAgentRoomModel.findByIdAndUpdate(
            roomId,
            {
                $push: { userAgents: userAgent },
                $addToSet: { activeAgents: userAgent.agentId },
            },
            { upsert: true }
        ).catch(() => {});
        return updated;
    }

    // Hàm gỡ bỏ liên kết user-agent binding khỏi phòng
    async removeUserAgent(roomId: string, agentId: string): Promise<IRoom | null> {
        const updated = await RoomModel.findByIdAndUpdate(
            roomId,
            {
                $pull: { userAgents: { agentId } },
            },
            { new: true }
        );
        UserAgentRoomModel.findByIdAndUpdate(roomId, { $pull: { userAgents: { agentId } } }).catch(() => {});
        return updated;
    }

    // --- 5. QUẢN LÝ LỜI MỜI (INVITES) ---

    async addInvite(roomId: string, invite: {
        userId: string; userName?: string; invitedBy: string
    }) {
        // Bước 1: Xóa bỏ lời mời cũ của cùng một userId (nếu có) để tránh bị lặp bản ghi pending
        await RoomModel.findByIdAndUpdate(roomId, {
            $pull: { pendingInvites: { userId: invite.userId } },
        });

        // Bước 2: Thêm mới lời mời vào mảng pendingInvites
        return RoomModel.findByIdAndUpdate(
            roomId,
            {
                $push: {
                    pendingInvites: {
                        userId: invite.userId,
                        userName: invite.userName || "",
                        invitedBy: invite.invitedBy,
                        invitedAt: new Date(),
                    },
                },
            },
            { new: true }
        );
    }

    // Hàm hủy bỏ/xóa lời mời theo roomId và userId được mời
    async removeInvite(roomId: string, userId: string) {
        return RoomModel.findByIdAndUpdate(
            roomId,
            { $pull: { pendingInvites: { userId } } },
            { new: true }
        );
    }

    // Hàm tìm kiếm tất cả các lời mời đang chờ xử lý của một user cụ thể trên hệ thống
    async findInvitesForUser(userId: string) {
        return RoomModel.find({ "pendingInvites.userId": userId })
            .select("name description ownerId pendingInvites maxCapacity members") // Chỉ chọn lấy các trường dữ liệu cần thiết
            .lean(); // Trả về dạng Plain JavaScript Object (tối ưu hiệu năng, không tạo Mongoose Document wrappers)
    }
}

export const roomRepository = new RoomRepository(); // Khởi tạo và xuất ra một singleton instance để sử dụng chung khắp project