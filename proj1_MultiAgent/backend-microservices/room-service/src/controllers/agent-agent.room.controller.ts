import { Request, Response } from "express";
import { agentAgentRoomService } from "../services/agent-agent.room.service"; // Import service xử lý logic nghiệp vụ liên quan đến Agent trong phòng
import { asyncHandler } from "../middlewares/async.middleware";               // Import middleware bắt lỗi tự động cho các hàm async/await

export class AgentAgentRoomController {

    // --- 1. ĐỒNG BỘ DANH SÁCH AGENT (SYNC AGENTS) ---
    // Sử dụng asyncHandler để bọc hàm async, giúp tự động bắt lỗi và chuyển tiếp qua Express error handler nếu có ngoại lệ
    syncAgents = asyncHandler(async (req: Request, res: Response) => {
        const { activeAgents } = req.body; // Trích xuất mảng activeAgents từ request body

        // Kiểm tra tính hợp lệ: activeAgents bắt buộc phải là một mảng (Array)
        if (!Array.isArray(activeAgents)) {
            return res.status(400).json({ success: false, message: "activeAgents must be an array" });
        }

        // Gọi service để đồng bộ danh sách agent trong database (ép kiểu id phòng và activeAgents sang string chuẩn xác)
        const room = await agentAgentRoomService.syncActiveAgents(req.params.id as string, activeAgents as string[]);

        // Trả về kết quả thành công kèm thông tin phòng sau khi update
        return res.status(200).json({ success: true, data: room });
    });

    // --- 2. THÊM AGENT VÀO PHÒNG (ADD AGENT) ---
    addAgent = asyncHandler(async (req: Request, res: Response) => {
        // Gọi service thêm agent vào phòng dựa vào roomId (:id) và agentId lấy từ URL params
        const room = await agentAgentRoomService.addAgentToRoom(req.params.id as string, req.params.agentId as string);

        // Trả về HTTP 200 kèm dữ liệu phòng mới
        return res.status(200).json({ success: true, data: room });
    });

    // --- 3. XÓA AGENT KHỎI PHÒNG (REMOVE AGENT) ---
    removeAgent = asyncHandler(async (req: Request, res: Response) => {
        // Gọi service gỡ bỏ agent khỏi phòng thông qua id phòng và agentId trên params
        const room = await agentAgentRoomService.removeAgentFromRoom(req.params.id as string, req.params.agentId as string);

        // Trả về phản hồi thành công
        return res.status(200).json({ success: true, data: room });
    });
}

export const agentAgentRoomController = new AgentAgentRoomController(); // Khởi tạo và xuất ra một singleton instance dùng chung cho các route