import { RoomModel, IRoom, IRoomMember } from "../models/room.model";

export class RoomRepository {
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

    async updateRoom(id: string, updateData: Partial<IRoom>): Promise<IRoom | null> {
        return await RoomModel.findByIdAndUpdate(id, { $set: updateData }, { new: true });
    }

    async updateActiveAgents(roomId: string, activeAgents: string[]): Promise<IRoom | null> {
        return await RoomModel.findByIdAndUpdate(
            roomId,
            { $set: { activeAgents } },
            { new: true }
        );
    }

    async addUserAgent(roomId: string, userAgent: any): Promise<IRoom | null> {
        return await RoomModel.findByIdAndUpdate(
            roomId,
            {
                $pull: { userAgents: { agentId: userAgent.agentId } },
            },
            { new: true }
        ).then(async (room) => {
            if (!room) return null;
            return await RoomModel.findByIdAndUpdate(
                roomId,
                {
                    $push: { userAgents: userAgent },
                    $addToSet: { activeAgents: userAgent.agentId },
                },
                { new: true }
            );
        });
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

    async removeUserAgent(roomId: string, agentId: string): Promise<IRoom | null> {
        return await RoomModel.findByIdAndUpdate(
            roomId,
            {
                $pull: { userAgents: { agentId } },
            },
            { new: true }
        );
    }

    async delete(id: string): Promise<boolean> {
        const result = await RoomModel.findByIdAndDelete(id);
        return result !== null;
    }
}

export const roomRepository = new RoomRepository();