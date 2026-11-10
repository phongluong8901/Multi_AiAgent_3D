/**
 * ==============================================================================
 * BẢNG GIÁM SÁT SINH LÝ & TÂM LÝ NỘI TẠI (INTERNAL MONITOR DASHBOARD)
 * ==============================================================================
 * Hiển thị toàn diện các chỉ số thể chất và tinh thần của Bé Bo và Bé Bi:
 * 1. Chuyển đổi tab xem giữa Bé Bo (Năng động) và Bé Bi (Thận trọng, Thấu cảm).
 * 2. Năng lượng Sinh học (Kcal): Thanh đo Kcal hiện tại, Kcal tối đa, vùng tiêu hóa (Digesting),
 *    độ mệt mỏi (Fatigue) và hệ số nhân thể chất alpha_motor.
 * 3. 8 Động lực Nội tại (Homeostasis & Drives): Đói, Khát, Mệt mỏi, Đau đớn, Sợ hãi, Tò mò,
 *    Thoải mái và Nhu cầu xã hội (Social / Loneliness).
 * 4. Bản đồ Nhận thức & Sương mù Khám phá: Radar ma trận 10x10 ô đất đã khám phá và vùng nguy hiểm.
 * 5. Danh mục Tài nguyên đã phát hiện (Bếp ăn, Vòi nước, Giường Villa).
 * 6. Nhật ký Ký ức Sự kiện gần nhất (Episodic Memories) và dòng suy nghĩ hiện tại.
 */

import { useTrainingStore } from "../stores/useTrainingStore";

interface DriveBarProps {
    label: string;
    description: string;
    value: number;
    colorClass: string;
    urgent?: boolean;
}

