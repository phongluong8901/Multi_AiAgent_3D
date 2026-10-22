import { ChatModel, IChat } from "../models/chat.model";

export class ChatRepository {
    /**
     * Tạo và lưu một tin nhắn mới vào MongoDB
     */
    async create(chatData: Partial<IChat>): Promise<any> {
        const chat = new ChatModel(chatData);
        const saved = await chat.save();
        return saved.toObject ? saved.toObject() : saved;
    }

    /**
     * Lấy lịch sử chat của phòng, có thể lọc theo typeChat (tùy chọn)
     */
    async findByRoomId(
        roomId: string,
        typeChat?: string,
        limit: number = 60,
        options?: { userId?: string; targetUserId?: string; targetAgentId?: string }
    ): Promise<any[]> {
        const query: Record<string, any> = { roomId };

        // Nếu có truyền vào typeChat thì thêm vào điều kiện lọc
        if (typeChat) {
            query.typeChat = typeChat;

            // Chat 1-1 riêng tư giữa 2 user
            if (typeChat === "direct") {
                if (options?.userId && options?.targetUserId) {
                    query.$or = [
                        { senderId: options.userId, targetUserId: options.targetUserId },
                        { senderId: options.targetUserId, targetUserId: options.userId }
                    ];
                } else if (options?.userId) {
                    query.$or = [
                        { senderId: options.userId },
                        { targetUserId: options.userId }
                    ];
                }
            }

            // Chat hỏi đáp user-agent
            if (typeChat === "agent" && options?.targetAgentId) {
                query.targetAgentId = options.targetAgentId;
            }
        }

        return await ChatModel.find(query)
            .sort({ createdAt: 1 }) // Sắp xếp tăng dần theo thời gian (cũ ở trên, mới ở dưới)
            .limit(limit)
            .lean();
    }
}

export const chatRepository = new ChatRepository();