import { RoomModel, IRoom, IRoomMember, IUserAgentBinding } from "../models/room.model";

export class RoomRepository {
    // --- 1. CRUD CƠ BẢN ---

    async create(roomData: Partial<IRoom>): Promise<IRoom> {
        const room = new RoomModel(roomData);
        return await room.save();
    }

    async findAll(): Promise<IRoom[]> {
        return await RoomModel.find();
    }

    async findById(id: string): Promise<IRoom | null> {
        return await RoomModel.findById(id);
    }

    async updateRoom(id: string, updateData: Partial<IRoom>): Promise<IRoom | null> {
        return await RoomModel.findByIdAndUpdate(id, { $set: updateData }, { new: true });
    }

    async delete(id: string): Promise<boolean> {
        const result = await RoomModel.findByIdAndDelete(id);
        return result !== null;
    }

    // --- BỔ SUNG MỚI: Tìm phòng theo Chủ phòng (Owner) ---
    async findByOwner(ownerId: string): Promise<IRoom[]> {
        return await RoomModel.find({ ownerId });
    }

    // --- 2. QUẢN LÝ THÀNH VIÊN (USER-USER TRACK) ---

    async addMember(roomId: string, member: IRoomMember): Promise<IRoom | null> {
        return await RoomModel.findByIdAndUpdate(
            roomId,
            { $push: { members: member } },
            { new: true }
        );
    }

    async removeMember(roomId: string, memberId: string): Promise<IRoom | null> {
        return await RoomModel.findByIdAndUpdate(
            roomId,
            { $pull: { members: { memberId } } },
            { new: true }
        );
    }

    // --- BỔ SUNG MỚI: Cập nhật quyền hạn thành viên (Owner / Admin / Participant / Observer) giống Zalo ---
    async updateMemberRole(roomId: string, memberId: string, role: "owner" | "admin" | "participant" | "observer"): Promise<IRoom | null> {
        return await RoomModel.findOneAndUpdate(
            { _id: roomId, "members.memberId": memberId },
            { $set: { "members.$.role": role } },
            { new: true }
        );
    }

    // --- 3. QUẢN LÝ AGENT (AGENT-AGENT TRACK) ---

    async updateActiveAgents(roomId: string, activeAgents: string[]): Promise<IRoom | null> {
        return await RoomModel.findByIdAndUpdate(
            roomId,
            { $set: { activeAgents } },
            { new: true }
        );
    }

    async addAgent(roomId: string, agentId: string): Promise<IRoom | null> {
        return await RoomModel.findByIdAndUpdate(
            roomId,
            { $addToSet: { activeAgents: agentId } },
            { new: true }
        );
    }

    async removeAgent(roomId: string, agentId: string): Promise<IRoom | null> {
        return await RoomModel.findByIdAndUpdate(
            roomId,
            {
                $pull: { activeAgents: agentId, userAgents: { agentId } },
            },
            { new: true }
        );
    }

    // --- 4. QUẢN LÝ USER-AGENT BINDINGS (USER-AGENT TRACK) ---

    async addUserAgent(roomId: string, userAgent: IUserAgentBinding): Promise<IRoom | null> {
        // Xóa agent cũ nếu đã tồn tại trong mảng userAgents, sau đó push agent mới và thêm vào activeAgents
        await RoomModel.findByIdAndUpdate(
            roomId,
            { $pull: { userAgents: { agentId: userAgent.agentId } } }
        );

        return await RoomModel.findByIdAndUpdate(
            roomId,
            {
                $push: { userAgents: userAgent },
                $addToSet: { activeAgents: userAgent.agentId },
            },
            { new: true }
        );
    }

    async removeUserAgent(roomId: string, agentId: string): Promise<IRoom | null> {
        return await RoomModel.findByIdAndUpdate(
            roomId,
            {
                $pull: { userAgents: { agentId } },
            },
            { new: true }
        );
    }
}

export const roomRepository = new RoomRepository();