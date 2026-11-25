import {
    ChatModel,
    UserUserChatModel,
    UserAgentChatModel,
    AgentAgentChatModel,
    getChatModelByType,
    IChat
} from "../models/chat.model";

export class ChatRepository {
    /**
     * Tạo và lưu một tin nhắn mới vào đúng Collection tương ứng (user-user, user-agent, agent-agent)
     * Đồng thời cũng lưu 1 bản vào collection chats dùng chung để đảm bảo tính tương thích
     */
    async create(chatData: Partial<IChat>): Promise<any> {
        const SpecificModel = getChatModelByType(chatData.typeChat);
        const chat = new SpecificModel(chatData);
        const saved = await chat.save();

        // Nếu collection riêng khác collection chung chats, ghi thêm 1 bản dự phòng
        if (SpecificModel !== ChatModel) {
            ChatModel.create(chatData).catch(() => {});
        }

        return saved.toObject ? saved.toObject() : saved;
    }

    /**
     * Lấy lịch sử chat của phòng theo từng phân loại (User-User, User-Agent, Agent-Agent)
     */
    async findByRoomId(
        roomId: string,
        typeChat?: string,
        limit: number = 60,
        options?: { userId?: string; targetUserId?: string; targetAgentId?: string }
    ): Promise<any[]> {
        const query: Record<string, any> = { roomId };

        // Nếu có truyền vào typeChat thì truy vấn chính xác từ collection chuyên biệt
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

            const TargetModel = getChatModelByType(typeChat);
            return await TargetModel.find(query)
                .sort({ createdAt: 1 })
                .limit(limit)
                .lean();
        }

        // Nếu không truyền typeChat (lấy tổng hợp toàn bộ phòng): Lấy từ ChatModel chung
        return await ChatModel.find(query)
            .sort({ createdAt: 1 })
            .limit(limit)
            .lean();
    }
}

export const chatRepository = new ChatRepository();