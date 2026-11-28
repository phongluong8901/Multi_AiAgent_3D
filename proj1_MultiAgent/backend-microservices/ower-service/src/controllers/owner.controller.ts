import { Request, Response } from "express";
import { ownerRentalService } from "../services/owner-rental.service";
import { agentInferenceService } from "../services/agent-inference.service";

/**
 * Controller quan ly cac nghiep vu Owner / Renter:
 * - Kiem tra thi truong thue phan cung (Marketplace)
 * - Khoi tao va dung phien thue may GPU/NPU
 * - Gan model AI vao Agent
 * - Dieu phoi va stream suy luan (Inference) cho Agent
 * - Dashboard thong ke chi tieu SaveCoin va phien ket noi
 */
export class OwnerController {
    /**
     * Lay danh sach cac Hardware Node dang san sang cho thue tren Marketplace
     * Ho tro loc theo toa do dia ly va ban kinh (km)
     */
    async getMarketplace(req: Request, res: Response) {
        try {
            const lng = req.query.lng ? Number(req.query.lng) : undefined;
            const lat = req.query.lat ? Number(req.query.lat) : undefined;
            const radiusKm = req.query.radiusKm ? Number(req.query.radiusKm) : undefined;
            const nodes = await ownerRentalService.getMarketplaceNodes(lng, lat, radiusKm);
            res.status(200).json({ success: true, count: nodes.length, nodes });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Khoi tao phien thue node phan cung moi cho Agent
     * Kiem tra nguon tien va gan lien ket voi Seller
     */
    async startRental(req: Request, res: Response) {
        try {
            const session = await ownerRentalService.startRental(req.body);
            res.status(201).json({
                success: true,
                message: "Kich hoat phien thue may thanh cong!",
                rental: session,
                session,
            });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    /**
     * Dung phien thue may va ket thuc tinh phi theo gio
     */
    async stopRental(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const stopped = await ownerRentalService.stopRental(id);
            if (!stopped) {
                return res.status(404).json({ success: false, message: "Khong tim thay phien thue" });
            }
            res.status(200).json({
                success: true,
                message: "Da dung phien thue thanh cong!",
                rental: stopped,
                session: stopped,
            });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Lay danh sach cac phien thue cua nguoi dung hien tai
     */
    getMyRentals(req: Request, res: Response) {
        return (async () => {
            try {
                const renterId = (req.query.renterId as string) || (req.query.ownerId as string) || "usr_owner_01";
                const rentals = await ownerRentalService.getMyRentals(renterId);
                res.status(200).json({ success: true, count: rentals.length, rentals });
            } catch (error: any) {
                res.status(500).json({ success: false, message: error.message });
            }
        })();
    }

    /**
     * Gan mo hinh AI da thue vao mot Agent cu the
     */
    async bindAgent(req: Request, res: Response) {
        try {
            const binding = await ownerRentalService.bindAgent(req.body);
            res.status(200).json({ success: true, message: "Gan Model thanh cong cho Agent!", binding });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    /**
     * Thuc thi suy luan AI (ho tro ca REST synchronous lan Server-Sent Events SSE streaming)
     */
    async runAgentInference(req: Request, res: Response) {
        try {
            const rentalSessionId = req.body.rentalSessionId || req.body.rentalId || req.body.sessionId || (req.query.rentalSessionId as string) || (req.query.rentalId as string) || "";
            const prompt = req.body.prompt || (req.query.prompt as string) || "";
            const systemPrompt = req.body.systemPrompt || (req.query.systemPrompt as string);
            const agentId = req.body.agentId || (req.query.agentId as string);
            const temperature = req.body.temperature ? Number(req.body.temperature) : undefined;
            const maxTokens = req.body.maxTokens ? Number(req.body.maxTokens) : undefined;

            if (!prompt) {
                return res.status(400).json({ success: false, message: "Prompt khong duoc de trong" });
            }

            const isSSE = req.headers["accept"] === "text/event-stream" || req.query.stream === "true" || req.body.stream === true;
            if (isSSE) {
                return await agentInferenceService.streamInferenceForAgent({
                    rentalSessionId,
                    agentId,
                    prompt,
                    systemPrompt,
                    temperature,
                    maxTokens,
                }, res);
            }

            const result = await agentInferenceService.runInferenceForAgent({
                rentalSessionId,
                agentId,
                prompt,
                systemPrompt,
                temperature,
                maxTokens,
            });

            res.status(200).json(result);
        } catch (error: any) {
            const status = error.message?.includes("Chua co") || error.message?.includes("khong con hieu luc") ? 400 : 500;
            res.status(status).json({ success: false, message: error.message });
        }
    }

    /**
     * Lay du lieu Dashboard tong the: so phien thue, coin da chi tieu, so luot tokens suy luan
     */
    async getDashboard(req: Request, res: Response) {
        try {
            const ownerId = (req.query.ownerId as string) || (req.query.renterId as string) || "usr_owner_01";
            const data = await ownerRentalService.getDashboard(ownerId);
            res.status(200).json({ success: true, ...data });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Lay toan bo danh sach cac ket noi phien thue dang hoat dong trong he thong
     */
    async getAllActiveConnections(req: Request, res: Response) {
        try {
            const sessions = await ownerRentalService.getAllActiveConnections();
            res.status(200).json({ success: true, count: sessions.length, sessions });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

export const ownerController = new OwnerController();