function DriveBar({ label, description, value, colorClass, urgent }: DriveBarProps) {
    const pct = Math.min(100, Math.max(0, Math.round(value * 100)));
    return (
        <div className="space-y-1">
            <div className="flex justify-between items-baseline text-xs">
                <span className={urgent ? "text-rose-400 font-bold" : "text-slate-300 font-medium"}>
                    {label}
                </span>
                <span className="font-mono text-slate-400">{pct}%</span>
            </div>
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-700/60">
                <div
                    className={`h-full transition-all duration-150 ${colorClass}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <div className="text-[10px] text-slate-400 leading-tight">
                {description}
            </div>
        </div>
    );
}

const DOMINANT_DRIVE_NAMES: Record<string, string> = {
    hunger: "TÌM ĐỒ ĂN (ĐANG ĐÓI)",
    thirst: "TÌM NƯỚC UỐNG (ĐANG KHÁT)",
    fatigue: "VỀ GIƯỜNG NGHỈ (QUÁ MỆT)",
    pain: "NÉ TRÁNH NGUY HIỂM (ĐANG ĐAU)",
    fear: "TÌM NƠI AN TOÀN (SỢ HÃI)",
    social: "TÌM BẠN CHƠI CÙNG (CÔ ĐƠN)",
    curiosity: "TỰ DO KHÁM PHÁ (TÒ MÒ)",
    comfort: "CÂN BẰNG NỘI TẠI",
};

export default function InternalMonitor() {
    const selectedAgent = useTrainingStore((s) => s.selectedAgent);
    const setSelectedAgent = useTrainingStore((s) => s.setSelectedAgent);

    const isBo = selectedAgent === "bo";

    const robotPos = useTrainingStore((s) => (isBo ? s.robot : s.robot2));
    const energyState = useTrainingStore((s) => (isBo ? s.energyState : s.energyState2));
    const drivesState = useTrainingStore((s) => (isBo ? s.drivesState : s.drivesState2));
    const cognitiveState = useTrainingStore((s) => (isBo ? s.cognitiveState : s.cognitiveState2));
    const currentThought = useTrainingStore((s) => (isBo ? s.currentThought : s.currentThought2));
    const currentGoalName = useTrainingStore((s) => (isBo ? s.currentGoalName : s.currentGoalName2));

    const peerDist = useTrainingStore((s) => s.peerDist);
    const nearPeer = useTrainingStore((s) => s.nearPeer);
    const food = useTrainingStore((s) => s.food);
    const water = useTrainingStore((s) => s.water);
    const bed = useTrainingStore((s) => s.bed);
    const foodCapacity = useTrainingStore((s) => s.foodCapacity);
    const waterCapacity = useTrainingStore((s) => s.waterCapacity);
    const foodTimeLeft = useTrainingStore((s) => s.foodTimeLeft);
    const waterTimeLeft = useTrainingStore((s) => s.waterTimeLeft);
    const foodMaxTime = useTrainingStore((s) => s.foodMaxTime);
    const waterMaxTime = useTrainingStore((s) => s.waterMaxTime);
    const raceStats = useTrainingStore((s) => s.raceStats);
    const isRacing = useTrainingStore((s) => s.isRacing);

    const memory = cognitiveState?.memory;
    const onlineLearner = cognitiveState?.online_learner;

    const { energy, energy_max, digesting, alpha_motor, alpha_cognitive } = energyState;
    const { drives, dominant_drive, survival_override } = drivesState;
    const stats = cognitiveState?.stats || {
        meals_eaten: 0,
        water_drank: 0,
        naps_taken: 0,
        praises: 0,
        scoldings: 0,
        collisions: 0,
        social_chats: 0,
    };

    const energyPct = Math.min(100, Math.max(0, Math.round((energy / Math.max(1, energy_max)) * 100)));
    const dominantText = DOMINANT_DRIVE_NAMES[dominant_drive] || dominant_drive.toUpperCase();

    // Tọa độ các vị trí trên mini grid 10x10 (World Thành Phố 60x60 => chia 6)
    const currentGridX = Math.min(9, Math.max(0, Math.floor((robotPos?.[0] ?? 8.0) / 6)));
    const currentGridZ = Math.min(9, Math.max(0, Math.floor((robotPos?.[1] ?? 14.0) / 6)));
    const foodGridX = Math.min(9, Math.max(0, Math.floor((food?.[0] ?? 46.0) / 6)));
    const foodGridZ = Math.min(9, Math.max(0, Math.floor((food?.[1] ?? 44.0) / 6)));
    const waterGridX = Math.min(9, Math.max(0, Math.floor((water?.[0] ?? 39.0) / 6)));
    const waterGridZ = Math.min(9, Math.max(0, Math.floor((water?.[1] ?? 8.0) / 6)));
    const bedGridX = Math.min(9, Math.max(0, Math.floor((bed?.[0] ?? 8.0) / 6)));
    const bedGridZ = Math.min(9, Math.max(0, Math.floor((bed?.[1] ?? 8.0) / 6)));

    return (
        <div className="bg-slate-800/95 backdrop-blur p-4 rounded-xl border border-slate-700 space-y-3.5 shadow-md">
            {/* Thanh chuyển đổi chọn xem thông số Bé Bo hay Bé Bi */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-700/70 pb-2.5">
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => setSelectedAgent("bo")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            isBo
                                ? "bg-blue-600 text-white shadow"
                                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-700"
                        }`}
                    >
                        <span className="w-2 h-2 rounded-full bg-blue-300" />
                        Bé Bo (Năng Động)
                    </button>
                    <button
                        onClick={() => setSelectedAgent("bi")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            !isBo
                                ? "bg-pink-600 text-white shadow"
                                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-700"
                        }`}
                    >
                        <span className="w-2 h-2 rounded-full bg-pink-300" />
                        Bé Bi (Tình Cảm)
                    </button>
                </div>
                <span
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                        survival_override
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse"
                            : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                    }`}
                >
                    {survival_override ? "[BÁO ĐỘNG]" : dominantText}
                </span>
            </div>

            {/* Trạng thái liên kết xã hội giữa hai bạn nhỏ */}
            <div className="bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700/80 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 flex items-center gap-1.5">
                    <span
                        className={`w-2 h-2 rounded-full ${
                            nearPeer ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                        }`}
                    />
                    {nearPeer
                        ? "Đang ở cạnh bạn (Giảm cô đơn, tâm sự)"
                        : "Đang cách xa bạn"}
                </span>
                <span className="text-sky-300 font-bold">Cách bạn: {peerDist}m</span>
            </div>

            {/* BẢNG ĐIỂM CUỘC ĐUA TRANH GIÀNH TÀI NGUYÊN (Competitive Race Scoreboard) */}
            <div className="bg-slate-900/90 p-3 rounded-lg border border-amber-500/40 space-y-2 shadow-inner">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-amber-300 font-bold flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${isRacing ? "bg-rose-500 animate-ping" : "bg-amber-400"}`} />
                        [CUỘC ĐUA TRANH TÀI NGUYÊN]:
                    </span>
                    <span className="font-mono text-[11px] text-slate-300">
                        Tổng {raceStats?.total_contests ?? 0} lượt đua
                    </span>
                </div>

                {isRacing && (
                    <div className="px-2.5 py-1 rounded bg-rose-600/90 text-white text-[11px] font-mono font-bold text-center border border-rose-400 animate-pulse">
                        [TRANH GIÀNH GAY CẤN] HAI BÉ ĐANG BẬT TỐC ĐỘ 1.3X ĐUA VỀ ĐÍCH!
                    </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* Điểm của Bé Bo */}
                    <div className="bg-blue-950/60 p-2 rounded-lg border border-blue-500/40 text-center">
                        <span className="text-blue-300 font-bold block text-xs">Bé Bo (Năng Động)</span>
                        <span className="text-xl font-bold font-mono text-white block my-0.5">
                            {raceStats?.bo_wins ?? 0}
                        </span>
                        <span className="text-[10px] text-blue-200/80 font-mono block">
                            Ăn: {raceStats?.bo_food_wins ?? 0} | Uống: {raceStats?.bo_water_wins ?? 0}
                        </span>
                    </div>

                    {/* Điểm của Bé Bi */}
                    <div className="bg-pink-950/60 p-2 rounded-lg border border-pink-500/40 text-center">
                        <span className="text-pink-300 font-bold block text-xs">Bé Bi (Tình Cảm)</span>
                        <span className="text-xl font-bold font-mono text-white block my-0.5">
                            {raceStats?.bi_wins ?? 0}
                        </span>
                        <span className="text-[10px] text-pink-200/80 font-mono block">
                            Ăn: {raceStats?.bi_food_wins ?? 0} | Uống: {raceStats?.bi_water_wins ?? 0}
                        </span>
                    </div>
                </div>

                {raceStats?.last_winner && (
                    <div className="text-[11px] text-center font-mono text-emerald-400 bg-slate-950/60 py-1 rounded border border-slate-800">
                        [KẾT QUẢ GẦN NHẤT]: {raceStats.last_winner === "bo" || raceStats.last_winner === "Bé Bo" ? "Bé Bo Thắng (+15.0 RL Reward)" : "Bé Bi Thắng (+15.0 RL Reward)"}
                    </div>
                )}
            </div>

            {/* ĐỒNG HỒ ĐẾM NGƯỢC & THỜI GIAN SỐNG TÀI NGUYÊN (Resource Countdown Clocks) */}
            <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-700/80 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-200 font-semibold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        Đồng Hồ Đếm Ngược Tài Nguyên (Hết giờ đổi vị trí)
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                        Bản đồ 40x40
                    </span>
                </div>

                {/* Đồng hồ Bếp Ăn */}
                <div className="space-y-1 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            [BẾP ĂN DINH DƯỠNG] [{food[0].toFixed(1)}, {food[1].toFixed(1)}]
                        </span>
                        <span className={`font-mono text-xs font-bold ${foodTimeLeft <= 10.0 ? "text-rose-400 animate-pulse" : "text-amber-300"}`}>
                            {foodTimeLeft.toFixed(1)}s / {foodMaxTime.toFixed(0)}s ({foodCapacity.toFixed(0)}% Kcal)
                        </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div
                            className={`h-full transition-all duration-150 ${foodTimeLeft <= 10.0 ? "bg-rose-500" : "bg-amber-400"}`}
                            style={{ width: `${Math.max(0, Math.min(100, (foodTimeLeft / Math.max(1, foodMaxTime)) * 100))}%` }}
                        />
                    </div>
                </div>

                {/* Đồng hồ Vòi Nước */}
                <div className="space-y-1 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-cyan-400 font-semibold flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                            [VÒI NƯỚC TINH KHIẾT] [{water[0].toFixed(1)}, {water[1].toFixed(1)}]
                        </span>
                        <span className={`font-mono text-xs font-bold ${waterTimeLeft <= 10.0 ? "text-rose-400 animate-pulse" : "text-cyan-300"}`}>
                            {waterTimeLeft.toFixed(1)}s / {waterMaxTime.toFixed(0)}s ({waterCapacity.toFixed(0)}% ml)
                        </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div
                            className={`h-full transition-all duration-150 ${waterTimeLeft <= 10.0 ? "bg-rose-500" : "bg-cyan-400"}`}
                            style={{ width: `${Math.max(0, Math.min(100, (waterTimeLeft / Math.max(1, waterMaxTime)) * 100))}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* 1. Hộp Suy Nghĩ Nội Tâm Đang Diễn Ra */}
            <div className="bg-gradient-to-r from-slate-900/95 to-indigo-950/60 p-3 rounded-lg border border-indigo-500/30 space-y-1.5 shadow-inner">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-indigo-300 font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                        Suy Nghĩ Của {isBo ? "Bé Bo" : "Bé Bi"}:
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                        Mục tiêu: {currentGoalName}
                    </span>
                </div>
                <p className="text-xs text-white italic font-medium leading-relaxed bg-slate-950/50 p-2 rounded border border-slate-800/80">
                    "{currentThought}"
                </p>
            </div>

            {/* 2. Trí Tuệ Nơ-ron & Học Tăng Cường Trực Tuyến (Continual Online RL) */}
            <div className="bg-slate-900/90 p-3 rounded-lg border border-amber-500/40 space-y-2">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-amber-300 font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        Trí Tuệ Nơ-ron Trực Tuyến (Online Actor-Critic):
                    </span>
                    <span className="font-mono text-[11px] text-amber-200 bg-amber-950/70 px-2 py-0.5 rounded border border-amber-600/50">
                        {onlineLearner?.total_online_updates ?? 0} lượt Backprop Live
                    </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-slate-950/80 p-1.5 rounded border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Kỳ Vọng V(s):</span>
                        <span className="font-mono font-bold text-emerald-400">
                            {onlineLearner?.latest_value !== undefined
                                ? (onlineLearner.latest_value >= 0
                                      ? `+${onlineLearner.latest_value.toFixed(2)}`
                                      : onlineLearner.latest_value.toFixed(2))
                                : "+0.00"}
                        </span>
                    </div>
                    <div className="bg-slate-950/80 p-1.5 rounded border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">TD Loss:</span>
                        <span className="font-mono font-bold text-sky-400">
                            {onlineLearner?.latest_loss ? onlineLearner.latest_loss.toFixed(4) : "0.0000"}
                        </span>
                    </div>
                    <div className="bg-slate-950/80 p-1.5 rounded border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Bộ Đệm Replay:</span>
                        <span className="font-mono font-bold text-purple-300">
                            {onlineLearner?.buffer_size ?? 0} / 4000
                        </span>
                    </div>
                </div>
            </div>

            {/* 3. Bản Đồ Nhận Thức Không Gian & Màn Sương Khám Phá (Fog of War) */}
            <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-700/80 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-200 font-semibold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        Bản Đồ Không Gian Nhận Thức Của Bé
                    </span>
                    <span className="font-mono text-emerald-400 font-bold text-[11px]">
                        Đã Khám Phá: {memory?.exploration_pct ?? 0}%
                    </span>
                </div>

                {/* Lưới Mini 10x10 Fog of War */}
                <div className="flex items-center justify-center py-1">
                    <div className="grid grid-cols-10 gap-0.5 p-1.5 bg-slate-950 rounded-lg border border-slate-800 shadow-inner">
                        {Array.from({ length: 10 }).map((_, z) =>
                            Array.from({ length: 10 }).map((_, x) => {
                                const isRobot = currentGridX === x && currentGridZ === z;
                                const isExplored = memory?.mini_explored_grid?.[x]?.[z] === 1;
                                const isDanger = memory?.mini_danger_grid?.[x]?.[z] === 1;

                                const isKnownFood =
                                    foodGridX === x &&
                                    foodGridZ === z &&
                                    memory?.discovered_resources?.food?.discovered;
                                const isKnownWater =
                                    waterGridX === x &&
                                    waterGridZ === z &&
                                    memory?.discovered_resources?.water?.discovered;
                                const isKnownBed =
                                    bedGridX === x &&
                                    bedGridZ === z &&
                                    memory?.discovered_resources?.bed?.discovered;

                                // Kiểm tra xem ô này có phải vị trí tài nguyên cũ đã cạn không (World Thành Phố 60x60 => chia 6)
                                const isDepletedSpot = memory?.discovered_history?.some(
                                    (h) =>
                                        h.status === "depleted" &&
                                        Math.floor(h.pos[0] / 6) === x &&
                                        Math.floor(h.pos[1] / 6) === z
                                );

                                let cellBg = "bg-slate-900/90 border-slate-950"; // Màn sương tối (chưa biết)
                                if (isDanger) {
                                    cellBg = "bg-rose-600/90 border-rose-400 animate-pulse"; // Vết sẹo sợ lửa
                                } else if (isRobot) {
                                    cellBg = isBo
                                        ? "bg-blue-400 border-white ring-1 ring-blue-300"
                                        : "bg-pink-400 border-white ring-1 ring-pink-300";
                                } else if (isKnownFood) {
                                    cellBg = "bg-amber-500 border-amber-300 ring-1 ring-amber-400 animate-pulse";
                                } else if (isKnownWater) {
                                    cellBg = "bg-cyan-400 border-cyan-200 ring-1 ring-cyan-300 animate-pulse";
                                } else if (isKnownBed) {
                                    cellBg = "bg-indigo-500 border-indigo-300";
                                } else if (isDepletedSpot) {
                                    cellBg = "bg-amber-950/70 border-amber-700/60"; // Vết tích tài nguyên cũ đã cạn
                                } else if (isExplored) {
                                    cellBg = "bg-emerald-500/40 border-emerald-500/30"; // Đã khám phá
                                }

                                return (
                                    <div
                                        key={`${x}-${z}`}
                                        className={`w-3.5 h-3.5 rounded-sm border ${cellBg} transition-colors duration-200`}
                                        title={`Ô [${x * 2}, ${z * 2}]: ${
                                            isDanger
                                                ? "Nguy hiểm (lò lửa)"
                                                : isKnownFood
                                                ? "Bếp ăn (đã phát hiện)"
                                                : isKnownWater
                                                ? "Vòi nước (đã phát hiện)"
                                                : isDepletedSpot
                                                ? "Vị trí cũ (đã cạn kiệt)"
                                                : isExplored
                                                ? "Đã khám phá"
                                                : "Màn sương bí ẩn"
                                        }`}
                                    />
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Chú thích màu sắc lưới */}
                <div className="grid grid-cols-3 gap-y-1 text-[10px] text-slate-400 px-1 border-t border-slate-800 pt-1.5">
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm bg-emerald-500/50" />
                        Đã khám phá
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm bg-rose-600" />
                        Vết sẹo lò lửa
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm bg-amber-500" />
                        Bếp ăn (tìm thấy)
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm bg-cyan-400" />
                        Vòi nước (tìm thấy)
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm bg-amber-950 border border-amber-700" />
                        Vị trí cũ đã cạn
                    </span>
                    <span className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-sm ${isBo ? "bg-blue-400" : "bg-pink-400"}`} />
                        Vị trí bé
                    </span>
                </div>

                {/* Hiện trạng phát hiện tài nguyên & Dung lượng hiện tại */}
                <div className="grid grid-cols-3 gap-1.5 pt-1 text-[11px] font-mono">
                    <div className="bg-slate-950/70 p-1.5 rounded border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 block">Bếp Ăn ({foodCapacity}%):</span>
                        <span className={memory?.discovered_resources?.food?.discovered ? "text-emerald-400 font-bold" : "text-amber-400/80 italic text-[10px]"}>
                            {memory?.discovered_resources?.food?.discovered
                                ? `[${food[0].toFixed(1)}, ${food[1].toFixed(1)}]`
                                : "Chưa biết"}
                        </span>
                    </div>
                    <div className="bg-slate-950/70 p-1.5 rounded border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 block">Vòi Nước ({waterCapacity}%):</span>
                        <span className={memory?.discovered_resources?.water?.discovered ? "text-emerald-400 font-bold" : "text-amber-400/80 italic text-[10px]"}>
                            {memory?.discovered_resources?.water?.discovered
                                ? `[${water[0].toFixed(1)}, ${water[1].toFixed(1)}]`
                                : "Chưa biết"}
                        </span>
                    </div>
                    <div className="bg-slate-950/70 p-1.5 rounded border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 block">Giường Ngủ:</span>
                        <span className={memory?.discovered_resources?.bed?.discovered ? "text-emerald-400 font-bold" : "text-amber-400/80 italic text-[10px]"}>
                            {memory?.discovered_resources?.bed?.discovered ? "Đã tìm thấy" : "Chưa biết"}
                        </span>
                    </div>
                </div>

                {/* Lịch sử các vị trí tài nguyên đã ghi nhớ trên bản đồ */}
                {memory?.discovered_history && memory.discovered_history.length > 0 && (
                    <div className="bg-slate-950/80 p-2 rounded border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-300 font-semibold border-b border-slate-800/80 pb-1">
                            <span>Vị Trí Tài Nguyên Đã Ghi Nhớ Vào Map:</span>
                            <span className="text-[10px] font-mono text-slate-400">
                                {memory.discovered_history.length} tọa độ
                            </span>
                        </div>
                        <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                            {memory.discovered_history.map((hist, hIdx) => {
                                const isActive = hist.status === "active";
                                return (
                                    <div
                                        key={hIdx}
                                        className="flex items-center justify-between text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800"
                                    >
                                        <span className="text-slate-300">
                                            {hist.name} [{hist.pos[0].toFixed(1)}, {hist.pos[1].toFixed(1)}]
                                        </span>
                                        <span
                                            className={`px-1 rounded text-[9px] font-bold ${
                                                isActive
                                                    ? "bg-emerald-950 text-emerald-400 border border-emerald-600/50"
                                                    : "bg-rose-950 text-rose-400 border border-rose-600/50"
                                            }`}
                                        >
                                            {isActive ? "[ĐANG CÓ SẴN]" : "[ĐÃ CẠN KIỆT]"}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* 4. Dòng Ký Ức Đột Phá & Trải Nghiệm (Episodic Memories) */}
            {memory && memory.recent_memories && memory.recent_memories.length > 0 && (
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-indigo-500/30 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-indigo-300 font-bold flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                            Dòng Ký Ức Đáng Nhớ Gần Nhất:
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                            {memory.recent_memories.length} dấu mốc
                        </span>
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                        {memory.recent_memories.slice(0, 4).map((m) => {
                            let badgeColor = "bg-slate-800 text-slate-300 border-slate-700";
                            let typeLabel = "[SỰ KIỆN]";
                            if (m.type === "discovery") {
                                badgeColor = "bg-emerald-950/80 text-emerald-300 border-emerald-600/50";
                                typeLabel = "[PHÁT HIỆN]";
                            } else if (m.type === "danger") {
                                badgeColor = "bg-rose-950/80 text-rose-300 border-rose-600/50";
                                typeLabel = "[NGUY HIỂM]";
                            } else if (m.type === "feedback") {
                                badgeColor = "bg-amber-950/80 text-amber-300 border-amber-600/50";
                                typeLabel = "[HƯỚNG DẪN]";
                            } else if (m.type === "social") {
                                badgeColor = "bg-pink-950/80 text-pink-300 border-pink-600/50";
                                typeLabel = "[GIAO TIẾP]";
                            }
                            return (
                                <div
                                    key={m.id}
                                    className="bg-slate-950/60 p-1.5 rounded text-[11px] border border-slate-800 flex items-start gap-1.5"
                                >
                                    <span className={`px-1 py-0.5 rounded text-[9px] font-mono font-bold border shrink-0 ${badgeColor}`}>
                                        {typeLabel}
                                    </span>
                                    <span className="text-slate-200 leading-tight">
                                        {m.text}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 5. Thống Kê Hành Trình Cuộc Sống */}
            <div className="grid grid-cols-4 gap-1.5 text-xs bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/80 text-center">
                <div>
                    <span className="text-[10px] text-slate-400 block">Đã ăn:</span>
                    <span className="font-mono text-amber-400 font-bold">{stats.meals_eaten}</span>
                </div>
                <div>
                    <span className="text-[10px] text-slate-400 block">Uống nước:</span>
                    <span className="font-mono text-cyan-400 font-bold">{stats.water_drank}</span>
                </div>
                <div>
                    <span className="text-[10px] text-slate-400 block">Giấc ngủ:</span>
                    <span className="font-mono text-indigo-400 font-bold">{stats.naps_taken}</span>
                </div>
                <div>
                    <span className="text-[10px] text-slate-400 block">Trò chuyện:</span>
                    <span className="font-mono text-pink-400 font-bold">{stats.social_chats || 0}</span>
                </div>
                <div className="border-t border-slate-800 pt-1">
                    <span className="text-[10px] text-slate-400 block">Được khen:</span>
                    <span className="font-mono text-emerald-400 font-bold">+{stats.praises}</span>
                </div>
                <div className="border-t border-slate-800 pt-1">
                    <span className="text-[10px] text-slate-400 block">Nhắc nhở:</span>
                    <span className="font-mono text-rose-400 font-bold">-{stats.scoldings}</span>
                </div>
                <div className="border-t border-slate-800 pt-1 col-span-2">
                    <span className="text-[10px] text-slate-400 block">Va đụng lò lửa:</span>
                    <span className="font-mono text-orange-400 font-bold">{stats.collisions}</span>
                </div>
            </div>

            {/* 6. Phần Năng Lượng Sinh Học (Kcal) */}
            <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-200 font-semibold">
                        Dự Trữ Năng Lượng Thể Chất (Kcal)
                    </span>
                    <span className="font-mono text-emerald-400 font-bold">
                        {energy.toFixed(0)} / {energy_max.toFixed(0)} Kcal
                        {digesting > 0 ? ` (+${digesting.toFixed(0)} tiêu hóa)` : ""}
                    </span>
                </div>
                <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                        className="h-full bg-emerald-500 transition-all duration-150"
                        style={{ width: `${energyPct}%` }}
                    />
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-xs text-slate-300">
                    <div className="bg-slate-950/60 px-2 py-1 rounded border border-slate-800">
                        <span className="text-slate-400 text-[11px] block">Thể lực di chuyển:</span>
                        <span className="font-mono text-white font-semibold">
                            {(alpha_motor * 100).toFixed(0)}% tối đa
                        </span>
                    </div>
                    <div className="bg-slate-950/60 px-2 py-1 rounded border border-slate-800">
                        <span className="text-slate-400 text-[11px] block">Độ sâu tư duy:</span>
                        <span className="font-mono text-white font-semibold">
                            {(alpha_cognitive * 100).toFixed(0)}% tính toán
                        </span>
                    </div>
                </div>
            </div>

            {/* 7. Lưới 8 Nhu Cầu Nội Tại (Drives bao gồm Social) */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-1">
                <DriveBar
                    label="Độ Đói (Hunger)"
                    description="Tăng theo thời gian; đi đến Bếp ăn để nạp thêm Kcal."
                    value={drives.hunger}
                    colorClass="bg-amber-500"
                    urgent={drives.hunger > 0.75}
                />
                <DriveBar
                    label="Độ Khát (Thirst)"
                    description="Tăng đều; đi đến Vòi nước uống để giải khát."
                    value={drives.thirst}
                    colorClass="bg-cyan-400"
                    urgent={drives.thirst > 0.75}
                />
                <DriveBar
                    label="Mệt Mỏi (Fatigue)"
                    description="Tăng khi vận động; về Giường ngủ để hồi phục thể lực."
                    value={drives.fatigue}
                    colorClass="bg-violet-500"
                    urgent={drives.fatigue > 0.75}
                />
                <DriveBar
                    label="Nhu Cầu Bầu Bạn (Social)"
                    description="Tăng khi ở một mình; giảm nhanh khi đi cạnh bạn bè."
                    value={drives.social || 0.2}
                    colorClass="bg-purple-500"
                    urgent={(drives.social || 0) > 0.7}
                />
                <DriveBar
                    label="Cơn Đau (Pain)"
                    description="Tăng vọt khi va đụng chướng ngại vật hoặc lò lửa."
                    value={drives.pain}
                    colorClass="bg-rose-500"
                    urgent={drives.pain > 0.3}
                />
                <DriveBar
                    label="Sợ Hãi (Fear)"
                    description="Tăng khi gần vùng nguy hiểm hoặc thấy bạn bị đau."
                    value={drives.fear}
                    colorClass="bg-orange-500"
                    urgent={drives.fear > 0.5}
                />
                <DriveBar
                    label="Tò Mò (Curiosity)"
                    description="Tăng mạnh khi no đủ, thúc đẩy bé khám phá thế giới."
                    value={drives.curiosity}
                    colorClass="bg-sky-400"
                />
                <DriveBar
                    label="Hạnh Phúc (Comfort)"
                    description="Mức độ cân bằng tổng thể khi có bạn bè và no ấm."
                    value={drives.comfort}
                    colorClass="bg-teal-400"
                />
            </div>
        </div>
    );
}
