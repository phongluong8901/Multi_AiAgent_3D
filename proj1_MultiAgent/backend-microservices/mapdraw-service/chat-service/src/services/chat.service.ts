import { chatRepository } from "../repositories/chat.repository";
import { IChat, IChatAttachment, ChatType } from "../models/chat.model";

export class ChatService {
    /**
     * Lưu tin nhắn mới vào database (Hỗ trợ typeChat: team, direct, agent, workflow, system)
     */
    async saveMessage(data: {
        roomId: string;
        typeChat?: ChatType;
        senderId: string;
        senderType: "user" | "agent" | "system";
        senderName: string;
        message: string;
        targetUserId?: string;
        targetAgentId?: string;
        attachments?: IChatAttachment[];
        metadata?: any;
    }) {
        if (!data.roomId || !data.message || !data.senderId) {
            throw new Error("Missing required chat fields");
        }

        // Tự động nhận diện typeChat nếu client chưa chỉ định rõ
        let chatType = data.typeChat;
        if (!chatType) {
            if (data.targetUserId) {
                chatType = "direct"; // Chat 1-1 giữa 2 người dùng
            } else if (data.targetAgentId || data.message.includes("@agent_")) {
                chatType = "agent";  // User gửi cho Agent
            } else if (data.senderType === "agent" && data.metadata?.depth > 0) {
                chatType = "workflow"; // Agent tương tác với Agent
            } else {
                chatType = "team";    // Toàn phòng
            }
        }

        const chatData = {
            ...data,
            typeChat: chatType,
            attachments: data.attachments || [],
        };

        return await chatRepository.create(chatData);
    }

    /**
     * Lấy lịch sử chat của phòng (Có hỗ trợ lọc theo typeChat tùy chọn)
     */
    async getRoomHistory(
        roomId: string,
        typeChat?: string,
        limit?: number,
        options?: { userId?: string; targetUserId?: string; targetAgentId?: string }
    ) {
        return await chatRepository.findByRoomId(roomId, typeChat, limit, options);
    }
}

export const chatService = new ChatService();