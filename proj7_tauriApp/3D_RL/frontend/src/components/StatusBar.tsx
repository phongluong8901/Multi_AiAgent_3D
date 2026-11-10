/**
 * ==============================================================================
 * THANH TRẠNG THÁI HỆ THỐNG TRỰC QUAN (STATUS BAR)
 * ==============================================================================
 * Nằm trên cùng giao diện, hiển thị tổng quan theo thời gian thực:
 * - Trạng thái hoạt động: CHỜ LỆNH, DẮT TAY BÉ BO (WASD), ĐANG HUẤN LUYỆN, TỰ HÀNH SINH TỒN,...
 * - Khoảng cách giữa 2 bé Bo & Bi (peerDist).
 * - Tổng số bước mô phỏng (step) và điểm thưởng tích lũy (reward).
 * - Cảnh báo nhấp nháy [VA CHẠM LÒ LỬA!] khi có bé bị va chạm.
 */

import { useTrainingStore } from "../stores/useTrainingStore";

export default function StatusBar() {
    const {
        isTraining,
        isPlaying,
        isTeacherMode,
        isAutonomousLife,
        mode,
        step,
        reward,
        peerDist,
        nearPeer,
        collided,
        collided2,
    } = useTrainingStore();

    let statusText = "CHỜ LỆNH";
    let statusColor = "bg-slate-700/50 text-slate-300 border-slate-600/40";

    if (isTeacherMode) {
        statusText = "DẮT TAY BÉ BO (WASD)";
        statusColor = "bg-indigo-500/25 text-indigo-300 border-indigo-500/50";
    } else if (isTraining) {
        statusText = "ĐANG HUẤN LUYỆN NÃO BỘ";
        statusColor = "bg-purple-500/25 text-purple-300 border-purple-500/50";
    } else if (isPlaying) {
        statusText = "BÉ TỰ ĐỘNG CHẠY (PPO)";
        statusColor = "bg-emerald-500/25 text-emerald-300 border-emerald-500/50";
    } else if (mode === "teacher_order") {
        statusText = "ĐI THEO LỆNH CHỈ ĐƯỜNG";
        statusColor = "bg-sky-500/25 text-sky-300 border-sky-500/50";
    } else if (isAutonomousLife) {
        statusText = nearPeer ? "BO & BI ĐANG CHƠI CÙNG NHAU" : "HAI BÉ TỰ HÀNH SINH TỒN";
        statusColor = nearPeer
            ? "bg-pink-500/25 text-pink-300 border-pink-500/50"
            : "bg-emerald-500/25 text-emerald-300 border-emerald-500/50";
    }

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-1.5 bg-slate-900/90 border border-slate-800 rounded-lg text-xs font-mono">
            <div className="flex items-center gap-2">
                <span className="text-slate-400 font-sans">Trạng thái:</span>
                <span className={`px-2.5 py-0.5 rounded border font-bold ${statusColor}`}>
                    {statusText}
                </span>
            </div>
            <div className="flex items-center gap-4 text-slate-300">
                <div>
                    Khoảng cách Bo - Bi:{" "}
                    <span className="text-pink-400 font-bold font-mono">{peerDist}m</span>
                </div>
                <div>
                    Bước: <span className="text-white font-bold">{step}</span>
                </div>
                <div>
                    Điểm: <span className="text-white font-bold">{reward.toFixed(2)}</span>
                </div>
                {(collided || collided2) && (
                    <span className="px-2 py-0.5 rounded bg-rose-500/25 text-rose-300 border border-rose-500/50 font-bold animate-pulse">
                        [VA CHẠM LÒ LỬA!]
                    </span>
                )}
            </div>
        </div>
    );
}
