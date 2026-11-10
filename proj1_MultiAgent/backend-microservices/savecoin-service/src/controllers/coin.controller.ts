import { Request, Response } from "express";
import { WalletModel } from "../models/wallet.model";
import { CoinTransactionModel } from "../models/transaction.model";
import { SYSTEM_PLAN_TASKS, UserTaskProgressModel } from "../models/task.model";

export class CoinController {
    // 1. Lấy thông tin ví của User (Tự khởi tạo nếu chưa có)
    static async getWallet(req: Request, res: Response) {
        try {
            const { userId } = req.params;
            const { userName } = req.query;

            if (!userId) {
                return res.status(400).json({ success: false, message: "Thiếu userId" });
            }

            let wallet = await WalletModel.findOne({ userId });

            if (!wallet) {
                wallet = await WalletModel.create({
                    userId,
                    userName: (userName as string) || "Thành viên",
                    balance: 500,
                    totalEarned: 500,
                    totalSpent: 0,
                });

                // Ghi nhận giao dịch chào mừng
                await CoinTransactionModel.create({
                    transactionId: `tx_init_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                    userId,
                    amount: 500,
                    type: "faucet",
                    reason: "Quà tặng chào mừng thành viên mới (+500 Coins)",
                    source: "system",
                });
            }

            return res.status(200).json({
                success: true,
                data: wallet,
            });
        } catch (error: any) {
            console.error("[savecoin-service] Error getWallet:", error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // 2. Nhận thêm Coin Faucet (+500 Coins)
    static async faucet(req: Request, res: Response) {
        try {
            const { userId, amount = 500 } = req.body;

            if (!userId) {
                return res.status(400).json({ success: false, message: "Thiếu userId" });
            }

            const wallet = await WalletModel.findOneAndUpdate(
                { userId },
                {
                    $inc: { balance: Number(amount), totalEarned: Number(amount) },
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            const tx = await CoinTransactionModel.create({
                transactionId: `tx_faucet_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                userId,
                amount: Number(amount),
                type: "faucet",
                reason: `Vòi nhận Coin thử nghiệm (+${amount} Coins)`,
                source: "faucet",
            });

            return res.status(200).json({
                success: true,
                message: `Đã nạp thành công +${amount} Coins vào ví!`,
                data: {
                    wallet,
                    transaction: tx,
                },
            });
        } catch (error: any) {
            console.error("[savecoin-service] Error faucet:", error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // 3. Cộng coin thưởng (Được gọi tự động từ MapDraw Service hoặc nhiệm vụ)
    static async reward(req: Request, res: Response) {
        try {
            const { userId, amount, reason, source, metadata } = req.body;

            if (!userId || !amount || Number(amount) <= 0) {
                return res.status(400).json({ success: false, message: "Dữ liệu thưởng không hợp lệ" });
            }

            const earnAmount = Number(amount);

            // Cập nhật ví
            const wallet = await WalletModel.findOneAndUpdate(
                { userId },
                {
                    $inc: { balance: earnAmount, totalEarned: earnAmount },
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            // Ghi nhận transaction
            const tx = await CoinTransactionModel.create({
                transactionId: `tx_reward_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                userId,
                amount: earnAmount,
                type: "reward",
                reason: reason || "Thưởng hoàn thành nhiệm vụ kiến tạo không gian 3D",
                source: source || "mapdraw",
                metadata: metadata || {},
            });

            return res.status(200).json({
                success: true,
                message: `Chúc mừng! Bạn đã nhận thưởng +${earnAmount} Coins!`,
                data: {
                    wallet,
                    transaction: tx,
                },
            });
        } catch (error: any) {
            console.error("[savecoin-service] Error reward:", error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // 4. Trừ coin (Dành cho mua / thuê Agent)
    static async spend(req: Request, res: Response) {
        try {
            const { userId, amount, reason, metadata } = req.body;

            if (!userId || !amount || Number(amount) <= 0) {
                return res.status(400).json({ success: false, message: "Dữ liệu chi tiêu không hợp lệ" });
            }

            const spendAmount = Number(amount);
            const wallet = await WalletModel.findOne({ userId });

            if (!wallet || wallet.balance < spendAmount) {
                return res.status(400).json({
                    success: false,
                    message: "Số dư Coins không đủ để thực hiện giao dịch này. Hãy làm thêm nhiệm vụ hoặc dùng vòi Faucet!",
                });
            }

            wallet.balance -= spendAmount;
            wallet.totalSpent += spendAmount;
            await wallet.save();

            const tx = await CoinTransactionModel.create({
                transactionId: `tx_spend_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                userId,
                amount: -spendAmount,
                type: "spend",
                reason: reason || "Chi tiêu coin trong hệ sinh thái Agent",
                source: "store",
                metadata: metadata || {},
            });

            return res.status(200).json({
                success: true,
                message: `Đã thanh toán -${spendAmount} Coins`,
                data: {
                    wallet,
                    transaction: tx,
                },
            });
        } catch (error: any) {
            console.error("[savecoin-service] Error spend:", error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // 5. Lấy danh sách Plan Tasks kèm tiến độ của User
    static async getTasks(req: Request, res: Response) {
        try {
            const { userId } = req.params;

            const userProgressList = userId
                ? await UserTaskProgressModel.find({ userId }).lean()
                : [];

            const progressMap = new Map<string, any>();
            userProgressList.forEach((p) => progressMap.set(p.taskCode, p));

            const tasks = SYSTEM_PLAN_TASKS.map((def) => {
                const userProg = progressMap.get(def.code);
                const currentCount = userProg ? userProg.progress : 0;
                const isCompleted = userProg ? userProg.completed : false;
                const isClaimed = userProg ? userProg.claimed : false;

                return {
                    code: def.code,
                    title: def.title,
                    description: def.description,
                    category: def.category,
                    rewardCoins: def.rewardCoins,
                    icon: def.icon,
                    targetCount: def.targetCount,
                    unit: def.unit,
                    currentProgress: currentCount,
                    isCompleted: currentCount >= def.targetCount || isCompleted,
                    isClaimed,
                };
            });

            return res.status(200).json({
                success: true,
                data: tasks,
            });
        } catch (error: any) {
            console.error("[savecoin-service] Error getTasks:", error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // 6. Nhận thưởng (Claim) Coin từ Plan Task
    static async claimTask(req: Request, res: Response) {
        try {
            const { userId, taskCode } = req.body;

            if (!userId || !taskCode) {
                return res.status(400).json({ success: false, message: "Thiếu userId hoặc taskCode" });
            }

            const taskDef = SYSTEM_PLAN_TASKS.find((t) => t.code === taskCode);
            if (!taskDef) {
                return res.status(404).json({ success: false, message: "Nhiệm vụ không tồn tại" });
            }

            let userProg = await UserTaskProgressModel.findOne({ userId, taskCode });

            if (!userProg || (!userProg.completed && userProg.progress < taskDef.targetCount)) {
                return res.status(400).json({
                    success: false,
                    message: "Bạn chưa hoàn thành mục tiêu của nhiệm vụ này!",
                });
            }

            if (userProg.claimed) {
                return res.status(400).json({
                    success: false,
                    message: "Bạn đã nhận phần thưởng cho nhiệm vụ này rồi!",
                });
            }

            // Đánh dấu đã nhận
            userProg.claimed = true;
            userProg.lastClaimedAt = new Date();
            await userProg.save();

            // Cộng tiền vào ví
            const wallet = await WalletModel.findOneAndUpdate(
                { userId },
                {
                    $inc: { balance: taskDef.rewardCoins, totalEarned: taskDef.rewardCoins },
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            // Ghi nhận transaction
            await CoinTransactionModel.create({
                transactionId: `tx_claim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                userId,
                amount: taskDef.rewardCoins,
                type: "task_claim",
                reason: `Hoàn thành nhiệm vụ: ${taskDef.title} (+${taskDef.rewardCoins} Coins)`,
                source: "plantask",
                metadata: { taskCode },
            });

            return res.status(200).json({
                success: true,
                message: `Nhận thưởng thành công +${taskDef.rewardCoins} Coins từ nhiệm vụ "${taskDef.title}"!`,
                data: {
                    wallet,
                    rewardCoins: taskDef.rewardCoins,
                },
            });
        } catch (error: any) {
            console.error("[savecoin-service] Error claimTask:", error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // 7. Lấy lịch sử biến động số dư (Transactions)
    static async getTransactions(req: Request, res: Response) {
        try {
            const { userId } = req.params;
            const { limit = 30 } = req.query;

            const transactions = await CoinTransactionModel.find({ userId })
                .sort({ createdAt: -1 })
                .limit(Number(limit))
                .lean();

            return res.status(200).json({
                success: true,
                data: transactions,
            });
        } catch (error: any) {
            console.error("[savecoin-service] Error getTransactions:", error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }
}
