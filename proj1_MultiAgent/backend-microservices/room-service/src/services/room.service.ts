import { roomRepository } from "../repositories/room.repository";
import { IRoom, IRoomMember, IRoomSettings } from "../models/room.model";
import { publishRoomEvent } from "../events/producers";

export class RoomService {
    async createRoom(data: {
        name: string;
        description?: string;
        maxCapacity?: number;
        activeAgents?: string[];
        settings?: Partial<IRoomSettings>;
        initialMember?: IRoomMember;
    }) {
        const members = data.initialMember ? [data.initialMember] : [];
        const defaultAgents = [
            "agent_manager",
            "agent_ml",
            "agent_analyst",
            "agent_search",
            "agent_summarizer",
        ];

        const room = await roomRepository.create({
            name: data.name,
            description: data.description || "",
            maxCapacity: data.maxCapacity || 20,
            activeAgents: data.activeAgents && data.activeAgents.length > 0 ? data.activeAgents : defaultAgents,
            settings: {
                allowCrossCommands: data.settings?.allowCrossCommands ?? true,
                autonomousHandoff: data.settings?.autonomousHandoff ?? true,
                maxAutoTurns: data.settings?.maxAutoTurns ?? 3,
            },
            members,
        });

        await publishRoomEvent("room.created", { roomId: (room as any)._id?.toString(), name: room.name });
        return room;
    }

    async getAllRooms() {
        let rooms = await roomRepository.findAll();
        // Tự động khởi tạo phòng mặc định nếu database chưa có phòng nào
        if (rooms.length === 0) {
            const defaultRoom = await this.createRoom({
                name: "Virtual Office Team HQ",
                description: "Không gian làm việc chung 3D kết nối toàn bộ Agent và Team",
                maxCapacity: 30,
                activeAgents: [
                    "agent_manager",
                    "agent_ml",
                    "agent_analyst",
                    "agent_search",
                    "agent_summarizer",
                ],
            });
            rooms = [defaultRoom];
        }
        return rooms;
    }

    async getRoomById(id: string) {
        const room = await roomRepository.findById(id);
        if (!room) throw new Error("Room not found");
        return room;
    }

    async updateRoom(id: string, updateData: {
        name?: string;
        description?: string;
        maxCapacity?: number;
        settings?: IRoomSettings;
    }) {
        const updated = await roomRepository.updateRoom(id, updateData as Partial<IRoom>);
        if (!updated) throw new Error("Room not found");
        await publishRoomEvent("room.updated", { roomId: id, name: updated.name });
        return updated;
    }

    async syncActiveAgents(roomId: string, activeAgents: string[]) {
        const updated = await roomRepository.updateActiveAgents(roomId, activeAgents);
        if (!updated) throw new Error("Room not found");
        await publishRoomEvent("room.updated", { roomId, activeAgents });
        return updated;
    }

    async addAgentToRoom(roomId: string, agentId: string) {
        const updated = await roomRepository.addAgent(roomId, agentId);
        if (!updated) throw new Error("Room not found");
        await publishRoomEvent("room.updated", { roomId, activeAgents: updated.activeAgents });
        return updated;
    }

    async removeAgentFromRoom(roomId: string, agentId: string) {
        const updated = await roomRepository.removeAgent(roomId, agentId);
        if (!updated) throw new Error("Room not found");
        await publishRoomEvent("room.updated", { roomId, activeAgents: updated.activeAgents });
        return updated;
    }

    async addMemberToRoom(roomId: string, member: IRoomMember) {
        const room = await roomRepository.findById(roomId);
        if (!room) throw new Error("Room not found");

        const memberIndex = room.members.findIndex((m) => m.memberId === member.memberId);
        if (memberIndex >= 0) {
            // Cập nhật thông tin nếu member đã trong phòng
            room.members[memberIndex] = {
                ...room.members[memberIndex],
                ...member,
                joinedAt: room.members[memberIndex].joinedAt || new Date(),
            };
            await room.save();
            await publishRoomEvent("room.member.joined", { roomId, member });
            return room;
        }

        if (room.members.length >= room.maxCapacity) {
            throw new Error("Room has reached max capacity");
        }

        const updated = await roomRepository.addMember(roomId, {
            ...member,
            joinedAt: new Date(),
        });
        await publishRoomEvent("room.member.joined", { roomId, member });
        return updated;
    }

    async removeMemberFromRoom(roomId: string, memberId: string) {
        const room = await roomRepository.removeMember(roomId, memberId);
        if (!room) throw new Error("Room not found or member not in room");
        await publishRoomEvent("room.member.left", { roomId, memberId });
        return room;
    }

    async assignUserAgent(roomId: string, binding: {
        userId: string;
        userName: string;
        userColor?: string;
        agentId: string;
        agentName?: string;
    }) {
        const updated = await roomRepository.addUserAgent(roomId, {
            ...binding,
            assignedAt: new Date(),
        });
        if (!updated) throw new Error("Room not found");
        await publishRoomEvent("room.agent.assigned", { roomId, binding });
        return updated;
    }

    async removeUserAgent(roomId: string, agentId: string) {
        const updated = await roomRepository.removeUserAgent(roomId, agentId);
        if (!updated) throw new Error("Room not found");
        await publishRoomEvent("room.agent.unassigned", { roomId, agentId });
        return updated;
    }
}

export const roomService = new RoomService();