import { Response } from "express";
import { userUserRoomService } from "../services/user-user.room.service"; // Import service xử lý logic nghiệp vụ người dùng - phòng
import { roomRepository } from "../repositories/room.repository";        // Import repository để truy vấn trực tiếp cơ sở dữ liệu phòng
import { asyncHandler } from "../middlewares/async.middleware";          // Import middleware bọc bắt lỗi tự động cho các hàm async/await
import { AuthenticatedRequest } from "../middlewares/auth.middleware";   // Import kiểu request đã được xác thực thông qua JWT middleware

export class UserUserRoomController {

    // --- 1. TẠO PHÒNG MỚI (CREATE ROOM) ---
    createRoom = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const ownerId = req.user!.userId; // Lấy userId của người tạo (chủ phòng) từ token đã xác thực (dùng dấu ! đảm bảo không null)
        const { name, description, maxCapacity, policy, settings, ownerName } = req.body; // Trích xuất thông tin từ body

        // Kiểm tra bắt buộc phải có tên phòng (`name`)
        if (!name) {
            return res.status(400).json({ success: false, message: "name is required" });
        }

        // Gọi service tạo phòng mới kèm theo cấu hình thành viên ban đầu cho chủ phòng
        const room = await userUserRoomService.createRoom({
            name,
            description,
            ownerId,
            maxCapacity,
            policy,
            settings,
            initialMember: {
                memberId: ownerId,
                memberType: "user",
                role: "owner",
                name: ownerName || "Room Owner", // Lấy tên chủ phòng hoặc mặc định
                joinedAt: new Date(),
            },
        });

        // Trả về HTTP 201 Created kèm dữ liệu phòng vừa tạo thành công
        return res.status(201).json({ success: true, data: room });
    });

    // --- 2. LẤY DANH SÁCH TẤT CẢ PHÒNG (GET ROOMS) ---
    getRooms = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
        let rooms = await roomRepository.findAll(); // Lấy toàn bộ danh sách phòng từ database

        // Nếu hệ thống hoàn toàn chưa có phòng nào -> Tự động khởi tạo một phòng mẫu mặc định (Virtual Office Team HQ)
        if (rooms.length === 0) {
            const defaultRoom = await userUserRoomService.createRoom({
                name: "Virtual Office Team HQ",
                description: "Không gian làm việc chung kết nối toàn bộ Agent và Team",
                ownerId: "system_owner_default",
                maxCapacity: 30,
                policy: {
                    tier: "enterprise",
                    isPublic: true,
                    maxActiveAgents: 10,
                    ownedAgentsCount: 3,
                },
            });
            rooms = [defaultRoom]; // Gán phòng mặc định vào danh sách trả về
        }

        // Trả về danh sách phòng thành công
        return res.status(200).json({ success: true, data: rooms });
    });

    // --- 3. LẤY THÔNG TIN CHI TIẾT PHÒNG THEO ID (GET ROOM BY ID) ---
    getRoomById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const room = await roomRepository.findById(req.params.id as string); // Tìm phòng theo id trên params
        if (!room) {
            return res.status(404).json({ success: false, message: "Room not found" }); // Báo lỗi nếu không tìm thấy phòng
        }
        return res.status(200).json({ success: true, data: room });
    });

    // --- 4. THAM GIA PHÒNG (JOIN ROOM) ---
    /** User vào phòng → ghi members (có kiểm tra mật khẩu đã hash nếu phòng private) */
    joinRoom = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!.userId; // Lấy userId của user từ token
        const { name, avatar, color, password } = req.body; // Trích xuất thông tin cá nhân và mật khẩu phòng từ request body

        // Gọi service xử lý logic tham gia phòng (có check phân quyền private/public và so khớp bcrypt password)
        const room = await userUserRoomService.joinRoom(
            req.params.id as string,
            {
                memberId: userId,
                memberType: "user",
                role: "participant",
                name: name || "User",
                avatar: avatar || "",
                color: color || "#3b82f6",
            },
            password // Truyền password xuống service để xác thực với bcrypt trong database
        );

        return res.status(200).json({ success: true, data: room });
    });

    // --- 5. CẬP NHẬT THÔNG TIN PHÒNG (UPDATE ROOM) ---
    updateRoom = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const updated = await roomRepository.updateRoom(
            req.params.id as string,
            req.body // Cập nhật toàn bộ data truyền lên từ body
        );
        if (!updated) {
            return res.status(404).json({ success: false, message: "Room not found" });
        }
        return res.status(200).json({ success: true, data: updated });
    });

    // --- 6. THÊM THÀNH VIÊN VÀO PHÒNG (ADD MEMBER) ---
    addMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const { memberId, memberType } = req.body;
        // Kiểm tra bắt buộc phải truyền memberId và memberType
        if (!memberId || !memberType) {
            return res.status(400).json({
                success: false,
                message: "memberId and memberType are required",
            });
        }
        const room = await userUserRoomService.addMemberToRoom(
            req.params.id as string,
            req.body
        );
        return res.status(200).json({ success: true, data: room });
    });

    // --- 7. XÓA THÀNH VIÊN KHỎI PHÒNG (REMOVE MEMBER) ---
    removeMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const room = await userUserRoomService.removeMemberFromRoom(
            req.params.id as string,
            req.params.memberId as string // Lấy memberId cần xóa từ URL params
        );
        return res.status(200).json({ success: true, data: room });
    });

    // --- 8. XÓA PHÒNG (DELETE ROOM) ---
    deleteRoom = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!.userId;
        await userUserRoomService.deleteRoom(req.params.id as string, userId); // Service sẽ kiểm tra quyền chủ phòng trước khi xóa
        return res.status(200).json({ success: true, message: "Đã xóa phòng" });
    });

    // ==========================================
    // --- 9. HỆ THỐNG LỜI MỜI (INVITES MANAGEMENT) ---
    // ==========================================

    // Lấy danh sách các lời mời đang chờ xử lý của chính user hiện tại
    myInvites = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const rooms = await userUserRoomService.listMyInvites(req.user!.userId);
        return res.status(200).json({ success: true, data: rooms });
    });

    // Mời một user khác vào phòng (chỉ Owner hoặc Admin mới được phép mời)
    invite = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const { userId, userName } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, message: "userId is required" });
        }
        const room = await userUserRoomService.inviteUser(
            req.params.id as string,
            req.user!.userId, // ID của người đi mời (inviterId)
            { userId, userName }
        );
        return res.status(200).json({ success: true, data: room });
    });

    // Chấp nhận lời mời tham gia phòng
    acceptInvite = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!.userId;
        const name = req.body?.name || req.body?.userName;
        const room = await userUserRoomService.acceptInvite(
            req.params.id as string,
            userId,
            name
        );
        return res.status(200).json({ success: true, data: room });
    });

    // Từ chối lời mời tham gia phòng
    declineInvite = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const room = await userUserRoomService.declineInvite(
            req.params.id as string,
            req.user!.userId
        );
        return res.status(200).json({ success: true, data: room });
    });

    // --- 10. RỜI PHÒNG (LEAVE ROOM) ---
    leaveRoom = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!.userId;
        const roomId = req.params.id as string;

        const room = await userUserRoomService.leaveRoom(roomId, userId); // Gọi service xử lý rời phòng
        return res.status(200).json({ success: true, data: room });
    });
}

export const userUserRoomController = new UserUserRoomController(); // Khởi tạo và xuất ra một singleton instance dùng chung cho các route