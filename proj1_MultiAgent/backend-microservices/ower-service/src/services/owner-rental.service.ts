import { rentalSessionRepository } from "../repositories/rental-session.repository";
import { agentBindingRepository } from "../repositories/agent-binding.repository";
import { IRentalSession } from "../models/rental-session.model";
import { logger } from "../config/logger";

const SELLER_SERVICE_URL = process.env.SELLER_SERVICE_URL || "http://seller-service:5011";
const SAVECOIN_SERVICE_URL = process.env.SAVECOIN_SERVICE_URL || "http://savecoin-service:5006";

export class OwnerRentalService {
    async getMarketplaceNodes(lng?: number, lat?: number, radiusKm?: number) {
        const query = new URLSearchParams();
        if (lng !== undefined) query.set("lng", String(lng));
        if (lat !== undefined) query.set("lat", String(lat));
        if (radiusKm !== undefined) query.set("radiusKm", String(radiusKm));

        let rawNodes: any[] = [];
        const baseUrls = [SELLER_SERVICE_URL, "http://localhost:5011"];
        for (const baseUrl of baseUrls) {
            try {
                const url = `${baseUrl}/api/v1/seller/nodes/market?${query.toString()}`;
                const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
                if (res.ok) {
                    const data: any = await res.json();
                    if (data.nodes) {
                        rawNodes = data.nodes;
                        break;
                    }
                }
            } catch (err: any) {
                logger.warn(`Không kết nối được seller-service market (${baseUrl}):`, err.message);
            }
        }

        // Lọc bỏ những node đang nằm trong các phiên thuê ACTIVE (đã được thuê rồi)
        try {
            const activeSessions = await rentalSessionRepository.findAllActive();
            const rentedNodeIds = new Set(
                activeSessions.map((s) => s.nodeId).filter(Boolean)
            );
            return rawNodes.filter((node) => {
                const nId = node.nodeId || node.id;
                return !rentedNodeIds.has(nId);
            });
        } catch (err: any) {
            logger.warn(`Lỗi khi lọc các node đã thuê:`, err.message);
            return rawNodes;
        }
    }

    async startRental(data: any): Promise<IRentalSession> {
        const sessionId = `rent_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const modelKey = data.modelKey || data.modelId || data.hostedModel || "qwen-2.5-coder-1.5b";
        const modelDisplayName = data.modelDisplayName || modelKey;
        const coinsPerHour = Number(data.coinsPerHour ?? data.hourlyRate) || 30;
        const coinsPer1kTokens = Number(data.coinsPer1kTokens ?? data.tokenRate) || 0.5;
        const assignedAgentId = data.assignedAgentId || data.agentId || "agent_manager";

        const created = await rentalSessionRepository.create({
            sessionId,
            renterId: data.renterId || "usr_owner_01",
            renterName: data.renterName || "Agent Renter",
            nodeId: data.nodeId,
            nodeName: data.nodeName || "Local AI Compute Node",
            sellerId: data.sellerId || "usr_seller_01",
            modelKey,
            modelDisplayName,
            coinsPerHour,
            coinsPer1kTokens,
            startTime: new Date(),
            status: "ACTIVE",
            totalTokensUsed: 0,
            totalCoinsSpent: 0,
            assignedAgentId,
        });

        // Tự động tạo binding cho Agent nếu có truyền agentId
        try {
            await this.bindAgent({
                agentId: assignedAgentId,
                agentName: data.agentName || data.boundAgentName || "Multi-Agent System",
                rentalSessionId: sessionId,
                nodeId: data.nodeId,
                modelKey,
                ownerId: data.renterId || "usr_owner_01",
            });
        } catch {
            // Ignore
        }

        // Đồng bộ trạng thái Node sang BUSY trên seller-service (seller_db MongoDB)
        const sellerUrls = [SELLER_SERVICE_URL, "http://localhost:5011", "http://127.0.0.1:5011", "http://localhost:4000"];
        for (const sUrl of sellerUrls) {
            try {
                const patchRes = await fetch(`${sUrl}/api/v1/seller/nodes/${encodeURIComponent(data.nodeId)}/status`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "BUSY" }),
                    signal: AbortSignal.timeout(2500),
                });
                if (patchRes.ok) break;
            } catch {
                // Ignore
            }
        }

        // Đồng bộ trạng thái Node sang BUSY trên distributed-service (Neon PostgreSQL & Redis)
        const distUrls = ["http://distributed-service:5010", "http://localhost:5010", "http://127.0.0.1:5010", "http://localhost:4000"];
        for (const dUrl of distUrls) {
            try {
                const distRes = await fetch(`${dUrl}/api/v1/distributed/nodes/toggle-status`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nodeId: data.nodeId, status: "BUSY" }),
                    signal: AbortSignal.timeout(2500),
                });
                if (distRes.ok) break;
            } catch {
                // Ignore
            }
        }

        logger.info(`[RENTAL] Đã lưu phiên thuê ${sessionId} cho node ${data.nodeId} và cập nhật trạng thái BUSY trên toàn hệ thống`);
        return created;
    }

    async stopRental(sessionId: string): Promise<IRentalSession | null> {
        const stopped = await rentalSessionRepository.stopSession(sessionId);
        if (stopped) {
            // Đồng bộ trạng thái Node về ONLINE trên seller-service (MongoDB)
            const sellerUrls = [SELLER_SERVICE_URL, "http://localhost:5011", "http://127.0.0.1:5011", "http://localhost:4000"];
            for (const sUrl of sellerUrls) {
                try {
                    const patchRes = await fetch(`${sUrl}/api/v1/seller/nodes/${encodeURIComponent(stopped.nodeId)}/status`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "ONLINE" }),
                        signal: AbortSignal.timeout(2500),
                    });
                    if (patchRes.ok) break;
                } catch {
                    // Ignore
                }
            }

            // Đồng bộ trạng thái Node về IDLE trên distributed-service (PostgreSQL & Redis)
            const distUrls = ["http://distributed-service:5010", "http://localhost:5010", "http://127.0.0.1:5010", "http://localhost:4000"];
            for (const dUrl of distUrls) {
                try {
                    const distRes = await fetch(`${dUrl}/api/v1/distributed/nodes/toggle-status`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ nodeId: stopped.nodeId, status: "ONLINE" }),
                        signal: AbortSignal.timeout(2500),
                    });
                    if (distRes.ok) break;
                } catch {
                    // Ignore
                }
            }
            logger.info(`[RENTAL] Đã dừng phiên thuê ${sessionId} và chuyển node ${stopped.nodeId} về ONLINE`);
        }
        return stopped;
    }

    async getMyRentals(renterId: string): Promise<IRentalSession[]> {
        return await rentalSessionRepository.findByRenterId(renterId);
    }

    async bindAgent(data: any) {
        const bindingId = `bind_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const rentalSessionId = data.rentalSessionId || data.rentalId || "";
        if (rentalSessionId) {
            await rentalSessionRepository.updateBoundAgent(rentalSessionId, data.agentId, data.agentName);
        }
        return await agentBindingRepository.createOrUpdate({
            bindingId,
            agentId: data.agentId,
            agentName: data.agentName || "Multi-Agent System",
            rentalSessionId,
            nodeId: data.nodeId || "node_bound",
            modelKey: data.modelKey || data.modelId || "qwen-2.5-coder-1.5b",
            ownerId: data.ownerId || "usr_owner_01",
            isActive: true,
        });
    }

