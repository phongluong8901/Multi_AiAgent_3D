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

    async delete(id: string): Promise<boolean> {
        const result = await RoomModel.findByIdAndDelete(id);
        return result !== null;
    }
}

export const roomRepository = new RoomRepository();