import { SellerNodeModel, ISellerNode } from "../models/seller-node.model";

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Bán kính Trái Đất (km)
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(1));
}

export class SellerNodeRepository {
    async create(data: Partial<ISellerNode>): Promise<ISellerNode> {
        const node = new SellerNodeModel(data);
        return await node.save();
    }

    async findByNodeId(nodeId: string): Promise<ISellerNode | null> {
        return await SellerNodeModel.findOne({ nodeId });
    }

    async findAll(): Promise<ISellerNode[]> {
        return await SellerNodeModel.find().sort({ createdAt: -1 });
    }

    async findBySellerId(sellerId: string): Promise<ISellerNode[]> {
        return await SellerNodeModel.find({ sellerId }).sort({ createdAt: -1 });
    }

    async findMarketNodes(userLng?: number, userLat?: number, maxDistanceKm?: number): Promise<any[]> {
        const nodes = await SellerNodeModel.find({ status: { $in: ["ONLINE", "BUSY"] } }).sort({ coinsPerHour: 1 });

        const nodesWithDistance = nodes.map((doc) => {
            const node = doc.toObject() as any;
            if (userLat !== undefined && userLng !== undefined && node.location?.coordinates) {
                const [nLon, nLat] = node.location.coordinates;
                node.distanceKm = calculateDistanceKm(userLat, userLng, nLat, nLon);
            } else {
                node.distanceKm = undefined;
            }
            return node;
        });

        if (userLat !== undefined && userLng !== undefined) {
            let filtered = nodesWithDistance;
            if (maxDistanceKm && maxDistanceKm > 0) {
                filtered = nodesWithDistance.filter((n) => n.distanceKm <= maxDistanceKm);
            }
            return filtered.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
        }

        return nodesWithDistance;
    }

    async updateStatus(nodeId: string, status: "ONLINE" | "BUSY" | "OFFLINE"): Promise<ISellerNode | null> {
        return await SellerNodeModel.findOneAndUpdate(
            { nodeId },
            { $set: { status, lastPingAt: new Date() } },
            { new: true }
        );
    }

    async updateSpecsAndStatus(
        nodeId: string,
        specs: {
            cpuCores?: number;
            ramGB?: number;
            gpuName?: string;
            vramGB?: number;
            coinsPerHour?: number;
            status?: "ONLINE" | "BUSY" | "OFFLINE";
            hostedModel?: string;
            modelDisplayName?: string;
        }
    ): Promise<ISellerNode | null> {
        return await SellerNodeModel.findOneAndUpdate(
            { nodeId },
            {
                $set: {
                    ...specs,
                    lastPingAt: new Date(),
                },
            },
            { new: true }
        );
    }

    async updatePricing(nodeId: string, coinsPerHour: number, coinsPer1kTokens: number): Promise<ISellerNode | null> {
        return await SellerNodeModel.findOneAndUpdate(
            { nodeId },
            { $set: { coinsPerHour, coinsPer1kTokens } },
            { new: true }
        );
    }

    async incrementStats(nodeId: string, tokens: number, coins: number): Promise<ISellerNode | null> {
        return await SellerNodeModel.findOneAndUpdate(
            { nodeId },
            {
                $inc: {
                    totalInferenceRequests: 1,
                    totalTokensServed: tokens,
                    totalCoinsEarned: coins,
                },
                $set: { lastPingAt: new Date() },
            },
            { new: true }
        );
    }
}

export const sellerNodeRepository = new SellerNodeRepository();
