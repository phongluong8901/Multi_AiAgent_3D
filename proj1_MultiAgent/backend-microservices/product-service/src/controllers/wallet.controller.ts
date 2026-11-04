import { Request, Response } from "express";
import { WalletModel } from "../models/wallet.model";

export class WalletController {
    async getWallet(req: Request, res: Response) {
        try {
            const userId = req.headers["x-user-id"] as string || (req.query.userId as string);
            if (!userId) {
                return res.status(400).json({ success: false, message: "Missing userId" });
            }

            let wallet = await WalletModel.findOne({ userId });
            if (!wallet) {
                // Tự động khởi tạo ví với 1000 Coin ban đầu
                wallet = await WalletModel.create({
                    userId,
                    balance: 1000,
                    transactions: [
                        {
                            amount: 1000,
                            type: "deposit",
                            description: "Chào mừng! Tặng 1,000 Coin trải nghiệm dịch vụ AI Agent.",
                            createdAt: new Date(),
                        },
                    ],
                });
            }

            res.status(200).json({ success: true, data: wallet });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async faucet(req: Request, res: Response) {
        try {
            const { userId, amount = 500 } = req.body;
            if (!userId) {
                return res.status(400).json({ success: false, message: "Missing userId" });
            }

            let wallet = await WalletModel.findOne({ userId });
            if (!wallet) {
                wallet = new WalletModel({ userId, balance: 0, transactions: [] });
            }

            wallet.balance += Number(amount);
            wallet.transactions.unshift({
                amount: Number(amount),
                type: "deposit",
                description: `Nạp thử nghiệm +${amount} Coin vào ví.`,
                createdAt: new Date(),
            });

            await wallet.save();
            res.status(200).json({ success: true, message: `Nạp thành công +${amount} Coin!`, data: wallet });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

export const walletController = new WalletController();
