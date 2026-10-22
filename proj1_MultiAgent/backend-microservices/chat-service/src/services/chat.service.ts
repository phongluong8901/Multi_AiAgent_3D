import { chatRepository } from "../repositories/chat.repository";
import { IChat, IChatAttachment } from "../models/chat.model";

export class ChatService {
    /**
     * Lưu tin nhắn mới vào database (Hỗ trợ typeChat, mặc định là "team")
     */
    async saveMessage(data: {
        roomId: string;
        typeChat?: "team" | "direct" | "system" | "workflow";
        senderId: string;
        senderType: "user" | "agent" | "system";
        senderName: string;
        message: string;
        attachments?: IChatAttachment[]; // Bổ sung nhận attachments
        metadata?: any;
    }) {
        if (!data.roomId || !data.message || !data.senderId) {
            throw new Error("Missing required chat fields");
        }

        const chatData = {
            ...data,
            typeChat: data.typeChat || "team",
            attachments: data.attachments || [],
        };

        return await chatRepository.create(chatData);
    }

    /**
     * Lấy lịch sử chat của phòng (Có hỗ trợ lọc theo typeChat tùy chọn)
     */
    async getRoomHistory(roomId: string, typeChat?: string, limit?: number) {
        return await chatRepository.findByRoomId(roomId, typeChat, limit);
    }
}

export const chatService = new ChatService();