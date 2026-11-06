import { Router } from "express";
import { CoinController } from "../controllers/coin.controller";

/**
 * Router định tuyến toàn bộ các API liên quan đến Ví SaveCoin, nhận thưởng nhiệm vụ Gamification và lịch sử giao dịch.
 */
const router = Router();

// 1. Quản lý ví và số dư SaveCoin của người dùng
router.get("/coins/wallet/:userId", CoinController.getWallet);
router.post("/coins/faucet", CoinController.faucet);

// 2. Nạp thưởng thành tích và trừ tiền khi sử dụng dịch vụ
router.post("/coins/reward", CoinController.reward);
router.post("/coins/spend", CoinController.spend);

// 3. Hệ thống nhiệm vụ Plan Tasks (Kiếm Coin qua việc xây dựng bản đồ, IoT, Robotics)
router.get("/coins/tasks/:userId", CoinController.getTasks);
router.post("/coins/tasks/claim", CoinController.claimTask);

// 4. Lịch sử biến động số dư và giao dịch tiền ảo
router.get("/coins/transactions/:userId", CoinController.getTransactions);

export default router;
