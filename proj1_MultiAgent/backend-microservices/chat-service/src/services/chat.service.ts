import { chatRepository } from "../repositories/chat.repository";
import { IChat } from "../models/chat.model";

export class ChatService {
    async saveMessage(data: {
        roomId: string;
        senderId: string;
        senderType: "user" | "agent" | "system";
        senderName: string;
        message: string;
        metadata?: any;
    }) {
        if (!data.roomId || !data.message || !data.senderId) {
            throw new Error("Missing required chat fields");
        }
        return await chatRepository.create(data);
    }

    async getRoomHistory(roomId: string, limit?: number) {
        return await chatRepository.findByRoomId(roomId, limit);
    }
}

export const chatService = new ChatService();