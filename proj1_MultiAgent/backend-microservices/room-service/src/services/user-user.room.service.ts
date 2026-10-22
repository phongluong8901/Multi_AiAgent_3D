import { roomRepository } from "../repositories/room.repository";             // Import repository để thao tác với dữ liệu phòng trong DB
import { IRoomMember, IRoomSettings, IRoomPolicy } from "../models/room.model"; // Import các TypeScript interface liên quan đến phòng
import { publishRoomEvent } from "../events/producers";                      // Import hàm phát sự kiện lên RabbitMQ
import bcrypt from "bcrypt";                                                  // Import thư viện bcrypt để mã hóa và so khớp mật khẩu phòng

export class UserUserRoomService {

    // --- 1. TẠO PHÒNG (CREATE ROOM) ---
    async createRoom(data: {
        name: string;
        description?: string;
        ownerId: string;
        maxCapacity?: number;
        policy?: Partial<IRoomPolicy>;
        initialMember?: IRoomMember;
        settings?: Partial<IRoomSettings>;
    }) {
        // Thiết lập thông tin thành viên ban đầu cho chủ phòng (nếu chưa truyền vào thì dùng mặc định)
        const ownerMember: IRoomMember = data.initialMember || {
            memberId: data.ownerId,
            memberType: "user",
            role: "owner",
            name: "Room Owner",
            joinedAt: new Date()
        };

        const isPublic = data.policy?.isPublic ?? true; // Mặc định phòng là công khai (public) nếu không cấu hình
        let hashedPassword = "";

        // Nếu là phòng Private (riêng tư) và có nhập mật khẩu -> Thực hiện băm (hash) mật khẩu bằng bcrypt
        if (!isPublic && data.policy?.password) {
            hashedPassword = await bcrypt.hash(data.policy.password, 10);
        }

        // Tạo phòng mới thông qua repository với đầy đủ các cấu hình policy, activeAgents mặc định và settings
        const room = await roomRepository.create({
            name: data.name,
            description: data.description || "",
            ownerId: data.ownerId,
            maxCapacity: data.maxCapacity || 20,
            policy: {
                tier: data.policy?.tier || "standard",
                isPublic: isPublic,
                password: hashedPassword, // Lưu chuỗi mật khẩu đã được mã hóa an toàn vào DB
                maxActiveAgents: data.policy?.maxActiveAgents || 10,
                ownedAgentsCount: data.policy?.ownedAgentsCount || 3,
            },
            activeAgents: ["agent_manager", "agent_ml", "agent_analyst", "agent_search", "agent_summarizer"], // Khởi tạo sẵn các agent cốt lõi trong phòng
            settings: {
                allowCrossCommands: data.settings?.allowCrossCommands ?? true,
                autonomousHandoff: data.settings?.autonomousHandoff ?? true,
                maxAutoTurns: data.settings?.maxAutoTurns ?? 3,
                allowGuestJoin: data.settings?.allowGuestJoin ?? false,
            },
            members: [ownerMember], // Đưa chủ phòng vào danh sách thành viên đầu tiên
        });

        // Phát sự kiện "room.created" lên RabbitMQ để các service khác nhận biết
        await publishRoomEvent("room.created", { roomId: (room as any)._id?.toString(), name: room.name, ownerId: data.ownerId });
        return room;
    }

    // --- 2. QUẢN LÝ THÀNH VIÊN (MEMBERS MANAGEMENT) ---

    // Hàm thêm thành viên vào phòng (có cơ chế cập nhật nếu đã tồn tại hoặc kiểm tra sức chứa tối đa)
    async addMemberToRoom(roomId: string, member: IRoomMember) {
        const room = await roomRepository.findById(roomId);
        if (!room) throw new Error("Room not found"); // Báo lỗi nếu phòng không tồn tại

        // Kiểm tra xem thành viên này đã có trong phòng chưa
        const memberIndex = room.members.findIndex((m) => m.memberId === member.memberId);
        if (memberIndex >= 0) {
            // Nếu đã tồn tại -> Cập nhật lại thông tin mới cho thành viên đó
            room.members[memberIndex] = {
                ...room.members[memberIndex],
                ...member,
                joinedAt: room.members[memberIndex].joinedAt || new Date(),
            };
            await room.save();
            await publishRoomEvent("room.member.joined", { roomId, member });
            return room;
        }

        // Kiểm tra xem số lượng thành viên hiện tại đã đạt tối đa sức chứa (maxCapacity) của phòng chưa
        if (room.members.length >= room.maxCapacity) {
            throw new Error("Room has reached max capacity");
        }

        // Thêm mới thành viên vào phòng thông qua repository
        const updated = await roomRepository.addMember(roomId, {
            ...member,
            role: member.role || "participant", // Mặc định role là participant nếu không truyền
            joinedAt: new Date(),
        });
        await publishRoomEvent("room.member.joined", { roomId, member }); // Phát sự kiện thành viên vào phòng
        return updated;
    }

    // Hàm xóa thành viên khỏi phòng
    async removeMemberFromRoom(roomId: string, memberId: string) {
        const room = await roomRepository.findById(roomId);
        if (!room) throw new Error("Room not found");

        // Không cho phép xóa chủ phòng bằng cách thông thường này
        if (room.ownerId === memberId) {
            throw new Error("Cannot remove the room owner");
        }

        const updated = await roomRepository.removeMember(roomId, memberId);
        if (!updated) throw new Error("Failed to remove member");

        await publishRoomEvent("room.member.left", { roomId, memberId }); // Phát sự kiện thành viên rời phòng
        return updated;
    }

