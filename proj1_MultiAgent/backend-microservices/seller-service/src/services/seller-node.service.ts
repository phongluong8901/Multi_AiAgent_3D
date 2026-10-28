import { sellerNodeRepository } from "../repositories/seller-node.repository";
import { inferenceLogRepository } from "../repositories/inference-log.repository";
import { ISellerNode } from "../models/seller-node.model";

const DISTRIBUTED_SERVICE_URL = process.env.DISTRIBUTED_SERVICE_URL || "http://distributed-service:5010";

export class SellerNodeService {
    /**
     * Đồng bộ tự động các Partner Node đang trực tuyến từ Distributed Service (Go) sang Seller Marketplace (MongoDB)
     * để khi người dùng đăng ký đối tác tại /user-models hoặc /node-checker thì xuất hiện ngay trên Chợ Thuê (/owner).
     */
    async syncPartnerNodesFromDistributed(): Promise<void> {
        const urls = [DISTRIBUTED_SERVICE_URL, "http://localhost:5010"];
        for (const baseUrl of urls) {
            try {
                const res = await fetch(`${baseUrl}/api/v1/distributed/nodes`, {
                    signal: AbortSignal.timeout(2000),
                });
                if (!res.ok) continue;
                const data: any = await res.json();
                const partnerNodes: any[] = data?.nodes || [];

                for (const pn of partnerNodes) {
                    if (!pn.id) continue;
                    const existing = await sellerNodeRepository.findByNodeId(pn.id);
                    const statusMapped = pn.status === "OFFLINE" ? "OFFLINE" : pn.status === "BUSY" ? "BUSY" : "ONLINE";
                    if (!existing) {
                        const modelKey = pn.activeModel || pn.compatibleModels?.[0] || "qwen-2.5-coder-1.5b";
                        await sellerNodeRepository.create({
                            nodeId: pn.id,
                            sellerId: pn.userId || "usr_seller_01",
                            sellerName: pn.username || "Distributed Partner",
                            nodeName: `${pn.username || "Partner"} Workstation (${pn.hardware?.gpuName || "CPU Node"})`,
                            cpuCores: Number(pn.hardware?.cpuCores) || 8,
                            ramGB: Number(pn.hardware?.deviceMemoryGB) || 16,
                            gpuName: pn.hardware?.gpuName || "Integrated GPU",
                            vramGB: Number(pn.hardware?.vramGB) || 8,
                            hostedModel: modelKey,
                            modelDisplayName: modelKey,
                            localEndpoint: "http://localhost:11434",
                            coinsPerHour: Number(pn.rentConfig?.minPricePerHourCoin) || 35,
                            coinsPer1kTokens: 0.5,
                            status: statusMapped,
                            locationName: "Hà Nội, Việt Nam",
                            location: {
                                type: "Point",
                                coordinates: [105.7828, 21.0333],
                            },
                            rating: 5.0,
                            totalInferenceRequests: 0,
                            totalTokensServed: 0,
                            totalCoinsEarned: Number(pn.totalCoinsEarned) || 0,
                        });
                    } else if (existing.status !== statusMapped) {
                        await sellerNodeRepository.updateStatus(pn.id, statusMapped);
                    }
                }
                break;
            } catch {
                // Bỏ qua nếu distributed-service chưa sẵn sàng
            }
        }
    }

    async getMarketNodes(lng?: number, lat?: number, maxDistanceKm?: number): Promise<any[]> {
        await this.syncPartnerNodesFromDistributed();
        return await sellerNodeRepository.findMarketNodes(lng, lat, maxDistanceKm);
    }

    async getMyNodes(sellerId: string): Promise<ISellerNode[]> {
        await this.syncPartnerNodesFromDistributed();
        return await sellerNodeRepository.findBySellerId(sellerId);
    }

    async registerNode(data: any): Promise<ISellerNode> {
        const nodeId = data.nodeId || `node_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const existing = await sellerNodeRepository.findByNodeId(nodeId);
        if (existing) {
            return existing;
        }

        const lng = Number(data.lng) || (data.location?.coordinates?.[0] ?? 105.7828);
        const lat = Number(data.lat) || (data.location?.coordinates?.[1] ?? 21.0333);

        return await sellerNodeRepository.create({
            nodeId,
            sellerId: data.sellerId || "usr_seller_01",
            sellerName: data.sellerName || "Anonymous Host",
            nodeName: data.nodeName,
            cpuCores: Number(data.cpuCores) || 8,
            ramGB: Number(data.ramGB) || 16,
            gpuName: data.gpuName || "Integrated GPU",
            vramGB: Number(data.vramGB) || 8,
            hostedModel: data.hostedModel || "qwen-2.5-coder-1.5b",
            modelDisplayName: data.modelDisplayName || data.hostedModel || "Qwen 2.5 Coder (1.5B)",
            localEndpoint: data.localEndpoint || "http://localhost:11434",
            coinsPerHour: Number(data.coinsPerHour) || 30,
            coinsPer1kTokens: Number(data.coinsPer1kTokens) || 0.5,
            status: "ONLINE",
            locationName: data.locationName || "Hà Nội, Việt Nam",
            location: {
                type: "Point",
                coordinates: [lng, lat],
            },
            rating: 5.0,
            totalInferenceRequests: 0,
            totalTokensServed: 0,
            totalCoinsEarned: 0,
        });
    }

    async updateStatus(nodeId: string, status: "ONLINE" | "BUSY" | "OFFLINE") {
        return await sellerNodeRepository.updateStatus(nodeId, status);
    }

    async updatePricing(nodeId: string, coinsPerHour: number, coinsPer1kTokens: number) {
        return await sellerNodeRepository.updatePricing(nodeId, coinsPerHour, coinsPer1kTokens);
    }

    async getDashboard(sellerId: string) {
        await this.syncPartnerNodesFromDistributed();
        const myNodes = await sellerNodeRepository.findBySellerId(sellerId);
        const displayNodes = myNodes;

        const totalEarned = displayNodes.reduce((sum, n) => sum + (n.totalCoinsEarned || 0), 0);
        const totalRequests = displayNodes.reduce((sum, n) => sum + (n.totalInferenceRequests || 0), 0);
        const totalTokens = displayNodes.reduce((sum, n) => sum + (n.totalTokensServed || 0), 0);
        const activeNodesCount = displayNodes.filter((n) => n.status === "ONLINE").length;

        // Lấy lịch sử inference thực tế của các node thuộc seller này
        const myNodeIds = displayNodes.map((n) => n.nodeId);
        const recentLogs = myNodeIds.length > 0
            ? await inferenceLogRepository.findByNodeIds(myNodeIds, 15)
            : [];

        return {
            sellerId,
            summary: {
                totalCoinsEarned: Number(totalEarned.toFixed(2)),
                totalInferenceRequests: totalRequests,
                totalTokensServed: totalTokens,
                activeNodesCount,
                totalNodes: displayNodes.length,
                avgRating: 5.0,
            },
            nodes: displayNodes,
            recentTasks: recentLogs,
        };
    }
}

export const sellerNodeService = new SellerNodeService();
