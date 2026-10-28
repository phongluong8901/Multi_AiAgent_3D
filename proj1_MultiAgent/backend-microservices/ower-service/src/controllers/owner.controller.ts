import { Request, Response } from "express";
import { ownerRentalService } from "../services/owner-rental.service";
import { agentInferenceService } from "../services/agent-inference.service";

export class OwnerController {
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

    async startRental(req: Request, res: Response) {
        try {
            const session = await ownerRentalService.startRental(req.body);
            res.status(201).json({
                success: true,
                message: "Kích hoạt phiên thuê máy thành công!",
                rental: session,
                session,
            });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async stopRental(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const stopped = await ownerRentalService.stopRental(id);
            if (!stopped) {
                return res.status(404).json({ success: false, message: "Không tìm thấy phiên thuê" });
            }
            res.status(200).json({
                success: true,
                message: "Đã dừng phiên thuê thành công!",
                rental: stopped,
                session: stopped,
            });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async getMyRentals(req: Request, res: Response) {
        try {
            const renterId = (req.query.renterId as string) || (req.query.ownerId as string) || "usr_owner_01";
            const rentals = await ownerRentalService.getMyRentals(renterId);
            res.status(200).json({ success: true, count: rentals.length, rentals });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async bindAgent(req: Request, res: Response) {
        try {
            const binding = await ownerRentalService.bindAgent(req.body);
            res.status(200).json({ success: true, message: "Gán Model thành công cho Agent!", binding });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async runAgentInference(req: Request, res: Response) {
        try {
            const rentalSessionId = req.body.rentalSessionId || req.body.rentalId || req.body.sessionId || "";
            const { agentId, prompt, systemPrompt, temperature, maxTokens } = req.body;
            if (!prompt) {
                return res.status(400).json({ success: false, message: "Prompt không được để trống" });
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
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async getDashboard(req: Request, res: Response) {
        try {
            const ownerId = (req.query.ownerId as string) || (req.query.renterId as string) || "usr_owner_01";
            const data = await ownerRentalService.getDashboard(ownerId);
            res.status(200).json({ success: true, ...data });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

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
