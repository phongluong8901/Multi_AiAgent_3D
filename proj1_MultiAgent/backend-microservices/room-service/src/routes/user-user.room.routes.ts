import { Router } from "express";
import { userUserRoomController } from "../controllers/user-user.room.controller"; // Import controller xử lý logic phòng giữa user và user
import { requireAuth } from "../middlewares/auth.middleware";                          // Import middleware xác thực token JWT chung
import { requireRoomAdminOrOwner } from "../middlewares/room-auth.middleware";        // Import middleware kiểm tra quyền Admin hoặc Chủ phòng

const router = Router(); // Khởi tạo một Router instance độc lập của Express

// ==========================================
// --- CÁC ROUTE CÔNG KHAI (PUBLIC ROUTES) ---
// ==========================================
// Lấy danh sách toàn bộ các phòng (Lưu ý: các đường dẫn tĩnh (static paths) PHẢI nằm trước route chứa tham số động /:id để tránh bị nuốt route)
router.get("/", userUserRoomController.getRooms);

// ==========================================
// --- XÁC THỰC CHO CÁC ROUTE PHÍA DƯỚI ---
// ==========================================
// Đăng ký middleware bắt buộc phải có token JWT hợp lệ cho toàn bộ các route khai báo bên dưới dòng này
router.use(requireAuth);

// Lấy danh sách lời mời của chính user hiện tại
// (Phải đặt route "/invites/me" TRƯỚC các route có dạng "/:id" để Express không nhầm tưởng từ "invites" là một :id)
router.get("/invites/me", userUserRoomController.myInvites);

// Route POST: Tạo phòng chat mới (URL: POST /api/v1/rooms/user-user/)
router.post("/", userUserRoomController.createRoom);

// Route POST: Tham gia vào phòng chat, có hỗ trợ nhập mật khẩu nếu phòng private (URL: POST /api/v1/rooms/user-user/:id/join)
router.post("/:id/join", userUserRoomController.joinRoom);

// Route POST: Gửi lời mời cho user khác vào phòng (URL: POST /api/v1/rooms/user-user/:id/invites)
router.post("/:id/invites", userUserRoomController.invite);

// Route POST: Chấp nhận lời mời tham gia phòng (URL: POST /api/v1/rooms/user-user/:id/invites/accept)
router.post("/:id/invites/accept", userUserRoomController.acceptInvite);

// Route POST: Từ chối lời mời tham gia phòng (URL: POST /api/v1/rooms/user-user/:id/invites/decline)
router.post("/:id/invites/decline", userUserRoomController.declineInvite);

// Route POST: Rời khỏi phòng chat (URL: POST /api/v1/rooms/user-user/:id/leave)
router.post("/:id/leave", requireAuth, userUserRoomController.leaveRoom);

// Route POST: Thêm thành viên vào phòng trực tiếp (URL: POST /api/v1/rooms/user-user/:id/members)
router.post("/:id/members", userUserRoomController.addMember);

// Route PUT: Cập nhật thông tin phòng (Được bảo vệ bởi middleware `requireRoomAdminOrOwner`: chỉ Chủ phòng hoặc Admin mới được đổi)
router.put("/:id", requireRoomAdminOrOwner, userUserRoomController.updateRoom);

// Route PUT: Cập nhật cấu hình Workflow Agent trong phòng (Được bảo vệ bởi `requireRoomAdminOrOwner`)
router.put("/:id/workflow", requireRoomAdminOrOwner, userUserRoomController.updateWorkflow);

// Route DELETE: Xóa phòng chat (URL: DELETE /api/v1/rooms/user-user/:id)
router.delete("/:id", userUserRoomController.deleteRoom);

// Route DELETE: Xóa/kick thành viên khỏi phòng (Được bảo vệ bởi `requireRoomAdminOrOwner`, URL: DELETE /api/v1/rooms/user-user/:id/members/:memberId)
router.delete(
    "/:id/members/:memberId",
    requireRoomAdminOrOwner,
    userUserRoomController.removeMember
);

// ==========================================
// --- ROUTE LẤY CHI TIẾT THEO ID ĐẶT Ở CUỐI ---
// ==========================================
// Route GET chi tiết phòng theo ID đặt ở cuối cùng để tránh việc nó khớp nhầm và "nuốt" mất các đường dẫn tĩnh phía trên (như /invites/me)
router.get("/:id", userUserRoomController.getRoomById);

export default router; // Xuất router ra ngoài để file khởi động chính (index.ts) gắn vào hệ thống API endpoints