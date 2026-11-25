import { Request, Response } from "express";
import { userAgentRoomService } from "../services/user-agent.room.service"; // Import service xử lý logic gán user-agent trong phòng
import { asyncHandler } from "../middlewares/async.middleware";               // Import middleware bắt lỗi tự động cho các hàm async/await

export class UserAgentRoomController {

    // --- 1. GÁN AGENT CHO USER (ASSIGN USER AGENT) ---
    // Sử dụng asyncHandler để bọc hàm, giúp tự động bắt lỗi phát sinh và chuyển tiếp qua Express error handler
    assignUserAgent = asyncHandler(async (req: Request, res: Response) => {
        const { userId, userName, userColor, agentId, agentName } = req.body; // Trích xuất thông tin binding từ request body

        // Kiểm tra tính hợp lệ: Bắt buộc phải truyền lên `userId` và `agentId`
        if (!userId || !agentId) {
            return res.status(400).json({ success: false, message: "userId and agentId are required" });
        }

        // Gọi service xử lý gán agent cho user trong phòng (có kiểm tra giới hạn sở hữu tối đa)
        const room = await userAgentRoomService.assignUserAgent(req.params.id as string, {
            userId,
            userName: userName || "User",         // Gán tên mặc định là "User" nếu client không truyền
            userColor: userColor || "#3b82f6",    // Gán màu mặc định (#3b82f6) nếu không truyền
            agentId,
            agentName: agentName || agentId,      // Gán agentName mặc định bằng agentId nếu không truyền
        });

        // Trả về phản hồi thành công kèm dữ liệu phòng sau khi cập nhật
        return res.status(200).json({ success: true, data: room });
    });

    // --- 2. GỠ BỎ AGENT KHỎI USER (REMOVE USER AGENT) ---
    removeUserAgent = asyncHandler(async (req: Request, res: Response) => {
        // Gọi service gỡ liên kết user-agent dựa vào id phòng và agentId lấy từ URL params
        const room = await userAgentRoomService.removeUserAgent(req.params.id as string, req.params.agentId as string);

        // Trả về kết quả thành công
        return res.status(200).json({ success: true, data: room });
    });
}

export const userAgentRoomController = new UserAgentRoomController(); // Khởi tạo và xuất ra một singleton instance dùng chung cho các route