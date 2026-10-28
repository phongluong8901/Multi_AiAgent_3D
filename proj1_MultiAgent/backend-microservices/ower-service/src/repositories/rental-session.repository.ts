import { RentalSessionModel, IRentalSession } from "../models/rental-session.model";

export class RentalSessionRepository {
    async create(data: Partial<IRentalSession>): Promise<IRentalSession> {
        const session = new RentalSessionModel(data);
        return await session.save();
    }

    async findBySessionId(sessionId: string): Promise<IRentalSession | null> {
        return await RentalSessionModel.findOne({ sessionId });
    }

    async findByRenterId(renterId: string): Promise<IRentalSession[]> {
        return await RentalSessionModel.find({ renterId }).sort({ createdAt: -1 });
    }

    async findActiveByRenterId(renterId: string): Promise<IRentalSession[]> {
        return await RentalSessionModel.find({ renterId, status: "ACTIVE" }).sort({ createdAt: -1 });
    }

    async findAllActive(): Promise<IRentalSession[]> {
        return await RentalSessionModel.find({ status: "ACTIVE" }).sort({ createdAt: -1 });
    }

    async stopSession(sessionId: string): Promise<IRentalSession | null> {
        return await RentalSessionModel.findOneAndUpdate(
            { sessionId },
            { $set: { status: "COMPLETED", endTime: new Date() } },
            { new: true }
        );
    }

    async incrementUsage(sessionId: string, tokens: number, coins: number): Promise<IRentalSession | null> {
        return await RentalSessionModel.findOneAndUpdate(
            { sessionId },
            {
                $inc: {
                    totalTokensUsed: tokens,
                    totalCoinsSpent: coins,
                },
            },
            { new: true }
        );
    }
}

export const rentalSessionRepository = new RentalSessionRepository();
