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

// Bảng ánh xạ tên tiếng Việt cho động lực ưu tiên
const DOMINANT_DRIVE_NAMES: Record<string, string> = {
    hunger: "TÌM ĐỒ ĂN (ĐANG ĐÓI)",
    thirst: "TÌM NƯỚC UỐNG (ĐANG KHÁT)",
    fatigue: "VỀ GIƯỜNG NGHỈ (QUÁ MỆT)",
    pain: "NÉ TRÁNH NGUY HIỂM (ĐANG ĐAU)",
    fear: "TÌM NƠI AN TOÀN (SỢ HÃI)",
    curiosity: "TỰ DO KHÁM PHÁ (TÒ MÒ)",
    comfort: "CÂN BẰNG NỘI TẠI",
};

export default function InternalMonitor() {
    const energyState = useTrainingStore((s) => s.energyState);
    const drivesState = useTrainingStore((s) => s.drivesState);

    const { energy, energy_max, digesting, alpha_motor, alpha_cognitive } = energyState;
    const { drives, dominant_drive, survival_override } = drivesState;
    const energyPct = Math.min(100, Math.max(0, Math.round((energy / Math.max(1, energy_max)) * 100)));

    const dominantText = DOMINANT_DRIVE_NAMES[dominant_drive] || dominant_drive.toUpperCase();

    return (
        <div className="bg-slate-800/95 backdrop-blur p-4 rounded-xl border border-slate-700 space-y-3.5 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-700/70 pb-2">
                <div>
                    <h2 className="text-sm font-bold uppercase tracking-wide text-white">
                        Hệ Thống Nội Tại (Nhu Cầu & Năng Lượng)
                    </h2>
                    <p className="text-[11px] text-slate-400">
                        Phản ánh thể trạng và động lực ra quyết định của bé
                    </p>
                </div>
                <span
                    className={`px-2.5 py-1 rounded text-xs font-mono font-bold border ${
                        survival_override
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse"
                            : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                    }`}
                >
                    {survival_override ? "[BÁO ĐỘNG SINH TỒN]" : `ƯU TIÊN: ${dominantText}`}
                </span>
            </div>

            {/* Phần Năng Lượng Sinh Học (Kcal) */}
            <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-200 font-semibold">
                        Dự Trữ Năng Lượng Thể Chất (Kcal)
                    </span>
                    <span className="font-mono text-emerald-400 font-bold">
                        {energy.toFixed(0)} / {energy_max.toFixed(0)} Kcal
                        {digesting > 0 ? ` (+${digesting.toFixed(0)} đang tiêu hóa)` : ""}
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
                            {(alpha_motor * 100).toFixed(0)}% tốc độ tối đa
                        </span>
                    </div>
                    <div className="bg-slate-950/60 px-2 py-1 rounded border border-slate-800">
                        <span className="text-slate-400 text-[11px] block">Độ sâu suy nghĩ:</span>
                        <span className="font-mono text-white font-semibold">
                            {(alpha_cognitive * 100).toFixed(0)}% khả năng lập kế hoạch
                        </span>
                    </div>
                </div>
            </div>

            {/* Lưới 7 Nhu Cầu Nội Tại (Drives) */}
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
                    label="Cơn Đau (Pain)"
                    description="Tăng vọt khi va đụng chướng ngại vật hoặc lò lửa."
                    value={drives.pain}
                    colorClass="bg-rose-500"
                    urgent={drives.pain > 0.3}
                />
                <DriveBar
                    label="Sợ Hãi (Fear)"
                    description="Tăng khi gần vùng nguy hiểm; giảm khi về giường an toàn."
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
                <div className="col-span-2 pt-1 border-t border-slate-700/50">
                    <DriveBar
                        label="Độ Dễ Chịu / Cân Bằng (Comfort)"
                        description="Mức độ hạnh phúc tổng thể khi các nhu cầu sinh tồn được đáp ứng tốt."
                        value={drives.comfort}
                        colorClass="bg-teal-400"
                    />
                </div>
            </div>
        </div>
    );
}
