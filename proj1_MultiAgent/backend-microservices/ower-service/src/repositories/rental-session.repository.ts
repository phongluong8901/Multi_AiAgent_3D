import { RentalSessionModel, IRentalSession } from "../models/rental-session.model";
import { logger } from "../config/logger";

export class RentalSessionRepository {
    private inMemorySessions: Map<string, IRentalSession> = new Map();

    async create(data: Partial<IRentalSession>): Promise<IRentalSession> {
        try {
            const session = new RentalSessionModel(data);
            const saved = await session.save();
            this.inMemorySessions.set(saved.sessionId, saved);
            return saved;
        } catch (err: any) {
            logger.warn("Mongoose save failed, using memory cache fallback:", err.message);
            const fallbackSession: any = {
                ...data,
                _id: `mem_${Date.now()}`,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            this.inMemorySessions.set(data.sessionId!, fallbackSession);
            return fallbackSession;
        }
    }

    async findBySessionId(sessionId: string): Promise<IRentalSession | null> {
        try {
            const found = await RentalSessionModel.findOne({ sessionId });
            if (found) return found;
        } catch (err: any) {
            logger.warn("Mongoose findBySessionId error, falling back to cache:", err.message);
        }
        return this.inMemorySessions.get(sessionId) || null;
    }

    async findByRenterId(renterId: string): Promise<IRentalSession[]> {
        try {
            const dbList = await RentalSessionModel.find({
                $or: [{ renterId }, { renterId: "usr_owner_01" }],
            }).sort({ createdAt: -1 });
            if (dbList.length > 0) return dbList;
        } catch (err: any) {
            logger.warn("Mongoose findByRenterId error, falling back to cache:", err.message);
        }

        return Array.from(this.inMemorySessions.values()).filter(
            (s) => s.renterId === renterId || s.renterId === "usr_owner_01"
        );
    }

    async findActiveByRenterId(renterId: string): Promise<IRentalSession[]> {
        try {
            const dbList = await RentalSessionModel.find({
                $or: [{ renterId }, { renterId: "usr_owner_01" }],
                status: "ACTIVE",
            }).sort({ createdAt: -1 });
            if (dbList.length > 0) return dbList;
        } catch (err: any) {
            logger.warn("Mongoose findActiveByRenterId error, falling back to cache:", err.message);
        }

        return Array.from(this.inMemorySessions.values()).filter(
            (s) => (s.renterId === renterId || s.renterId === "usr_owner_01") && s.status === "ACTIVE"
        );
    }

    async findAllActive(): Promise<IRentalSession[]> {
        try {
            const dbList = await RentalSessionModel.find({ status: "ACTIVE" }).sort({ createdAt: -1 });
            if (dbList.length > 0) return dbList;
        } catch (err: any) {
            logger.warn("Mongoose findAllActive error, falling back to cache:", err.message);
        }

        return Array.from(this.inMemorySessions.values()).filter((s) => s.status === "ACTIVE");
    }

    async stopSession(sessionId: string): Promise<IRentalSession | null> {
        let stopped: any = null;
        try {
            stopped = await RentalSessionModel.findOneAndUpdate(
                { sessionId },
                { $set: { status: "COMPLETED", endTime: new Date() } },
                { new: true }
            );
        } catch (err: any) {
            logger.warn("Mongoose stopSession error, updating cache:", err.message);
        }

        if (this.inMemorySessions.has(sessionId)) {
            const cached: any = this.inMemorySessions.get(sessionId);
            cached.status = "COMPLETED";
            cached.endTime = new Date();
            if (!stopped) stopped = cached;
        }

        return stopped;
    }

    async incrementUsage(sessionId: string, tokens: number, coins: number): Promise<IRentalSession | null> {
        let updated: any = null;
        try {
            updated = await RentalSessionModel.findOneAndUpdate(
                { sessionId },
                {
                    $inc: {
                        totalTokensUsed: tokens,
                        totalCoinsSpent: coins,
                    },
                },
                { new: true }
            );
        } catch (err: any) {
            logger.warn("Mongoose incrementUsage error, updating cache:", err.message);
        }

        if (this.inMemorySessions.has(sessionId)) {
            const cached: any = this.inMemorySessions.get(sessionId);
            cached.totalTokensUsed = (cached.totalTokensUsed || 0) + tokens;
            cached.totalCoinsSpent = (cached.totalCoinsSpent || 0) + coins;
            if (!updated) updated = cached;
        }

        return updated;
    }

    async updateBoundAgent(sessionId: string, agentId: string, agentName?: string): Promise<IRentalSession | null> {
        let updated: any = null;
        try {
            updated = await RentalSessionModel.findOneAndUpdate(
                { sessionId },
                {
                    $set: {
                        boundAgentId: agentId,
                        boundAgentName: agentName || "Multi-Agent System",
                    },
                },
                { new: true }
            );
        } catch (err: any) {
            logger.warn("Mongoose updateBoundAgent error, updating cache:", err.message);
        }

        if (this.inMemorySessions.has(sessionId)) {
            const cached: any = this.inMemorySessions.get(sessionId);
            cached.boundAgentId = agentId;
            cached.boundAgentName = agentName || "Multi-Agent System";
            if (!updated) updated = cached;
        }

        return updated;
    }
}

export const rentalSessionRepository = new RentalSessionRepository();
