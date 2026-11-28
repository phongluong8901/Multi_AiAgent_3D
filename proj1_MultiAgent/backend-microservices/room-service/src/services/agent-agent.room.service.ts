import { roomRepository } from "../repositories/room.repository"; // Import repository để thao tác với dữ liệu phòng trong DB
import { publishRoomEvent } from "../events/producers";          // Import hàm phát sự kiện lên RabbitMQ

export class AgentAgentRoomService {

    // Hàm đồng bộ toàn bộ danh sách các AI Agent đang hoạt động trong phòng
    async syncActiveAgents(roomId: string, activeAgents: string[]) {
        // Cập nhật danh sách activeAgents mới vào cơ sở dữ liệu qua repository
        const updated = await roomRepository.updateActiveAgents(roomId, activeAgents);

        // Nếu không tìm thấy phòng -> Bắn lỗi để dừng xử lý
        if (!updated) throw new Error("Room not found");

        // Phát sự kiện "room.agents.synced" lên RabbitMQ để thông báo cho các microservices khác biết
        await publishRoomEvent("room.agents.synced", { roomId, activeAgents });

        return updated; // Trả về thông tin phòng sau khi đã cập nhật thành công
    }

    // Hàm thêm mới một AI Agent vào phòng chat
    async addAgentToRoom(roomId: string, agentId: string) {
        // Thêm agentId vào danh sách activeAgents trong database
        const updated = await roomRepository.addAgent(roomId, agentId);

        // Kiểm tra xem phòng có tồn tại hay không
        if (!updated) throw new Error("Room not found");

        // Phát sự kiện "room.agent.added" kèm theo danh sách agent đang active mới nhất
        await publishRoomEvent("room.agent.added", { roomId, agentId, activeAgents: updated.activeAgents });

        return updated;
    }

    // Hàm gỡ bỏ một AI Agent ra khỏi phòng chat
    async removeAgentFromRoom(roomId: string, agentId: string) {
        // Xóa agent khỏi các danh sách quản lý agent trong phòng tại database
        const updated = await roomRepository.removeAgent(roomId, agentId);

        // Kiểm tra xem phòng có tồn tại hay không
        if (!updated) throw new Error("Room not found");

        // Phát sự kiện "room.agent.removed" lên RabbitMQ để cập nhật realtime cho client/service khác
        await publishRoomEvent("room.agent.removed", { roomId, agentId, activeAgents: updated.activeAgents });

        return updated;
    }
}

export const agentAgentRoomService = new AgentAgentRoomService(); // Khởi tạo và xuất ra một singleton instance để sử dụng chung