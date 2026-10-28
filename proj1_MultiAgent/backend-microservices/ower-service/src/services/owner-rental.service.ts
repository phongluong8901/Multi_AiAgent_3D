import { rentalSessionRepository } from "../repositories/rental-session.repository";
import { agentBindingRepository } from "../repositories/agent-binding.repository";
import { IRentalSession } from "../models/rental-session.model";
import { logger } from "../config/logger";

const SELLER_SERVICE_URL = process.env.SELLER_SERVICE_URL || "http://seller-service:5011";

export class OwnerRentalService {
    async getMarketplaceNodes(lng?: number, lat?: number, radiusKm?: number) {
        try {
            const query = new URLSearchParams();
            if (lng !== undefined) query.set("lng", String(lng));
            if (lat !== undefined) query.set("lat", String(lat));
            if (radiusKm !== undefined) query.set("radiusKm", String(radiusKm));

            const url = `${SELLER_SERVICE_URL}/api/v1/seller/nodes/market?${query.toString()}`;
            const res = await fetch(url);
            if (res.ok) {
                const data: any = await res.json();
                if (data.nodes) return data.nodes;
            }
        } catch (err: any) {
            logger.warn("Không kết nối được seller-service market:", err.message);
        }

        // Không trả về dữ liệu ảo: trả về mảng rỗng nếu chưa có node nào
        return [];
    }

    async startRental(data: any): Promise<IRentalSession> {
        const sessionId = `rent_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        return await rentalSessionRepository.create({
            sessionId,
            renterId: data.renterId || "usr_owner_01",
            renterName: data.renterName || "Agent Renter",
            nodeId: data.nodeId,
            nodeName: data.nodeName || "Local AI Compute Node",
            sellerId: data.sellerId || "usr_seller_unknown",
            modelKey: data.modelKey,
            modelDisplayName: data.modelDisplayName || data.modelKey,
            coinsPerHour: Number(data.coinsPerHour) || 30,
            coinsPer1kTokens: Number(data.coinsPer1kTokens) || 0.5,
            startTime: new Date(),
            status: "ACTIVE",
            totalTokensUsed: 0,
            totalCoinsSpent: 0,
            assignedAgentId: data.assignedAgentId || "agent_coder_v1",
        });
    }

    async stopRental(sessionId: string): Promise<IRentalSession | null> {
        return await rentalSessionRepository.stopSession(sessionId);
    }

    async getMyRentals(renterId: string): Promise<IRentalSession[]> {
        return await rentalSessionRepository.findByRenterId(renterId);
    }

    async bindAgent(data: any) {
        const bindingId = `bind_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        return await agentBindingRepository.createOrUpdate({
            bindingId,
            agentId: data.agentId,
            agentName: data.agentName || "Multi-Agent System",
            rentalSessionId: data.rentalSessionId,
            nodeId: data.nodeId,
            modelKey: data.modelKey,
            ownerId: data.ownerId || "usr_owner_01",
            isActive: true,
        });
    }

    async getDashboard(ownerId: string) {
        const rentals = await rentalSessionRepository.findByRenterId(ownerId);
        const activeRentals = rentals.filter((r) => r.status === "ACTIVE");
        const totalCoinsSpent = rentals.reduce((sum, r) => sum + (r.totalCoinsSpent || 0), 0);
        const totalTokensUsed = rentals.reduce((sum, r) => sum + (r.totalTokensUsed || 0), 0);

        return {
            ownerId,
            summary: {
                totalCoinsSpent: Number(totalCoinsSpent.toFixed(2)),
                totalTokensUsed,
                activeRentalsCount: activeRentals.length,
                totalRentalsCount: rentals.length,
                availableCoinsBalance: 0,
            },
            activeRentals,
            allRentals: rentals,
        };
    }
}

export const ownerRentalService = new OwnerRentalService();
