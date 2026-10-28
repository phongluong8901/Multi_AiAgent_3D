import { Request, Response } from "express";
import { sellerNodeService } from "../services/seller-node.service";
import { inferenceService } from "../services/inference.service";

export class SellerController {
    async getMarketNodes(req: Request, res: Response) {
        try {
            const lng = req.query.lng ? Number(req.query.lng) : undefined;
            const lat = req.query.lat ? Number(req.query.lat) : undefined;
            const radiusKm = req.query.radiusKm ? Number(req.query.radiusKm) : undefined;
            const nodes = await sellerNodeService.getMarketNodes(lng, lat, radiusKm);
            res.status(200).json({ success: true, count: nodes.length, nodes });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async getMyNodes(req: Request, res: Response) {
        try {
            const sellerId = (req.query.sellerId as string) || "usr_seller_01";
            const nodes = await sellerNodeService.getMyNodes(sellerId);
            res.status(200).json({ success: true, count: nodes.length, nodes });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async registerNode(req: Request, res: Response) {
        try {
            const newNode = await sellerNodeService.registerNode(req.body);
            res.status(201).json({ success: true, message: "Đăng ký Node cho thuê thành công!", node: newNode });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async updateStatus(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const updated = await sellerNodeService.updateStatus(id, status);
            if (!updated) {
                return res.status(404).json({ success: false, message: "Không tìm thấy Node" });
            }
            res.status(200).json({ success: true, message: `Trạng thái Node đã chuyển sang ${status}`, node: updated });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async updatePricing(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { coinsPerHour, coinsPer1kTokens } = req.body;
            const updated = await sellerNodeService.updatePricing(id, Number(coinsPerHour), Number(coinsPer1kTokens));
            if (!updated) {
                return res.status(404).json({ success: false, message: "Không tìm thấy Node" });
            }
            res.status(200).json({ success: true, message: "Cập nhật bảng giá cho thuê thành công!", node: updated });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async executeInference(req: Request, res: Response) {
        try {
            const nodeId = req.params.id || req.body.nodeId;
            const { renterId = "usr_renter_default", prompt, systemPrompt, temperature, maxTokens } = req.body;

            if (!prompt) {
                return res.status(400).json({ success: false, message: "Prompt không được để trống" });
            }

            const result = await inferenceService.executeInference({
                nodeId,
                renterId,
                prompt,
                systemPrompt,
                temperature,
                maxTokens,
            });

            res.status(200).json({ success: true, ...result });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async getDashboard(req: Request, res: Response) {
        try {
            const sellerId = (req.query.sellerId as string) || "usr_seller_01";
            const data = await sellerNodeService.getDashboard(sellerId);
            res.status(200).json({ success: true, ...data });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

export const sellerController = new SellerController();
