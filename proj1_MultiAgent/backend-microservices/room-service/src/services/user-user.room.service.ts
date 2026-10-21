import { roomRepository } from "../repositories/room.repository";
import { IRoomMember, IRoomSettings, IRoomPolicy } from "../models/room.model";
import { publishRoomEvent } from "../events/producers";
import bcrypt from "bcrypt";

export class UserUserRoomService {
    async createRoom(data: {
        name: string;
        description?: string;
        ownerId: string;
        maxCapacity?: number;
        policy?: Partial<IRoomPolicy>;
        initialMember?: IRoomMember;
        settings?: Partial<IRoomSettings>;
    }) {
        const ownerMember: IRoomMember = data.initialMember || {
            memberId: data.ownerId,
            memberType: "user",
            role: "owner",
            name: "Room Owner",
            joinedAt: new Date()
        };

        const isPublic = data.policy?.isPublic ?? true;
        let hashedPassword = "";

        // Nếu là phòng Private và có nhập mật khẩu -> Thực hiện băm (hash) mật khẩu
        if (!isPublic && data.policy?.password) {
            hashedPassword = await bcrypt.hash(data.policy.password, 10);
        }

        const room = await roomRepository.create({
            name: data.name,
            description: data.description || "",
            ownerId: data.ownerId,
            maxCapacity: data.maxCapacity || 20,
            policy: {
                tier: data.policy?.tier || "standard",
                isPublic: isPublic,
                password: hashedPassword, // Lưu mật khẩu đã mã hóa an toàn
                maxActiveAgents: data.policy?.maxActiveAgents || 10,
                ownedAgentsCount: data.policy?.ownedAgentsCount || 3,
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
            role: member.role || "participant",
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

    /** Join: kiểm tra tính công khai/riêng tư và xác thực mật khẩu qua bcrypt */
    async joinRoom(
        roomId: string,
        memberData: IRoomMember,
        passwordInput?: string
    ) {
        const room = await roomRepository.findById(roomId);
        if (!room) throw new Error("Room not found");

        const userId = memberData.memberId;
        const isOwner = room.ownerId === userId;
        const isMember = room.members?.some((m) => m.memberId === userId);

        // Nếu không phải chủ phòng và chưa là thành viên -> Kiểm tra bảo mật / mật khẩu
        if (!isOwner && !isMember) {
            const isPublic = room.policy?.isPublic ?? true;

            if (!isPublic) {
                if (!room.policy?.password) {
                    throw new Error("Phòng này là riêng tư nhưng chưa được thiết lập mật khẩu hợp lệ.");
                }
                if (!passwordInput) {
                    throw new Error("Phòng này được bảo vệ bằng mật khẩu. Vui lòng nhập mật khẩu!");
                }

                // So sánh mật khẩu người dùng nhập với chuỗi đã hash trong database
                const isMatch = await bcrypt.compare(passwordInput, room.policy.password);
                if (!isMatch) {
                    throw new Error("Mật khẩu phòng không chính xác!");
                }
            }
        }

        // GỌI HÀM addMemberToRoom ĐỂ XỬ LÝ CHỐNG TRÙNG VÀ KIỂM TRA SỨC CHỨA (maxCapacity)
        return await this.addMemberToRoom(roomId, memberData);
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

        if (room.ownerId === userId) {
            throw new Error("Chủ phòng không thể tự rời phòng. Vui lòng chuyển quyền hoặc xóa phòng.");
        }

        const updated = await roomRepository.removeMember(roomId, userId);
        if (!updated) throw new Error("Không thể rời khỏi phòng");

        await publishRoomEvent("room.member.left", { roomId, memberId: userId });
        return updated;
    }
}

export const userUserRoomService = new UserUserRoomService();