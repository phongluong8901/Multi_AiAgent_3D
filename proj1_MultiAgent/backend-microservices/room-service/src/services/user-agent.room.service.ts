import { roomRepository } from "../repositories/room.repository"; // Import repository để thao tác với dữ liệu phòng trong DB
import { publishRoomEvent } from "../events/producers";          // Import hàm phát sự kiện lên RabbitMQ

export class UserAgentRoomService {

    // Hàm gán (assign) một Agent cho một User cụ thể trong phòng (kèm kiểm tra giới hạn số lượng)
    async assignUserAgent(roomId: string, binding: {
        userId: string;
        userName: string;
        userColor?: string;
        agentId: string;
        agentName?: string;
    }) {
        // Tìm thông tin phòng thông qua ID
        const room = await roomRepository.findById(roomId);
        if (!room) throw new Error("Room not found"); // Báo lỗi nếu phòng không tồn tại

        // --- BỔ SUNG: Kiểm tra giới hạn số lượng Agent sở hữu (ownedAgentsCount) ---
        // Lọc danh sách các agent mà user này đang sở hữu trong phòng hiện tại
        const userExistingAgents = room.userAgents.filter(ua => ua.userId === binding.userId);
        // Lấy giới hạn tối đa từ policy của phòng (nếu không cấu hình thì mặc định tối đa là 3 agent)
        const maxAllowed = room.policy?.ownedAgentsCount ?? 3;

        // Kiểm tra xem agent này đã được user bind trước đó chưa
        const alreadyBound = userExistingAgents.some(ua => ua.agentId === binding.agentId);

        // Nếu user chưa sở hữu agent này nhưng số lượng hiện tại đã đạt/vượt mức tối đa cho phép -> Chặn lại và bắn lỗi
        if (!alreadyBound && userExistingAgents.length >= maxAllowed) {
            throw new Error(`User has reached the maximum limit of owned agents (${maxAllowed}) in this room.`);
        }

        // Tiến hành thêm liên kết user-agent vào database thông qua repository
        const updated = await roomRepository.addUserAgent(roomId, {
            ...binding,
            assignedAt: new Date(), // Ghi nhận thời điểm gán binding
        });
        if (!updated) throw new Error("Failed to assign agent"); // Báo lỗi nếu cập nhật DB thất bại

        // Phát sự kiện "room.agent.assigned" lên RabbitMQ để thông báo cho các microservices khác
        await publishRoomEvent("room.agent.assigned", { roomId, binding });

        return updated; // Trả về thông tin phòng sau khi cập nhật thành công
    }

    // Hàm gỡ bỏ liên kết gán agent khỏi user trong phòng
    async removeUserAgent(roomId: string, agentId: string) {
        // Gọi repository để xóa binding của agent
        const updated = await roomRepository.removeUserAgent(roomId, agentId);
        if (!updated) throw new Error("Room not found"); // Báo lỗi nếu không tìm thấy phòng

        // Phát sự kiện "room.agent.unassigned" lên RabbitMQ
        await publishRoomEvent("room.agent.unassigned", { roomId, agentId });

        return updated; // Trả về thông tin phòng mới
    }
}

export const userAgentRoomService = new UserAgentRoomService(); // Khởi tạo và xuất ra một singleton instance để sử dụng chung