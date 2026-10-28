import { sellerNodeRepository } from "../repositories/seller-node.repository";
import { inferenceLogRepository } from "../repositories/inference-log.repository";
import { ISellerNode } from "../models/seller-node.model";

export class SellerNodeService {
    async getMarketNodes(lng?: number, lat?: number, maxDistanceKm?: number): Promise<any[]> {
        return await sellerNodeRepository.findMarketNodes(lng, lat, maxDistanceKm);
    }

    async getMyNodes(sellerId: string): Promise<ISellerNode[]> {
        return await sellerNodeRepository.findBySellerId(sellerId);
    }

    async registerNode(data: any): Promise<ISellerNode> {
        const nodeId = `node_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
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
            hostedModel: data.hostedModel,
            modelDisplayName: data.modelDisplayName || data.hostedModel,
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
            },
            nodes: displayNodes,
            recentTasks: recentLogs,
        };
    }
}

export const sellerNodeService = new SellerNodeService();
