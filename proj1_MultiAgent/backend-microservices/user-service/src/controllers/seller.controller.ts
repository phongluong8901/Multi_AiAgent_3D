import { Request, Response } from "express";
import { sellerService } from "../services/seller.service";
import { UnauthorizedError } from "../utils/exceptions";
import { asyncHandler } from "../middlewares/async.middleware";

export class SellerController {

    /** 
     * POST /api/v1/seller/register-node — Đăng ký tài khoản làm Seller và cấu hình phần cứng node 
     */
    registerNode = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        const result = await sellerService.registerNode(userId, req.body);
        return res.status(200).json({ success: true, ...result });
    });

    /** 
     * POST /api/v1/seller/heartbeat — Gửi tín hiệu ping phần cứng định kỳ từ phía máy Seller 
     */
    pingHeartbeat = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        const { status, location } = req.body;
        const result = await sellerService.handleHeartbeat(userId, status, location);
        return res.status(200).json(result);
    });

    /** 
     * GET /api/v1/seller/node — Lấy thông tin chi tiết node phần cứng của Seller hiện tại 
     */
    getNodeDetails = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) throw new UnauthorizedError("Unauthorized");

        const hardwareNode = await sellerService.getNodeDetails(userId);
        return res.status(200).json({ success: true, data: hardwareNode });
    });
}

export const sellerController = new SellerController();