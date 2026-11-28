import { Response, NextFunction } from "express";
import { roomRepository } from "../repositories/room.repository"; // Import repository để truy vấn dữ liệu phòng từ database
import { AuthenticatedRequest } from "./auth.middleware";        // Import kiểu request đã được xác thực từ middleware trước đó

// Mở rộng interface RoomAuthRequest kế thừa từ AuthenticatedRequest và bổ sung thêm thuộc tính room tùy chọn
export interface RoomAuthRequest extends AuthenticatedRequest {
    room?: any; // Lưu trữ thông tin phòng sau khi tìm thấy để controller phía sau có thể dùng trực tiếp mà không cần query lại
}

// Middleware kiểm tra quyền hạn: chỉ cho phép Chủ phòng (Owner) hoặc Quản trị viên (Admin) của phòng đi tiếp
export const requireRoomAdminOrOwner = async (
    req: RoomAuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        // Lấy ID phòng từ param trên URL (hỗ trợ cả trường hợp dùng :id hoặc :roomId)
        const rawId = req.params.id || req.params.roomId;
        // Xử lý an toàn nếu rawId vô tình là mảng (string[]) thì lấy phần tử đầu tiên, ngược lại lấy nguyên bản
        const roomId = Array.isArray(rawId) ? rawId[0] : rawId;

        // Nếu không tìm thấy roomId trên URL -> Trả về lỗi 400 Bad Request
        if (!roomId) {
            return res.status(400).json({ success: false, message: "Thiếu ID phòng" });
        }

        // Truy vấn database tìm thông tin phòng thông qua roomRepository
        const room = await roomRepository.findById(roomId);
        // Nếu phòng không tồn tại trong hệ thống -> Trả về lỗi 404 Not Found
        if (!room) {
            return res.status(404).json({ success: false, message: "Không tìm thấy phòng" });
        }

        // Lấy ID của user hiện tại từ token đã xác thực (req.user) hoặc dự phòng lấy qua header "x-user-id"
        const currentUserId =
            req.user?.userId || (req.headers["x-user-id"] as string);

        // Nếu vẫn không xác định được danh tính user -> Trả về lỗi 401 Unauthorized
        if (!currentUserId) {
            return res.status(401).json({
                success: false,
                message: "Chưa xác thực danh tính",
            });
        }

        // Kiểm tra xem user hiện tại có phải là chủ phòng (owner) hay không
        const isOwner = room.ownerId === currentUserId;

        // Tìm thông tin của user trong danh sách members của phòng
        const currentMember = room.members?.find(
            (m: any) => m.memberId === currentUserId
        );

        // Kiểm tra xem user đó có quyền là "admin" trong phòng hay không
        const isAdmin = currentMember?.role === "admin";

        // Nếu không phải là chủ phòng cũng không phải admin -> Chặn lại, trả về lỗi 403 Forbidden
        if (!isOwner && !isAdmin) {
            return res.status(403).json({
                success: false,
                message:
                    "Bạn không có quyền thực hiện hành động này! Chỉ Chủ phòng hoặc Quản trị viên mới được phép.",
            });
        }

        // Gắn đối tượng phòng vừa tìm được vào req.room để các controller xử lý tiếp theo có thể tận dụng
        req.room = room;
        next(); // Cho phép request đi tiếp tục vào controller chính
    } catch (error: any) {
        // Bắt mọi lỗi phát sinh trong quá trình xử lý (lỗi database, ngoại lệ,...) và trả về lỗi 500
        return res.status(500).json({
            success: false,
            message: `Lỗi phân quyền: ${error.message}`,
        });
    }
};