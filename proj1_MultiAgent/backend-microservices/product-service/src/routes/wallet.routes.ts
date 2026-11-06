import { Router } from "express";
import { walletController } from "../controllers/wallet.controller";

/**
 * Router định tuyến các API quản lý Ví Coin và nạp tiền thử nghiệm.
 */
const router = Router();

// Lấy thông tin số dư ví Coin và lịch sử biến động số dư
router.get("/wallet", walletController.getWallet.bind(walletController));

// Nạp thêm coin thử nghiệm vào ví (Faucet)
router.post("/wallet/faucet", walletController.faucet.bind(walletController));

export default router;
