import { Request, Response } from "express";
import { InventoryModel } from "../models/inventory.model";
import { ProductModel } from "../models/product.model";

export class InventoryController {
    // 1. Lấy danh sách Agent trong kho của User
    async getUserInventory(req: Request, res: Response) {
        try {
            const { userId } = req.params;
            const items = await InventoryModel.find({ userId, isActive: true }).populate("productId");

            const now = new Date();
            const enriched = items.map((item) => {
                let isExpired = false;
                let remainingMs = 0;

                if (item.ownershipType === "rented" && item.rentExpiresAt) {
                    const expiry = new Date(item.rentExpiresAt);
                    remainingMs = expiry.getTime() - now.getTime();
                    if (remainingMs <= 0) {
                        isExpired = true;
                        remainingMs = 0;
                    }
                }

                return {
                    ...item.toObject(),
                    isExpired,
                    remainingMs,
                    remainingHours: Math.round(remainingMs / (1000 * 60 * 60)),
                    remainingDays: Math.round(remainingMs / (1000 * 60 * 60 * 24)),
                };
            });

            res.status(200).json({ success: true, count: enriched.length, data: enriched });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // 2. Kiểm tra xem User có quyền dùng Agent này không (dành cho Room/Agent-service)
    async checkAgentAccess(req: Request, res: Response) {
        try {
            const { userId, agentId } = req.query;
            if (!userId || !agentId) {
                return res.status(400).json({ success: false, message: "Missing userId or agentId" });
            }

            const item = await InventoryModel.findOne({ userId, agentId, isActive: true });
            if (!item) {
                return res.status(200).json({
                    success: true,
                    hasAccess: false,
                    reason: "Chưa mua hoặc chưa thuê Agent này",
                });
            }

            if (item.ownershipType === "owned") {
                return res.status(200).json({
                    success: true,
                    hasAccess: true,
                    ownershipType: "owned",
                    expiresAt: null,
                });
            }

            // Nếu là thuê, kiểm tra hạn
            const now = new Date();
            if (item.rentExpiresAt && new Date(item.rentExpiresAt) <= now) {
                return res.status(200).json({
                    success: true,
                    hasAccess: false,
                    ownershipType: "rented",
                    isExpired: true,
                    reason: "Hạn thuê Agent đã hết, vui lòng gia hạn!",
                    expiresAt: item.rentExpiresAt,
                });
            }

            return res.status(200).json({
                success: true,
                hasAccess: true,
                ownershipType: "rented",
                isExpired: false,
                expiresAt: item.rentExpiresAt,
            });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

export const inventoryController = new InventoryController();
