import { ChatModel, IChat } from "../models/chat.model";

export class ChatRepository {
    async create(chatData: Partial<IChat>): Promise<IChat> {
        const chat = new ChatModel(chatData);
        return await chat.save();
    }

    async findByRoomId(roomId: string, limit: number = 50): Promise<IChat[]> {
        return await ChatModel.find({ roomId })
            .sort({ createdAt: 1 })
            .limit(limit);
    }
}

export const chatRepository = new ChatRepository();