import { useState } from "react";
import { useTrainingStore } from "../stores/useTrainingStore";
import { startTraining, loadModel, startPlay, stopPlay } from "../lib/api";

export default function ControlPanel() {
    const {
        isTraining,
        isPlaying,
        setTraining,
        setPlaying,
        addLog,
        step,
        reward,
        dist,
    } = useTrainingStore();

    const [timesteps, setTimesteps] = useState(80000);

    const handleStartTrain = async () => {
        setTraining(true);
        addLog(`[THÔNG BÁO] Bắt đầu quá trình dạy học PPO với ${timesteps} bước tính toán...`);
        const res = await startTraining(timesteps, 1);
        if (res.status !== "started") {
            setTraining(false);
            addLog("[CẢNH BÁO] Không thể khởi động tiến trình dạy học");
        }
    };

    const handleLoadModel = async () => {
        addLog("[THÔNG BÁO] Đang nạp mô hình vận động đã lưu...");
        const res = await loadModel("obstacle_ppo_latest");
        addLog(
            res.status === "loaded"
                ? "[THÀNH CÔNG] Đã nạp xong mô hình vận động"
                : `[LỖI] Không nạp được mô hình: ${res.detail}`
        );
    };

    const handlePlay = async () => {
        setPlaying(true);
        addLog("[THÔNG BÁO] Cho bé tự động di chuyển theo trí nhớ vận động...");
        const res = await startPlay(3);
        if (res.status === "no_model") {
            setPlaying(false);
            addLog("[CẢNH BÁO] Chưa có mô hình nào được nạp vào bộ nhớ");
        }
    };

    const handleStopPlay = async () => {
        await stopPlay();
        setPlaying(false);
        addLog("[THÔNG BÁO] Đã dừng chuyển động tự động");
    };

    return (
        <div className="bg-slate-800/95 backdrop-blur p-4 rounded-xl border border-slate-700 space-y-3.5 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-700/70 pb-2">
                <div>
                    <h2 className="text-sm font-bold uppercase tracking-wide text-white">
                        Huấn Luyện Vận Động Tự Động (PPO RL)
                    </h2>
                    <p className="text-[11px] text-slate-400">
                        Bé tự học cách di chuyển né vật cản để tới đích
                    </p>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded border border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                    {isTraining ? "ĐANG DẠY HỌC..." : isPlaying ? "ĐANG TỰ ĐI" : "CHỜ LỆNH"}
                </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/80">
                <div>
                    <span className="text-slate-400 text-[11px] block">Bước mô phỏng:</span>
                    <span className="text-white font-mono font-bold">{step}</span>
                </div>
                <div>
                    <span className="text-slate-400 text-[11px] block">Điểm thưởng:</span>
                    <span className="text-white font-mono font-bold">{reward.toFixed(2)}</span>
                </div>
                <div>
                    <span className="text-slate-400 text-[11px] block">Cách đích:</span>
                    <span className="text-white font-mono font-bold">{dist.toFixed(2)}m</span>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <label className="text-xs text-slate-300 font-medium whitespace-nowrap">
                    Số bước dạy (Timesteps):
                </label>
                <input
                    type="number"
                    value={timesteps}
                    onChange={(e) => setTimesteps(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                />
            </div>

            <div className="grid grid-cols-2 gap-2">
                <button
                    onClick={handleStartTrain}
                    disabled={isTraining || isPlaying}
                    className="py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-xs font-bold transition shadow"
                >
                    {isTraining ? "Đang Huấn Luyện..." : "Bắt Đầu Dạy Học (Train)"}
                </button>

                <button
                    onClick={handleLoadModel}
                    disabled={isTraining}
                    className="py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-xs font-bold transition shadow"
                >
                    Nạp Mô Hình Đã Lưu
                </button>

                <button
                    onClick={handlePlay}
                    disabled={isTraining || isPlaying}
                    className="py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-xs font-bold transition shadow"
                >
                    Cho Bé Tự Đi (Play)
                </button>
                <button
                    onClick={handleStopPlay}
                    disabled={!isPlaying}
                    className="py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 text-xs font-bold transition shadow"
                >
                    Dừng Di Chuyển
                </button>
            </div>
        </div>
    );
}
