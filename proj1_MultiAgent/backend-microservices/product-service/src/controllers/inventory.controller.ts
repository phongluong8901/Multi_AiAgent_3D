import { Request, Response } from "express";
import { InventoryModel } from "../models/inventory.model";
import { ProductModel } from "../models/product.model";

/**
 * Controller quản lý kho lưu trữ Agent (Inventory) của người dùng.
 * Quản lý cả quyền sở hữu vĩnh viễn (owned) và quyền thuê giới hạn theo thời gian (rented).
 */
export class InventoryController {
    /**
     * Lấy danh sách các AI Agent trong kho của một User cụ thể.
     * Tự động tính toán hạn thuê còn lại (ms, giờ, ngày) và cờ hết hạn (isExpired).
     */
    async getUserInventory(req: Request, res: Response) {
        try {
            const { userId } = req.params;
            const items = await InventoryModel.find({ userId, isActive: true }).populate("productId");

            const now = new Date();
            const enriched = items.map((item: any) => {
                let isExpired = false;
                let remainingMs = 0;

                // Nếu là hình thức thuê và có thời hạn hết hạn
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

    /**
     * Kiểm tra nhanh quyền truy cập và sử dụng Agent của một User.
     * Sử dụng cho các dịch vụ khác (như Room-service hoặc Agent-service) trước khi kích hoạt Agent.
     */
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

            // Quyền sở hữu vĩnh viễn
            if (item.ownershipType === "owned") {
                return res.status(200).json({
                    success: true,
                    hasAccess: true,
                    ownershipType: "owned",
                    expiresAt: null,
                });
            }

            // Kiểm tra hiệu lực thời gian nếu là hình thức thuê
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
