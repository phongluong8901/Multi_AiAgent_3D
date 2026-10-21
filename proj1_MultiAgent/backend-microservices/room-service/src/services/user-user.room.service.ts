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

        if (room.ownerId === memberId) {
            throw new Error("Cannot remove the room owner");
        }

        const updated = await roomRepository.removeMember(roomId, memberId);
        if (!updated) throw new Error("Failed to remove member");

        await publishRoomEvent("room.member.left", { roomId, memberId });
        return updated;
    }

    async deleteRoom(roomId: string, requesterId: string) {
        const room = await roomRepository.findById(roomId);
        if (!room) throw new Error("Room not found");

        if (room.ownerId !== requesterId) {
            throw new Error("Chỉ chủ phòng mới được xóa phòng này");
        }

        await roomRepository.delete(roomId);
        await publishRoomEvent("room.deleted", { roomId, ownerId: requesterId });
        return true;
    }

    /** Join: chỉ owner hoặc đã là member (sau accept invite) */
    async joinRoom(
        roomId: string,
        userId: string,
        meta?: { name?: string; avatar?: string; color?: string }
    ) {
        const room = await roomRepository.findById(roomId);
        if (!room) throw new Error("Room not found");

        const isOwner = room.ownerId === userId;
        const isMember = room.members?.some((m) => m.memberId === userId);

        if (!isOwner && !isMember) {
            throw new Error("Bạn chưa được mời hoặc chưa chấp nhận lời mời");
        }
        return room;
    }

    // ─── INVITES ───────────────────────────────────────────

    async inviteUser(
        roomId: string,
        inviterId: string,
        payload: { userId: string; userName?: string }
    ) {
        const room = await roomRepository.findById(roomId);
        if (!room) throw new Error("Room not found");

        const isOwner = room.ownerId === inviterId;
        const isAdmin = room.members?.some(
            (m) => m.memberId === inviterId && m.role === "admin"
        );
        if (!isOwner && !isAdmin) {
            throw new Error("Chỉ chủ phòng hoặc admin được mời thành viên");
        }

        if (payload.userId === inviterId) {
            throw new Error("Không thể mời chính mình");
        }
        if (room.ownerId === payload.userId) {
            throw new Error("User đã là chủ phòng");
        }
        if (room.members?.some((m) => m.memberId === payload.userId)) {
            throw new Error("User đã là thành viên phòng");
        }

        const updated = await roomRepository.addInvite(roomId, {
            userId: payload.userId,
            userName: payload.userName,
            invitedBy: inviterId,
        });
        if (!updated) throw new Error("Invite failed");

        await publishRoomEvent("room.invite.created", {
            roomId,
            userId: payload.userId,
            inviterId,
        });
        return updated;
    }

    async acceptInvite(roomId: string, userId: string, userName?: string) {
        const room = await roomRepository.findById(roomId);
        if (!room) throw new Error("Room not found");

        const invite = (room as any).pendingInvites?.find(
            (i: any) => i.userId === userId
        );
        if (!invite) throw new Error("Không có lời mời cho bạn");

        await roomRepository.removeInvite(roomId, userId);

        const updated = await this.addMemberToRoom(roomId, {
            memberId: userId,
            memberType: "user",
            role: "participant",
            name: userName || invite.userName || "User",
            joinedAt: new Date(),
        });

        await publishRoomEvent("room.invite.accepted", { roomId, userId });
        return updated;
    }

    async declineInvite(roomId: string, userId: string) {
        const room = await roomRepository.findById(roomId);
        if (!room) throw new Error("Room not found");

        const invite = (room as any).pendingInvites?.find(
            (i: any) => i.userId === userId
        );
        if (!invite) throw new Error("Không có lời mời cho bạn");

        const updated = await roomRepository.removeInvite(roomId, userId);
        await publishRoomEvent("room.invite.declined", { roomId, userId });
        return updated;
    }

    async listMyInvites(userId: string) {
        return roomRepository.findInvitesForUser(userId);
    }

    async leaveRoom(roomId: string, userId: string) {
        const room = await roomRepository.findById(roomId);
        if (!room) throw new Error("Room not found");

        // Chủ phòng không được phép rời phòng theo cách này (phải xóa phòng hoặc chuyển quyền)
        if (room.ownerId === userId) {
            throw new Error("Chủ phòng không thể tự rời phòng. Vui lòng chuyển quyền hoặc xóa phòng.");
        }

        // Thực hiện gỡ user ra khỏi mảng members
        const updated = await roomRepository.removeMember(roomId, userId);
        if (!updated) throw new Error("Không thể rời khỏi phòng");

        // Phát sự kiện realtime qua RabbitMQ/WebSocket
        await publishRoomEvent("room.member.left", { roomId, memberId: userId });
        return updated;
    }
}

export const userUserRoomService = new UserUserRoomService();