    // --- 3. XÓA PHÒNG (DELETE ROOM) ---
    async deleteRoom(roomId: string, requesterId: string) {
        const room = await roomRepository.findById(roomId);
        if (!room) throw new Error("Room not found");

        // Kiểm tra bảo mật: chỉ chủ phòng mới có quyền xóa phòng
        if (room.ownerId !== requesterId) {
            throw new Error("Chủ phòng mới được xóa phòng này");
        }

        await roomRepository.delete(roomId);
        await publishRoomEvent("room.deleted", { roomId, ownerId: requesterId }); // Phát sự kiện phòng bị xóa
        return true;
    }

    // --- 4. THAM GIA PHÒNG (JOIN ROOM) ---
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

        // Nếu user không phải chủ phòng và chưa là thành viên -> Tiến hành kiểm tra bảo mật (phòng private hay public)
        if (!isOwner && !isMember) {
            const isPublic = room.policy?.isPublic ?? true;

            if (!isPublic) {
                // Nếu phòng riêng tư nhưng chưa đặt mật khẩu trong DB
                if (!room.policy?.password) {
                    throw new Error("Phòng này là riêng tư nhưng chưa được thiết lập mật khẩu hợp lệ.");
                }
                // Nếu người dùng không nhập mật khẩu khi join phòng private
                if (!passwordInput) {
                    throw new Error("Phòng này được bảo vệ bằng mật khẩu. Vui lòng nhập mật khẩu!");
                }

                // So sánh mật khẩu người dùng nhập vào với chuỗi đã hash trong database bằng bcrypt
                const isMatch = await bcrypt.compare(passwordInput, room.policy.password);
                if (!isMatch) {
                    throw new Error("Mật khẩu phòng không chính xác!");
                }
            }
        }

        // Gọi hàm addMemberToRoom để xử lý thêm thành viên, chống trùng và check giới hạn sức chứa maxCapacity
        return await this.addMemberToRoom(roomId, memberData);
    }

    // --- 5. HỆ THỐNG LỜI MỜI (INVITES MANAGEMENT) ---

    // Mời một user vào phòng (chỉ Owner hoặc Admin mới có quyền)
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
        // Kiểm tra quyền hạn của người đi mời
        if (!isOwner && !isAdmin) {
            throw new Error("Chỉ chủ phòng hoặc admin được mời thành viên");
        }

        // Các điều kiện ràng buộc logic cơ bản
        if (payload.userId === inviterId) {
            throw new Error("Không thể mời chính mình");
        }
        if (room.ownerId === payload.userId) {
            throw new Error("User đã là chủ phòng");
        }
        if (room.members?.some((m) => m.memberId === payload.userId)) {
            throw new Error("User đã là thành viên phòng");
        }

        // Thêm lời mời vào danh sách pendingInvites trong DB
        const updated = await roomRepository.addInvite(roomId, {
            userId: payload.userId,
            userName: payload.userName,
            invitedBy: inviterId,
        });
        if (!updated) throw new Error("Invite failed");

        // Phát sự kiện "room.invite.created" lên RabbitMQ để đẩy thông báo realtime tới user được mời
        await publishRoomEvent("room.invite.created", {
            roomId,
            userId: payload.userId,
            inviterId,
        });
        return updated;
    }

    // Chấp nhận lời mời tham gia phòng
    async acceptInvite(roomId: string, userId: string, userName?: string) {
        const room = await roomRepository.findById(roomId);
        if (!room) throw new Error("Room not found");

        // Kiểm tra xem user có thực sự nhận được lời mời nào đang chờ không
        const invite = (room as any).pendingInvites?.find(
            (i: any) => i.userId === userId
        );
        if (!invite) throw new Error("Không có lời mời cho bạn");

        // Xóa lời mời khỏi danh sách pending sau khi đã chấp nhận
        await roomRepository.removeInvite(roomId, userId);

        // Thêm user chính thức vào danh sách thành viên của phòng
        const updated = await this.addMemberToRoom(roomId, {
            memberId: userId,
            memberType: "user",
            role: "participant",
            name: userName || invite.userName || "User",
            joinedAt: new Date(),
        });

        await publishRoomEvent("room.invite.accepted", { roomId, userId }); // Phát sự kiện chấp nhận lời mời
        return updated;
    }

    // Từ chối lời mời tham gia phòng
    async declineInvite(roomId: string, userId: string) {
        const room = await roomRepository.findById(roomId);
        if (!room) throw new Error("Room not found");

        const invite = (room as any).pendingInvites?.find(
            (i: any) => i.userId === userId
        );
        if (!invite) throw new Error("Không có lời mời cho bạn");

        const updated = await roomRepository.removeInvite(roomId, userId); // Xóa lời mời
        await publishRoomEvent("room.invite.declined", { roomId, userId }); // Phát sự kiện từ chối
        return updated;
    }

    // Lấy danh sách các lời mời đang chờ xử lý của một user
    async listMyInvites(userId: string) {
        return roomRepository.findInvitesForUser(userId);
    }

    // --- 6. RỜI PHÒNG (LEAVE ROOM) ---
    async leaveRoom(roomId: string, userId: string) {
        const room = await roomRepository.findById(roomId);
        if (!room) throw new Error("Room not found");

        // Chủ phòng không được phép tự ý rời phòng (phải chuyển quyền hoặc xóa phòng)
        if (room.ownerId === userId) {
            throw new Error("Chủ phòng không thể tự rời phòng. Vui lòng chuyển quyền hoặc xóa phòng.");
        }

        const updated = await roomRepository.removeMember(roomId, userId);
        if (!updated) throw new Error("Không thể rời khỏi phòng");

        await publishRoomEvent("room.member.left", { roomId, memberId: userId }); // Phát sự kiện rời phòng
        return updated;
    }
}

export const userUserRoomService = new UserUserRoomService(); // Khởi tạo và xuất ra một singleton instance dùng chung