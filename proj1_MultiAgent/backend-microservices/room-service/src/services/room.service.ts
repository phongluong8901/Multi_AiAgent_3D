import { roomRepository } from "../repositories/room.repository";
import { IRoomMember } from "../models/room.model";

export class RoomService {
    async createRoom(data: { name: string; description?: string; maxCapacity?: number; initialMember?: IRoomMember }) {
        const members = data.initialMember ? [data.initialMember] : [];
        return await roomRepository.create({
            name: data.name,
            description: data.description,
            maxCapacity: data.maxCapacity || 10,
            members,
        });
    }

    async getAllRooms() {
        return await roomRepository.findAll();
    }

    async getRoomById(id: string) {
        const room = await roomRepository.findById(id);
        if (!room) throw new Error("Room not found");
        return room;
    }

    async addMemberToRoom(roomId: string, member: IRoomMember) {
        const room = await roomRepository.findById(roomId);
        if (!room) throw new Error("Room not found");

        // Kiểm tra xem thành viên đã có trong phòng chưa
        const exists = room.members.some((m) => m.memberId === member.memberId);
        if (exists) {
            throw new Error("Member is already in the room");
        }

        if (room.members.length >= room.maxCapacity) {
            throw new Error("Room has reached max capacity");
        }

        return await roomRepository.addMember(roomId, member);
    }

    async removeMemberFromRoom(roomId: string, memberId: string) {
        const room = await roomRepository.removeMember(roomId, memberId);
        if (!room) throw new Error("Room not found or member not in room");
        return room;
    }
}

export const roomService = new RoomService();