import { useTrainingStore } from "../stores/useTrainingStore";

export default function StatusBar() {
    const { isTraining, isPlaying, isTeacherMode, step, reward, dist, collided } =
        useTrainingStore();

    let statusText = "CHỜ LỆNH (TỰ DO)";
    let statusColor = "bg-slate-700/50 text-slate-300 border-slate-600/40";

    if (isTeacherMode) {
        statusText = "NGƯỜI HƯỚNG DẪN (WASD)";
        statusColor = "bg-indigo-500/25 text-indigo-300 border-indigo-500/50";
    } else if (isTraining) {
        statusText = "ĐANG DẠY HỌC (PPO)";
        statusColor = "bg-amber-500/25 text-amber-300 border-amber-500/50";
    } else if (isPlaying) {
        statusText = "BÉ TỰ ĐỘNG CHẠY";
        statusColor = "bg-emerald-500/25 text-emerald-300 border-emerald-500/50";
    }

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-1.5 bg-slate-900/90 border border-slate-800 rounded-lg text-xs font-mono">
            <div className="flex items-center gap-2">
                <span className="text-slate-400 font-sans">Chế độ:</span>
                <span className={`px-2.5 py-0.5 rounded border font-bold ${statusColor}`}>
                    {statusText}
                </span>
            </div>
            <div className="flex items-center gap-4 text-slate-300">
                <div>
                    Bước: <span className="text-white font-bold">{step}</span>
                </div>
                <div>
                    Thưởng: <span className="text-white font-bold">{reward.toFixed(2)}</span>
                </div>
                <div>
                    Cách đích: <span className="text-white font-bold">{dist.toFixed(2)}m</span>
                </div>
                {collided && (
                    <span className="px-2 py-0.5 rounded bg-rose-500/25 text-rose-300 border border-rose-500/50 font-bold animate-pulse">
                        [BÉ BỊ VA CHẠM!]
                    </span>
                )}
            </div>
        </div>
    );
}
