import { roomRepository } from "../repositories/room.repository";
import { publishRoomEvent } from "../events/producers";

export class AgentAgentRoomService {
    async syncActiveAgents(roomId: string, activeAgents: string[]) {
        const updated = await roomRepository.updateActiveAgents(roomId, activeAgents);
        if (!updated) throw new Error("Room not found");
        await publishRoomEvent("room.agents.synced", { roomId, activeAgents });
        return updated;
    }

    async addAgentToRoom(roomId: string, agentId: string) {
        const updated = await roomRepository.addAgent(roomId, agentId);
        if (!updated) throw new Error("Room not found");
        await publishRoomEvent("room.agent.added", { roomId, agentId, activeAgents: updated.activeAgents });
        return updated;
    }

    async removeAgentFromRoom(roomId: string, agentId: string) {
        const updated = await roomRepository.removeAgent(roomId, agentId);
        if (!updated) throw new Error("Room not found");
        await publishRoomEvent("room.agent.removed", { roomId, agentId, activeAgents: updated.activeAgents });
        return updated;
    }
}

export const agentAgentRoomService = new AgentAgentRoomService();