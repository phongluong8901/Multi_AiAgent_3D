import { Request, Response } from "express";
import { AgentBodyDesignModel } from "../models/agentBody.model";
import { computeBodyStats, generateURDF, validateKinematicTree } from "../utils/agentBody.utils";

export class AgentBodyController {
    // 1. Lưu hoặc cập nhật Agent Body (Upsert)
    static async saveBody(req: Request, res: Response) {
        try {
            const {
                bodyId,
                name,
                description,
                category,
                rootLinkId,
                spawnHeight,
                links,
                joints,
                userId,
                userName,
                isPublic,
                tags,
            } = req.body;

            if (!name) {
                return res.status(400).json({ success: false, message: "Tên agent body là bắt buộc." });
            }

            const payload = {
                name,
                rootLinkId,
                spawnHeight: spawnHeight ?? 0.5,
                links: Array.isArray(links) ? links : [],
                joints: Array.isArray(joints) ? joints : [],
            };

            const errors = validateKinematicTree(payload);
            if (errors.length > 0) {
                return res.status(400).json({ success: false, message: "Cấu trúc khớp không hợp lệ.", errors });
            }

            const targetId = bodyId || `body_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

            const saved = await AgentBodyDesignModel.findOneAndUpdate(
                { bodyId: targetId },
                {
                    bodyId: targetId,
                    ...payload,
                    description: description || "",
                    category: category || "custom",
                    userId: userId || "anonymous",
                    userName: userName || "Thành viên",
                    isPublic: isPublic !== undefined ? isPublic : true,
                    tags: tags || ["AgentBody"],
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            return res.status(200).json({
                success: true,
                message: `Đã lưu agent body '${name}' thành công.`,
                data: saved,
                stats: computeBodyStats(payload),
            });
        } catch (error: any) {
            console.error("[mapdraw-service] [ERROR] saving agent body:", error);
            return res.status(500).json({ success: false, message: "Lỗi lưu agent body: " + error.message });
        }
    }

    // 2. Danh sách agent bodies
    static async getBodies(req: Request, res: Response) {
        try {
            const { userId, search, category, limit = 50 } = req.query;
            const filter: any = {};
            if (userId) filter.$or = [{ userId }, { isPublic: true }];
            if (search) filter.name = { $regex: String(search), $options: "i" };
            if (category) filter.category = String(category);

            const bodies = await AgentBodyDesignModel.find(filter).sort({ updatedAt: -1 }).limit(Number(limit)).lean();

            return res.status(200).json({ success: true, count: bodies.length, data: bodies });
        } catch (error: any) {
            console.error("[mapdraw-service] [ERROR] listing agent bodies:", error);
            return res.status(500).json({ success: false, message: "Lỗi tải danh sách agent body: " + error.message });
        }
    }

    // 3. Chi tiết 1 agent body (kèm thống kê RL)
    static async getBodyById(req: Request, res: Response) {
        try {
            const body = await AgentBodyDesignModel.findOne({ bodyId: req.params.bodyId }).lean();
            if (!body) return res.status(404).json({ success: false, message: "Không tìm thấy agent body." });
            return res.status(200).json({ success: true, data: body, stats: computeBodyStats(body) });
        } catch (error: any) {
            console.error("[mapdraw-service] [ERROR] getting agent body:", error);
            return res.status(500).json({ success: false, message: "Lỗi lấy agent body: " + error.message });
        }
    }

    // 4. Xuất URDF (cho rltrain-service / PyBullet / MuJoCo / Isaac Sim)
    static async getBodyURDF(req: Request, res: Response) {
        try {
            const body = await AgentBodyDesignModel.findOne({ bodyId: req.params.bodyId }).lean();
            if (!body) return res.status(404).json({ success: false, message: "Không tìm thấy agent body." });
            const urdf = generateURDF(body);
            res.setHeader("Content-Type", "application/xml; charset=utf-8");
            res.setHeader("Content-Disposition", `attachment; filename="${body.bodyId}.urdf"`);
            return res.status(200).send(urdf);
        } catch (error: any) {
            console.error("[mapdraw-service] [ERROR] exporting URDF:", error);
            return res.status(500).json({ success: false, message: "Lỗi xuất URDF: " + error.message });
        }
    }

    // 5. Spec cho training: action space, observation space, joint list
    static async getBodyTrainingSpec(req: Request, res: Response) {
        try {
            const body = await AgentBodyDesignModel.findOne({ bodyId: req.params.bodyId }).lean();
            if (!body) return res.status(404).json({ success: false, message: "Không tìm thấy agent body." });
            return res.status(200).json({
                success: true,
                data: {
                    bodyId: body.bodyId,
                    name: body.name,
                    spawnHeight: body.spawnHeight,
                    ...computeBodyStats(body),
                    urdfPath: `/api/v1/agent-bodies/${body.bodyId}/urdf`,
                },
            });
        } catch (error: any) {
            console.error("[mapdraw-service] [ERROR] training spec:", error);
            return res.status(500).json({ success: false, message: "Lỗi lấy training spec: " + error.message });
        }
    }

    // 6. Xoá agent body
    static async deleteBody(req: Request, res: Response) {
        try {
            const deleted = await AgentBodyDesignModel.findOneAndDelete({ bodyId: req.params.bodyId });
            if (!deleted) return res.status(404).json({ success: false, message: "Không tìm thấy agent body cần xoá." });
            return res.status(200).json({ success: true, message: `Đã xoá agent body '${deleted.name}'.` });
        } catch (error: any) {
            console.error("[mapdraw-service] [ERROR] deleting agent body:", error);
            return res.status(500).json({ success: false, message: "Lỗi xoá agent body: " + error.message });
        }
    }

    // 7. Nhân bản agent body
    static async cloneBody(req: Request, res: Response) {
        try {
            const { newName, userId, userName } = req.body || {};
            const original = await AgentBodyDesignModel.findOne({ bodyId: req.params.bodyId }).lean();
            if (!original) return res.status(404).json({ success: false, message: "Không tìm thấy agent body gốc." });

            const cloned = new AgentBodyDesignModel({
                ...original,
                _id: undefined,
                createdAt: undefined,
                updatedAt: undefined,
                bodyId: `body_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                name: newName || `${original.name} (Bản sao)`,
                userId: userId || "anonymous",
                userName: userName || "User",
            });
            await cloned.save();

            return res.status(201).json({ success: true, message: "Đã nhân bản agent body.", data: cloned });
        } catch (error: any) {
            console.error("[mapdraw-service] [ERROR] cloning agent body:", error);
            return res.status(500).json({ success: false, message: "Lỗi nhân bản agent body: " + error.message });
        }
    }
}