    async getDashboard(ownerId: string) {
        let rentals = await rentalSessionRepository.findByRenterId(ownerId);
        // Nếu người dùng đăng nhập bằng tài khoản thực nhưng phiên thuê trước đó lưu ở usr_owner_01, gộp cả hai
        if (rentals.length === 0 && ownerId !== "usr_owner_01") {
            rentals = await rentalSessionRepository.findByRenterId("usr_owner_01");
        }

        const activeRentals = rentals.filter((r) => r.status === "ACTIVE");
        const totalCoinsSpent = rentals.reduce((sum, r) => sum + (r.totalCoinsSpent || 0), 0);
        const totalTokensUsed = rentals.reduce((sum, r) => sum + (r.totalTokensUsed || 0), 0);
        const totalRequests = rentals.reduce((sum, r) => sum + (r.totalTokensUsed > 0 ? Math.max(1, Math.round(r.totalTokensUsed / 120)) : 0), 0);

        // Lấy số dư SaveCoin thực tế từ savecoin-service
        let availableCoinsBalance = 500;
        const coinUrls = [SAVECOIN_SERVICE_URL, "http://localhost:5006"];
        for (const cUrl of coinUrls) {
            try {
                const wRes = await fetch(`${cUrl}/api/v1/coins/wallet/${encodeURIComponent(ownerId)}`, {
                    signal: AbortSignal.timeout(2000),
                });
                if (wRes.ok) {
                    const wJson: any = await wRes.json();
                    if (wJson?.data?.balance !== undefined) {
                        availableCoinsBalance = Number(wJson.data.balance);
                        break;
                    }
                }
            } catch {
                // Ignore
            }
        }

        return {
            ownerId,
            summary: {
                totalCoinsSpent: Number(totalCoinsSpent.toFixed(2)),
                totalTokensUsed,
                totalTokensConsumed: totalTokensUsed,
                totalRequests,
                activeRentalsCount: activeRentals.length,
                totalRentalsCount: rentals.length,
                availableCoinsBalance,
            },
            activeRentals,
            allRentals: rentals,
            recentInferences: [],
        };
    }

    async getAllActiveConnections(): Promise<IRentalSession[]> {
        return await rentalSessionRepository.findAllActive();
    }
}

export const ownerRentalService = new OwnerRentalService();
