import { roomRepository } from "../repositories/room.repository";
import { IRoomMember, IRoomSettings, IRoomPolicy } from "../models/room.model";
import { publishRoomEvent } from "../events/producers";

export class UserUserRoomService {
    async createRoom(data: {
        name: string;
        description?: string;
        ownerId: string; // <--- Cần thiết lập ownerId
        maxCapacity?: number;
        policy?: Partial<IRoomPolicy>; // <--- Chính sách phòng (tier, ownedAgentsCount, ...)
        initialMember?: IRoomMember;
        settings?: Partial<IRoomSettings>;
    }) {
        // Đảm bảo chủ phòng luôn nằm trong danh sách members với role là "owner"
        const ownerMember: IRoomMember = data.initialMember || {
            memberId: data.ownerId,
            memberType: "user",
            role: "owner",
            name: "Room Owner",
            joinedAt: new Date()
        };

        const room = await roomRepository.create({
            name: data.name,
            description: data.description || "",
            ownerId: data.ownerId, // <--- Lưu ownerId ở cấp độ root
            maxCapacity: data.maxCapacity || 20,
            policy: {
                tier: data.policy?.tier || "standard",
                isPublic: data.policy?.isPublic ?? true,
                maxActiveAgents: data.policy?.maxActiveAgents || 10,
                ownedAgentsCount: data.policy?.ownedAgentsCount || 3, // <--- Giới hạn số lượng agent sở hữu
            },
            activeAgents: ["agent_manager", "agent_ml", "agent_analyst", "agent_search", "agent_summarizer"],
            settings: {
                allowCrossCommands: data.settings?.allowCrossCommands ?? true,
                autonomousHandoff: data.settings?.autonomousHandoff ?? true,
                maxAutoTurns: data.settings?.maxAutoTurns ?? 3,
                allowGuestJoin: data.settings?.allowGuestJoin ?? false,
            },
            members: [ownerMember],
        });

        await publishRoomEvent("room.created", { roomId: (room as any)._id?.toString(), name: room.name, ownerId: data.ownerId });
        return room;
    }

    async addMemberToRoom(roomId: string, member: IRoomMember) {
        const room = await roomRepository.findById(roomId);
        if (!room) throw new Error("Room not found");

        const memberIndex = room.members.findIndex((m) => m.memberId === member.memberId);
        if (memberIndex >= 0) {
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
            role: member.role || "participant", // Mặc định là participant hoặc admin
            joinedAt: new Date(),
        });
        await publishRoomEvent("room.member.joined", { roomId, member });
        return updated;
    }

    async removeMemberFromRoom(roomId: string, memberId: string) {
        const room = await roomRepository.findById(roomId);
        if (!room) throw new Error("Room not found");

        // Không cho phép xóa chủ phòng (owner)
        if (room.ownerId === memberId) {
            throw new Error("Cannot remove the room owner");
        }

        const updated = await roomRepository.removeMember(roomId, memberId);
        await publishRoomEvent("room.member.left", { roomId, memberId });
        return updated;
    }
}

export const userUserRoomService = new UserUserRoomService();