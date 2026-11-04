import { Request, Response } from "express";
import { MapDesignModel } from "../models/map.model";

export class MapController {
    // 1. Lưu hoặc Cập nhật Map (Upsert)
    static async saveMap(req: Request, res: Response) {
        try {
            const { mapId, name, description, skyPreset, groundColor, groundSize, items, userId, userName, isPublic, tags } = req.body;

            if (!name) {
                return res.status(400).json({ success: false, message: "Tên bản đồ là bắt buộc." });
            }

            const targetMapId = mapId || `map_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

            const updatedMap = await MapDesignModel.findOneAndUpdate(
                { mapId: targetMapId },
                {
                    mapId: targetMapId,
                    name,
                    description: description || "",
                    skyPreset: skyPreset || "city",
                    groundColor: groundColor || "#18181b",
                    groundSize: groundSize || [60, 60],
                    items: items || [],
                    userId: userId || "anonymous",
                    userName: userName || "Thành viên",
                    isPublic: isPublic !== undefined ? isPublic : true,
                    tags: tags || ["3D"],
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            // --- TÍNH TOÁN COIN THƯỞNG PLANTASK ---
            const itemList = Array.isArray(items) ? items : [];
            const baseReward = 30; // Thưởng vẽ map
            const details: string[] = ["+30 Coins: Hoàn thành thiết kế bản đồ 3D"];

            // 1. Đếm thiết bị chiếu sáng (LED, đèn xưởng, đèn đường)
            const ledItems = itemList.filter((i: any) =>
                ["smart_led", "industrial_lamp", "streetlight"].includes(i.type)
            );
            const ledReward = Math.min(ledItems.length * 10, 50);
            if (ledReward > 0) {
                details.push(`+${ledReward} Coins: Bố trí ${ledItems.length} thiết bị Smart LED / Đèn IoT (+10/cái)`);
            }

            // 2. Đếm thiết bị Robotics (AMR, Duck, Drone, Cánh tay robot)
            const robotItems = itemList.filter((i: any) =>
                ["agent_duck", "agent_amr", "agent_drone", "robot_arm", "robot_prototype"].includes(i.type)
            );
            const robotReward = Math.min(robotItems.length * 20, 60);
            if (robotReward > 0) {
                details.push(`+${robotReward} Coins: Lắp đặt ${robotItems.length} Robot tự hành / AI Agent (Duck, AMR, Drone)`);
            }

            // 3. Đếm thiết bị Smart Home IoT (Vòi nước, rèm, điều hòa, cửa)
            const smartHomeItems = itemList.filter((i: any) =>
                ["water_sprinkler", "smart_curtain", "air_conditioner", "smart_door"].includes(i.type)
            );
            const smartHomeReward = Math.min(smartHomeItems.length * 15, 45);
            if (smartHomeReward > 0) {
                details.push(`+${smartHomeReward} Coins: Trang bị ${smartHomeItems.length} thiết bị Smart Home IoT`);
            }

            const totalRewardCoins = baseReward + ledReward + robotReward + smartHomeReward;

            // Gọi sang savecoin-service để nạp coin vào ví nếu có userId hợp lệ
            let coinRewardResult: any = null;
            if (userId && userId !== "anonymous") {
                try {
                    const savecoinUrl = process.env.SAVECOIN_SERVICE_URL || "http://localhost:5006";
                    const coinRes = await fetch(`${savecoinUrl}/api/v1/coins/reward`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            userId,
                            amount: totalRewardCoins,
                            reason: `PlanTask: Vẽ bản đồ 3D "${name}" (+${ledItems.length} LED, +${robotItems.length} Robot, +${smartHomeItems.length} IoT)`,
                            source: "mapdraw",
                            metadata: {
                                mapId: targetMapId,
                                name,
                                itemCount: itemList.length,
                                ledCount: ledItems.length,
                                robotCount: robotItems.length,
                                smartHomeCount: smartHomeItems.length,
                            },
                        }),
                    });
                    if (coinRes.ok) {
                        coinRewardResult = await coinRes.json();
                    }
                } catch (coinErr) {
                    console.warn("[mapdraw-service] Không thể kết nối tới savecoin-service:", coinErr);
                }
            }

            return res.status(200).json({
                success: true,
                message: `Đã lưu bản đồ thành công và nhận thưởng +${totalRewardCoins} Coins!`,
                data: updatedMap,
                reward: {
                    earnedCoins: totalRewardCoins,
                    details,
                    wallet: coinRewardResult?.data?.wallet || null,
                },
            });
        } catch (error: any) {
            console.error("[mapdraw-service] Error saving map:", error);
            return res.status(500).json({ success: false, message: "Lỗi lưu bản đồ: " + error.message });
        }
    }

    // 2. Lấy danh sách toàn bộ bản đồ
    static async getMaps(req: Request, res: Response) {
        try {
            const { userId, search, limit = 50 } = req.query;
            const filter: any = {};

            if (userId) {
                filter.$or = [{ userId }, { isPublic: true }];
            }

            if (search) {
                filter.name = { $regex: String(search), $options: "i" };
            }

            const maps = await MapDesignModel.find(filter)
                .sort({ updatedAt: -1 })
                .limit(Number(limit))
                .lean();

            return res.status(200).json({
                success: true,
                count: maps.length,
                data: maps,
            });
        } catch (error: any) {
            console.error("[mapdraw-service] Error getting maps:", error);
            return res.status(500).json({ success: false, message: "Lỗi tải danh sách bản đồ: " + error.message });
        }
    }

    // 3. Lấy chi tiết 1 bản đồ theo mapId
    static async getMapById(req: Request, res: Response) {
        try {
            const { mapId } = req.params;
            const map = await MapDesignModel.findOne({ mapId }).lean();

            if (!map) {
                return res.status(404).json({ success: false, message: "Không tìm thấy bản đồ này." });
            }

            return res.status(200).json({
                success: true,
                data: map,
            });
        } catch (error: any) {
            console.error("[mapdraw-service] Error getting map detail:", error);
            return res.status(500).json({ success: false, message: "Lỗi lấy chi tiết bản đồ: " + error.message });
        }
    }

    // 4. Xóa bản đồ
    static async deleteMap(req: Request, res: Response) {
        try {
            const { mapId } = req.params;
            const deleted = await MapDesignModel.findOneAndDelete({ mapId });

            if (!deleted) {
                return res.status(404).json({ success: false, message: "Không tìm thấy bản đồ cần xóa." });
            }

            return res.status(200).json({
                success: true,
                message: `Đã xóa bản đồ '${deleted.name}' thành công.`,
            });
        } catch (error: any) {
            console.error("[mapdraw-service] Error deleting map:", error);
            return res.status(500).json({ success: false, message: "Lỗi xóa bản đồ: " + error.message });
        }
    }

    // 5. Nhân bản (Fork / Clone) bản đồ
    static async cloneMap(req: Request, res: Response) {
        try {
            const { mapId } = req.params;
            const { newName, userId, userName } = req.body;

            const original = await MapDesignModel.findOne({ mapId }).lean();
            if (!original) {
                return res.status(404).json({ success: false, message: "Không tìm thấy bản đồ gốc." });
            }

            const clonedMapId = `map_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const cloned = new MapDesignModel({
                ...original,
                _id: undefined,
                mapId: clonedMapId,
                name: newName || `${original.name} (Bản sao)`,
                userId: userId || "anonymous",
                userName: userName || "User",
            });

            await cloned.save();

            return res.status(201).json({
                success: true,
                message: "Đã nhân bản bản đồ thành công!",
                data: cloned,
            });
        } catch (error: any) {
            console.error("[mapdraw-service] Error cloning map:", error);
            return res.status(500).json({ success: false, message: "Lỗi nhân bản bản đồ: " + error.message });
        }
    }
}
