import { Router } from "express";
import { CoinController } from "../controllers/coin.controller";

const router = Router();

// Ví và số dư
router.get("/coins/wallet/:userId", CoinController.getWallet);
router.post("/coins/faucet", CoinController.faucet);

// Nạp thưởng và chi tiêu
router.post("/coins/reward", CoinController.reward);
router.post("/coins/spend", CoinController.spend);

// Plan Tasks (Nhiệm vụ kiếm Coin ảo)
router.get("/coins/tasks/:userId", CoinController.getTasks);
router.post("/coins/tasks/claim", CoinController.claimTask);

// Lịch sử giao dịch
router.get("/coins/transactions/:userId", CoinController.getTransactions);

export default router;
