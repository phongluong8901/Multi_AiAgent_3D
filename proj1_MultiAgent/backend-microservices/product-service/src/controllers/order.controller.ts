import { Request, Response } from "express";
import { ProductModel } from "../models/product.model";
import { WalletModel } from "../models/wallet.model";
import { OrderModel } from "../models/order.model";
import { InventoryModel } from "../models/inventory.model";
import { publishEvent } from "../config/rabbitmq";

export class OrderController {
    // 1. Mua đứt Agent vĩnh viễn (Buy Once - Use Forever)
    async buyAgent(req: Request, res: Response) {
        try {
            const { userId, userName, agentId } = req.body;
            if (!userId || !agentId) {
                return res.status(400).json({ success: false, message: "Missing userId or agentId" });
            }

            const product = await ProductModel.findOne({ agentId });
            if (!product) {
                return res.status(404).json({ success: false, message: "Agent product not found" });
            }

            // Kiểm tra xem đã sở hữu chưa
            const existingInventory = await InventoryModel.findOne({ userId, agentId });
            if (existingInventory && existingInventory.ownershipType === "owned") {
                return res.status(400).json({ success: false, message: "Bạn đã sở hữu vĩnh viễn Agent này rồi!" });
            }

            // Kiểm tra ví
            let wallet = await WalletModel.findOne({ userId });
            if (!wallet) {
                wallet = await WalletModel.create({ userId, balance: 1000, transactions: [] });
            }

            const price = product.pricing.buyPrice;
            if (wallet.balance < price) {
                return res.status(400).json({
                    success: false,
                    message: `Số dư Coin không đủ (${wallet.balance} < ${price}). Vui lòng nạp thêm Coin!`,
                });
            }

            // Trừ tiền
            wallet.balance -= price;
            wallet.transactions.unshift({
                amount: -price,
                type: "purchase",
                description: `Mua đứt bản quyền vĩnh viễn Agent '${product.name}'`,
                createdAt: new Date(),
            });
            await wallet.save();

            // Tạo đơn hàng
            const order = await OrderModel.create({
                userId,
                userName: userName || "User",
                productId: product._id,
                agentId: product.agentId,
                agentName: product.name,
                orderType: "buy",
                amount: price,
                status: "completed",
                startDate: new Date(),
                endDate: null,
            });

            // Cập nhật Inventory
            const inventory = await InventoryModel.findOneAndUpdate(
                { userId, agentId },
                {
                    agentName: product.name,
                    productId: product._id,
                    ownershipType: "owned",
                    rentExpiresAt: null,
                    isActive: true,
                },
                { upsert: true, new: true }
            );

            // Tăng thống kê lượt mua
            product.totalBought += 1;
            await product.save();

            // Bắn sự kiện RabbitMQ
            await publishEvent("agent.purchased", {
                orderId: order._id,
                userId,
                agentId: product.agentId,
                agentName: product.name,
                ownershipType: "owned",
                purchasedAt: new Date(),
            });

            res.status(200).json({
                success: true,
                message: `Chúc mừng! Bạn đã sở hữu vĩnh viễn Agent '${product.name}' thành công!`,
                data: { order, inventory, remainingBalance: wallet.balance },
            });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // 2. Thuê Agent theo Giờ / Ngày / Tháng (Rent-to-Work)
    async rentAgent(req: Request, res: Response) {
        try {
            const { userId, userName, agentId, rentalDuration = "daily", durationUnits = 1 } = req.body;
            if (!userId || !agentId) {
                return res.status(400).json({ success: false, message: "Missing userId or agentId" });
            }

            const product = await ProductModel.findOne({ agentId });
            if (!product) {
                return res.status(404).json({ success: false, message: "Agent product not found" });
            }

            const existingInventory = await InventoryModel.findOne({ userId, agentId });
            if (existingInventory && existingInventory.ownershipType === "owned") {
                return res.status(400).json({ success: false, message: "Bạn đã sở hữu vĩnh viễn Agent này rồi, không cần thuê!" });
            }

            // Tính chi phí thuê
            const units = Math.max(1, Number(durationUnits));
            let unitPrice = product.pricing.rentDailyRate;
            let durationMs = units * 24 * 60 * 60 * 1000;

            if (rentalDuration === "hourly") {
                unitPrice = product.pricing.rentHourlyRate;
                durationMs = units * 60 * 60 * 1000;
            } else if (rentalDuration === "monthly") {
                unitPrice = product.pricing.rentMonthlyRate;
                durationMs = units * 30 * 24 * 60 * 60 * 1000;
            }

            const totalAmount = unitPrice * units;

            // Kiểm tra ví
            let wallet = await WalletModel.findOne({ userId });
            if (!wallet) {
                wallet = await WalletModel.create({ userId, balance: 1000, transactions: [] });
            }

            if (wallet.balance < totalAmount) {
                return res.status(400).json({
                    success: false,
                    message: `Số dư Coin không đủ để thuê (${wallet.balance} < ${totalAmount}). Vui lòng nạp thêm Coin!`,
                });
            }

            // Trừ tiền
            wallet.balance -= totalAmount;
            wallet.transactions.unshift({
                amount: -totalAmount,
                type: "rental",
                description: `Thuê Agent '${product.name}' (${units} ${rentalDuration})`,
                createdAt: new Date(),
            });
            await wallet.save();

            // Tính thời điểm kết thúc thuê (nối tiếp nếu đang còn hạn thuê)
            const now = new Date();
            let startDate = now;
            let endDate: Date;

            if (existingInventory && existingInventory.rentExpiresAt && new Date(existingInventory.rentExpiresAt) > now) {
                startDate = new Date(existingInventory.rentExpiresAt);
                endDate = new Date(startDate.getTime() + durationMs);
            } else {
                endDate = new Date(now.getTime() + durationMs);
            }

            // Tạo đơn hàng thuê
            const order = await OrderModel.create({
                userId,
                userName: userName || "User",
                productId: product._id,
                agentId: product.agentId,
                agentName: product.name,
                orderType: "rent",
                rentalDuration,
                durationUnits: units,
                amount: totalAmount,
                status: "active",
                startDate: now,
                endDate,
            });

            // Cập nhật Inventory
            const inventory = await InventoryModel.findOneAndUpdate(
                { userId, agentId },
                {
                    agentName: product.name,
                    productId: product._id,
                    ownershipType: "rented",
                    rentExpiresAt: endDate,
                    isActive: true,
                },
                { upsert: true, new: true }
            );

            // Tăng thống kê lượt thuê
            product.totalRented += 1;
            await product.save();

            // Bắn sự kiện RabbitMQ
            await publishEvent("agent.rented", {
                orderId: order._id,
                userId,
                agentId: product.agentId,
                agentName: product.name,
                rentalDuration,
                durationUnits: units,
                rentExpiresAt: endDate,
            });

            res.status(200).json({
                success: true,
                message: `Thuê Agent '${product.name}' thành công! Thời hạn sử dụng đến: ${endDate.toLocaleString("vi-VN")}`,
                data: { order, inventory, remainingBalance: wallet.balance },
            });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // 3. Lịch sử đơn hàng của User
    async getUserOrders(req: Request, res: Response) {
        try {
            const { userId } = req.params;
            const orders = await OrderModel.find({ userId }).sort({ createdAt: -1 });
            res.status(200).json({ success: true, count: orders.length, data: orders });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

export const orderController = new OrderController();
