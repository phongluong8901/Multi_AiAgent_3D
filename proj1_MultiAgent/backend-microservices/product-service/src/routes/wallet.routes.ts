import { Router } from "express";
import { walletController } from "../controllers/wallet.controller";

const router = Router();

router.get("/wallet", walletController.getWallet.bind(walletController));
router.post("/wallet/faucet", walletController.faucet.bind(walletController));

export default router;
