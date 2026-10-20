import { roomRepository } from "../repositories/room.repository";
import { publishRoomEvent } from "../events/producers";

export class UserAgentRoomService {
    async assignUserAgent(roomId: string, binding: {
        userId: string;
        userName: string;
        userColor?: string;
        agentId: string;
        agentName?: string;
    }) {
        const room = await roomRepository.findById(roomId);
        if (!room) throw new Error("Room not found");

        // --- BỔ SUNG: Kiểm tra giới hạn số lượng Agent sở hữu (ownedAgentsCount) ---
        const userExistingAgents = room.userAgents.filter(ua => ua.userId === binding.userId);
        const maxAllowed = room.policy?.ownedAgentsCount ?? 3;

        // Nếu user này chưa sở hữu agent này và đã đạt tối đa số lượng cho phép
        const alreadyBound = userExistingAgents.some(ua => ua.agentId === binding.agentId);
        if (!alreadyBound && userExistingAgents.length >= maxAllowed) {
            throw new Error(`User has reached the maximum limit of owned agents (${maxAllowed}) in this room.`);
        }

        const updated = await roomRepository.addUserAgent(roomId, {
            ...binding,
            assignedAt: new Date(),
        });
        if (!updated) throw new Error("Failed to assign agent");

        await publishRoomEvent("room.agent.assigned", { roomId, binding });
        return updated;
    }

    async removeUserAgent(roomId: string, agentId: string) {
        const updated = await roomRepository.removeUserAgent(roomId, agentId);
        if (!updated) throw new Error("Room not found");
        await publishRoomEvent("room.agent.unassigned", { roomId, agentId });
        return updated;
    }
}

export const userAgentRoomService = new UserAgentRoomService();