import { RentalSessionModel, IRentalSession } from "../models/rental-session.model";
import { logger } from "../config/logger";

/**
 * Repository quan ly du lieu Phien Thue Node Phan Cung (Rental Sessions):
 * Ho tro co che Persistent Database (MongoDB) ket hop In-Memory Cache Fallback
 * dam bao dich vu luon san sang ke ca khi database gap su co.
 */
export class RentalSessionRepository {
    private inMemorySessions: Map<string, IRentalSession> = new Map();

    /**
     * Khoi tao phien thue may moi
     */
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

    /**
     * Tim kiem chi tiet phien thue theo sessionId
     */
    async findBySessionId(sessionId: string): Promise<IRentalSession | null> {
        try {
            const found = await RentalSessionModel.findOne({ sessionId });
            if (found) return found;
        } catch (err: any) {
            logger.warn("Mongoose findBySessionId error, falling back to cache:", err.message);
        }
        return this.inMemorySessions.get(sessionId) || null;
    }

    /**
     * Lay danh sach tat ca phien thue cua mot nguoi thue (Renter)
     */
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

    /**
     * Lay danh sach cac phien dang ACTIVE cua mot Renter
     */
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

    /**
     * Lay tat ca phien dang ACTIVE trong toan bo he thong
     */
    async findAllActive(): Promise<IRentalSession[]> {
        try {
            const dbList = await RentalSessionModel.find({ status: "ACTIVE" }).sort({ createdAt: -1 });
            if (dbList.length > 0) return dbList;
        } catch (err: any) {
            logger.warn("Mongoose findAllActive error, falling back to cache:", err.message);
        }

        return Array.from(this.inMemorySessions.values()).filter((s) => s.status === "ACTIVE");
    }

    /**
     * Ket thuc va dung phien thue (chuyen trang thai sang COMPLETED)
     */
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

    /**
     * Cong don so token da su dung va so SaveCoin da tieu vao phien thue
     */
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

    /**
     * Gan hoac doi Agent duoc phep su dung phien thue nay
     */
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
