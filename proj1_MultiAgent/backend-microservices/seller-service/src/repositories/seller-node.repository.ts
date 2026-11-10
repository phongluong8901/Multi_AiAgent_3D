import { SellerNodeModel, ISellerNode } from "../models/seller-node.model";

/**
 * Tính toán khoảng cách địa lý (tính theo km) giữa 2 tọa độ GPS bằng công thức Haversine.
 * 
 * @param lat1 Vĩ độ điểm 1
 * @param lon1 Kinh độ điểm 1
 * @param lat2 Vĩ độ điểm 2
 * @param lon2 Kinh độ điểm 2
 * @returns Khoảng cách theo km làm tròn 1 chữ số thập phân
 */
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

/**
 * Repository tầng truy cập dữ liệu (Data Access Layer) cho thực thể SellerNode trong MongoDB.
 */
export class SellerNodeRepository {
    /** Tạo mới một Node cho thuê */
    async create(data: Partial<ISellerNode>): Promise<ISellerNode> {
        const node = new SellerNodeModel(data);
        return await node.save();
    }

    /** Tìm Node theo nodeId duy nhất */
    async findByNodeId(nodeId: string): Promise<ISellerNode | null> {
        return await SellerNodeModel.findOne({ nodeId });
    }

    /** Lấy tất cả các Node sắp xếp theo thời gian tạo mới nhất */
    async findAll(): Promise<ISellerNode[]> {
        return await SellerNodeModel.find().sort({ createdAt: -1 });
    }

    /** Lấy danh sách các Node do một đối tác sở hữu */
    async findBySellerId(sellerId: string): Promise<ISellerNode[]> {
        return await SellerNodeModel.find({ sellerId }).sort({ createdAt: -1 });
    }

    /**
     * Tìm kiếm các Node đang mở cho thuê trên chợ (ONLINE hoặc BUSY).
     * Tự động tính toán khoảng cách km so với tọa độ của người thuê nếu có truyền `userLng` và `userLat`.
     */
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

    /** Cập nhật trạng thái vận hành của Node */
    async updateStatus(nodeId: string, status: "ONLINE" | "BUSY" | "OFFLINE"): Promise<ISellerNode | null> {
        return await SellerNodeModel.findOneAndUpdate(
            { nodeId },
            { $set: { status, lastPingAt: new Date() } },
            { new: true }
        );
    }

    /** Cập nhật thông số phần cứng và trạng thái hoạt động của Node */
    async updateSpecsAndStatus(nodeId: string, specs: Partial<ISellerNode>): Promise<ISellerNode | null> {
        return await SellerNodeModel.findOneAndUpdate(
            { nodeId },
            { $set: { ...specs, lastPingAt: new Date() } },
            { new: true }
        );
    }

    /** Cập nhật đơn giá cho thuê tài nguyên */
    async updatePricing(nodeId: string, coinsPerHour: number, coinsPer1kTokens: number): Promise<ISellerNode | null> {
        return await SellerNodeModel.findOneAndUpdate(
            { nodeId },
            { $set: { coinsPerHour, coinsPer1kTokens } },
            { new: true }
        );
    }

    /** Cập nhật số liệu tích lũy doanh thu và token sau mỗi phiên suy luận */
    async incrementStats(nodeId: string, tokens: number, coinsEarned: number): Promise<void> {
        await SellerNodeModel.updateOne(
            { nodeId },
            {
                $inc: {
                    totalInferenceRequests: 1,
                    totalTokensServed: tokens,
                    totalCoinsEarned: coinsEarned,
                },
                $set: { lastPingAt: new Date() },
            }
        );
    }
}

export const sellerNodeRepository = new SellerNodeRepository();
