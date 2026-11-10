/**
 * ==============================================================================
 * BẢNG ĐIỀU KHIỂN HUẤN LUYỆN & CHÍNH SÁCH VẬN ĐỘNG (AI CONTROL PANEL)
 * ==============================================================================
 * Cung cấp giao diện quản trị 3 phương thức học máy của hệ thống:
 * 1. Tab "Tự Học Trực Tuyến (Online RL)":
 *    - Sử dụng Actor-Critic kết hợp Intrinsic Curiosity Module (ICM) và học quan sát xã hội.
 *    - Tự động học liên tục qua từng bước chân không cần dừng mô phỏng.
 *    - Nút "Reset Trí Não Về Tabula Rasa": Xóa sạch sương mù và nơ-ron về con số 0.
 * 2. Tab "Bắt Chước (Behavioral Cloning - BC)":
 *    - Sinh mẫu thị phạm tự động từ chuyên gia hoặc sử dụng mẫu lái bằng WASD.
 *    - Huấn luyện mạng nơ-ron supervised learning (35 epochs).
 *    - Nạp và kích hoạt mô hình BC (bc_policy_latest.pt).
 * 3. Tab "Dạy Học Ngoại Tuyến (PPO)":
 *    - Huấn luyện PPO qua Stable-Baselines3 (10,000 - 80,000 timesteps).
 *    - Nạp mô hình checkpoint (obstacle_ppo_latest.zip) và chạy biểu diễn Play.
 */

import { useState } from "react";
import { useTrainingStore } from "../stores/useTrainingStore";
import {
    startTraining,
    loadModel,
    startPlay,
    stopPlay,
    generateExpertDemos,
    startBCTraining,
    loadBCModel,
    setPolicyMode,
    clearDemos,
    resetTabulaRasa,
} from "../lib/api";

export default function ControlPanel() {
    const {
        isTraining,
        isPlaying,
        setTraining,
        setPlaying,
        addLog,
        demoCount,
        policyMode,
        hasBcModel,
        trainProgress,
    } = useTrainingStore();

    const [activeTab, setActiveTab] = useState<"bc" | "ppo" | "online">("online");
    const [ppoTimesteps, setPpoTimesteps] = useState(10000);
    const [bcEpochs, setBcEpochs] = useState(35);
    const [isGeneratingDemos, setIsGeneratingDemos] = useState(false);
    const [isResettingMemory, setIsResettingMemory] = useState(false);

    // Chuyển đổi não bộ vận động
    const handleSetPolicyMode = async (mode: "heuristic" | "bc" | "ppo" | "online_rl") => {
        addLog(`[CẤU HÌNH] Chuyển đổi não bộ vận động sang: ${mode.toUpperCase()}`);
        await setPolicyMode(mode);
    };

    // Đưa trí óc về tờ giấy trắng Tabula Rasa
    const handleTabulaRasa = async () => {
        if (window.confirm("Bạn có muốn xóa sạch bản đồ khám phá và đưa trí não bé về con số 0 (Tabula Rasa)?")) {
            setIsResettingMemory(true);
            try {
                const res = await resetTabulaRasa();
                addLog(res.message || "[THÀNH CÔNG] Đã reset toàn bộ trí nhớ không gian và trọng số nơ-ron về Tabula Rasa.");
            } catch {
                addLog("[LỖI] Không thể reset trí nhớ.");
            } finally {
                setIsResettingMemory(false);
            }
        }
    };

    // Tạo mẫu dữ liệu chuyên gia
    const handleGenerateDemos = async () => {
        setIsGeneratingDemos(true);
        addLog("[THÔNG BÁO] Đang tạo 150 mẫu thị phạm chuyên gia...");
        try {
            const res = await generateExpertDemos(150);
            addLog(res.message || `[THÀNH CÔNG] Tổng số mẫu hiện có: ${res.total_demos}`);
        } catch {
            addLog("[LỖI] Không thể tạo mẫu thị phạm");
        } finally {
            setIsGeneratingDemos(false);
        }
    };

    // Huấn luyện Bắt Chước (Behavioral Cloning)
    const handleStartBCTrain = async () => {
        if (demoCount < 10) {
            addLog("[CẢNH BÁO] Cần ít nhất 10 mẫu thị phạm. Hãy lái bằng WASD hoặc nhấn 'Tạo 150 Mẫu Chuyên Gia' trước.");
            return;
        }
        setTraining(true);
        addLog(`[BẮT ĐẦU] Huấn luyện Behavioral Cloning (${bcEpochs} epochs)...`);
        const res = await startBCTraining(bcEpochs);
        if (res.status !== "started") {
            setTraining(false);
            addLog("[LỖI] Không thể khởi động huấn luyện Bắt Chước");
        }
    };

    // Nạp mô hình BC
    const handleLoadBC = async () => {
        addLog("[THÔNG BÁO] Đang nạp mô hình Bắt Chước BC...");
        const res = await loadBCModel();
        if (res.status === "loaded") {
            addLog("[THÀNH CÔNG] Đã nạp xong mô hình BC! Bé sẽ di chuyển theo não bộ Bắt Chước.");
        } else {
            addLog("[LỖI] Chưa tìm thấy tệp mô hình BC đã huấn luyện.");
        }
    };

    // Xóa mẫu thị phạm
    const handleClearDemos = async () => {
        if (window.confirm("Bạn có chắc muốn xóa toàn bộ mẫu thị phạm đã lưu?")) {
            await clearDemos();
            addLog("[THÔNG BÁO] Đã xóa toàn bộ mẫu thị phạm trong bộ nhớ SQLite.");
        }
    };

    // Huấn luyện PPO Reinforcement Learning
    const handleStartPpoTrain = async () => {
        setTraining(true);
        addLog(`[BẮT ĐẦU] Huấn luyện PPO với ${ppoTimesteps} bước tính toán...`);
        const res = await startTraining(ppoTimesteps, 1);
        if (res.status !== "started") {
            setTraining(false);
            addLog("[CẢNH BÁO] Không thể khởi động tiến trình dạy học PPO");
        }
    };

    // Nạp mô hình PPO
    const handleLoadPpoModel = async () => {
        addLog("[THÔNG BÁO] Đang nạp mô hình PPO đã lưu...");
        const res = await loadModel("obstacle_ppo_latest");
        if (res.status === "loaded") {
            addLog("[THÀNH CÔNG] Đã nạp mô hình PPO");
            await setPolicyMode("ppo");
        } else {
            addLog(`[LỖI] Không nạp được mô hình: ${res.detail}`);
        }
    };

    // Cho bé tự đi bằng mô hình PPO
    const handlePlayPpo = async () => {
        setPlaying(true);
        addLog("[THÔNG BÁO] Cho bé tự động di chuyển theo trí nhớ PPO...");
        const res = await startPlay(3);
        if (res.status === "no_model") {
            setPlaying(false);
            addLog("[CẢNH BÁO] Chưa có mô hình PPO nào được nạp vào bộ nhớ");
        }
    };

    const handleStopPlay = async () => {
        await stopPlay();
        setPlaying(false);
        addLog("[THÔNG BÁO] Đã dừng chuyển động tự động");
    };

    return (
        <div className="bg-slate-800/95 backdrop-blur p-4 rounded-xl border border-slate-700 space-y-3.5 shadow-md">
            {/* Tiêu đề & Trạng thái */}
            <div className="flex items-center justify-between border-b border-slate-700/70 pb-2.5">
                <div>
                    <h2 className="text-sm font-bold uppercase tracking-wide text-white">
                        Trung Tâm Huấn Luyện Não Bộ
                    </h2>
                    <p className="text-[11px] text-slate-400">
                        Học Bắt Chước (Imitation Learning) & Học Tăng Cường (PPO RL)
                    </p>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded border border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                    {isTraining ? "ĐANG HUẤN LUYỆN..." : isPlaying ? "ĐANG TỰ ĐI" : "SẴN SÀNG"}
                </span>
            </div>

            {/* Thanh chọn Não Bộ Đang Hoạt Động (Policy Mode) */}
            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300 font-semibold">Não Bộ Vận Động:</span>
                    <span className="font-mono font-bold text-sky-400 uppercase">
                        [{policyMode}]
                    </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                    <button
                        onClick={() => handleSetPolicyMode("online_rl")}
                        className={`py-1.5 px-1 rounded text-[10px] font-bold border transition text-center ${
                            policyMode === "online_rl"
                                ? "bg-amber-600 border-amber-400 text-white shadow"
                                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                        }`}
                    >
                        Online RL
                    </button>
                    <button
                        onClick={() => handleSetPolicyMode("heuristic")}
                        className={`py-1.5 px-1 rounded text-[10px] font-bold border transition text-center ${
                            policyMode === "heuristic"
                                ? "bg-sky-600 border-sky-400 text-white shadow"
                                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                        }`}
                    >
                        Tự Nhiên
                    </button>
                    <button
                        onClick={() => handleSetPolicyMode("bc")}
                        disabled={!hasBcModel}
                        className={`py-1.5 px-1 rounded text-[10px] font-bold border transition text-center disabled:opacity-40 disabled:cursor-not-allowed ${
                            policyMode === "bc"
                                ? "bg-purple-600 border-purple-400 text-white shadow"
                                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                        }`}
                    >
                        Bắt Chước
                    </button>
                    <button
                        onClick={() => handleSetPolicyMode("ppo")}
                        className={`py-1.5 px-1 rounded text-[10px] font-bold border transition text-center ${
                            policyMode === "ppo"
                                ? "bg-emerald-600 border-emerald-400 text-white shadow"
                                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                        }`}
                    >
                        PPO Offline
                    </button>
                </div>
            </div>

            {/* Khung Telemetry Tiến Trình Huấn Luyện Trực Quan */}
            {isTraining && (
                <div className="bg-purple-950/40 border border-purple-600/60 p-3 rounded-lg space-y-2 animate-pulse">
                    <div className="flex items-center justify-between text-xs font-mono font-bold text-purple-200">
                        <span>
                            {trainProgress.mode === "bc"
                                ? `[BC] Huấn luyện Epoch: ${trainProgress.epoch}/${trainProgress.totalEpochs}`
                                : `[PPO] Bước: ${trainProgress.step}/${trainProgress.totalSteps}`}
                        </span>
                        <span>{trainProgress.pct}%</span>
                    </div>
                    {/* Thanh Progress bar */}
                    <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-purple-800">
                        <div
                            className="bg-purple-500 h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(4, trainProgress.pct)}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-[11px] font-mono text-purple-300">
                        {trainProgress.mode === "bc" ? (
                            <span>MSE Loss: {trainProgress.loss.toFixed(5)}</span>
                        ) : (
                            <span>Reward TB: {trainProgress.reward.toFixed(2)}</span>
                        )}
                        <span>Tiến trình đang xử lý nhanh...</span>
                    </div>
                </div>
            )}

            {/* Tab chuyển đổi giữa các phương pháp học */}
            <div className="flex border-b border-slate-700 text-xs">
                <button
                    onClick={() => setActiveTab("online")}
                    className={`flex-1 py-1.5 font-bold border-b-2 transition ${
                        activeTab === "online"
                            ? "border-amber-500 text-amber-400"
                            : "border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                >
                    1. Tự Học Trực Tuyến
                </button>
                <button
                    onClick={() => setActiveTab("bc")}
                    className={`flex-1 py-1.5 font-bold border-b-2 transition ${
                        activeTab === "bc"
                            ? "border-purple-500 text-purple-400"
                            : "border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                >
                    2. Bắt Chước (BC)
                </button>
                <button
                    onClick={() => setActiveTab("ppo")}
                    className={`flex-1 py-1.5 font-bold border-b-2 transition ${
                        activeTab === "ppo"
                            ? "border-emerald-500 text-emerald-400"
                            : "border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                >
                    3. PPO Tăng Cường
                </button>
            </div>

            {/* TAB 1: TỰ HỌC TRỰC TUYẾN (CONTINUAL ONLINE RL) */}
            {activeTab === "online" && (
                <div className="space-y-2.5">
                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-amber-500/30 text-xs space-y-1.5">
                        <div className="text-amber-300 font-bold flex items-center justify-between">
                            <span>Tự Học Không Ngừng (Continual Online RL)</span>
                            <span className="font-mono text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/40">
                                PyTorch Backprop Live
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                            Mạng Actor-Critic liên tục tối ưu hóa trọng số qua hàm tính lỗi TD-Error theo từng bước đi thực tế. Bé bắt đầu từ con số 0 (Tabula Rasa) và tự mình khám phá toàn bộ thế giới.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => handleSetPolicyMode("online_rl")}
                            className="py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white transition shadow border border-amber-400/50"
                        >
                            Kích Hoạt Online RL
                        </button>
                        <button
                            onClick={handleTabulaRasa}
                            disabled={isResettingMemory}
                            className="py-2.5 rounded-lg bg-rose-700/80 hover:bg-rose-600 disabled:bg-slate-700 text-xs font-bold text-white transition shadow border border-rose-500/50"
                        >
                            {isResettingMemory ? "Đang Reset..." : "Reset Tabula Rasa (Về 0)"}
                        </button>
                    </div>
                </div>
            )}

            {/* TAB 1: HỌC BẮT CHƯỚC (BEHAVIORAL CLONING) */}
            {activeTab === "bc" && (
                <div className="space-y-2.5">
                    <div className="flex items-center justify-between bg-slate-900/80 px-3 py-2 rounded-lg border border-slate-700/80 text-xs">
                        <span className="text-slate-300">Số mẫu thị phạm hiện có:</span>
                        <span className="font-mono font-bold text-amber-400 text-sm">
                            {demoCount} mẫu
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={handleGenerateDemos}
                            disabled={isGeneratingDemos || isTraining}
                            className="py-2 px-2 rounded-lg bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-xs font-bold text-white transition shadow"
                        >
                            {isGeneratingDemos ? "Đang Tạo..." : "+ Tạo 150 Mẫu Chuẩn"}
                        </button>
                        <button
                            onClick={handleClearDemos}
                            disabled={demoCount === 0 || isTraining}
                            className="py-2 px-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-xs font-bold text-slate-300 transition"
                        >
                            Xóa Mẫu Dữ Liệu
                        </button>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                        <label className="text-slate-300 font-medium whitespace-nowrap">
                            Số Epochs:
                        </label>
                        <select
                            value={bcEpochs}
                            onChange={(e) => setBcEpochs(Number(e.target.value))}
                            className="bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1 text-xs text-white font-mono w-full"
                        >
                            <option value={20}>20 Epochs (Nhanh ~1 giây)</option>
                            <option value={35}>35 Epochs (Chuẩn ~2 giây)</option>
                            <option value={60}>60 Epochs (Kỹ ~4 giây)</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={handleStartBCTrain}
                            disabled={isTraining || isPlaying || demoCount < 10}
                            className="py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-400 text-xs font-bold text-white transition shadow"
                        >
                            {isTraining ? "Đang Huấn Luyện..." : "Huấn Luyện Nhanh (BC)"}
                        </button>
                        <button
                            onClick={handleLoadBC}
                            disabled={isTraining}
                            className="py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-xs font-bold text-white transition shadow"
                        >
                            Nạp & Chạy Model BC
                        </button>
                    </div>
                </div>
            )}

            {/* TAB 2: TỰ HỌC TĂNG CƯỜNG (PPO RL) */}
            {activeTab === "ppo" && (
                <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-xs">
                        <label className="text-slate-300 font-medium whitespace-nowrap">
                            Số bước tính:
                        </label>
                        <select
                            value={ppoTimesteps}
                            onChange={(e) => setPpoTimesteps(Number(e.target.value))}
                            className="bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono w-full"
                        >
                            <option value={5000}>5,000 bước (Thử nghiệm ~20 giây)</option>
                            <option value={10000}>10,000 bước (Cơ bản ~40 giây)</option>
                            <option value={30000}>30,000 bước (Mở rộng ~2 phút)</option>
                            <option value={80000}>80,000 bước (Chuyên sâu)</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={handleStartPpoTrain}
                            disabled={isTraining || isPlaying}
                            className="py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400 text-xs font-bold text-white transition shadow"
                        >
                            {isTraining ? "Đang Huấn Luyện..." : "Bắt Đầu Train PPO"}
                        </button>
                        <button
                            onClick={handleLoadPpoModel}
                            disabled={isTraining}
                            className="py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-xs font-bold text-white transition shadow"
                        >
                            Nạp Mô Hình PPO
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={handlePlayPpo}
                            disabled={isTraining || isPlaying}
                            className="py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 text-xs font-bold text-white transition shadow"
                        >
                            Cho Bé Tự Đi (Play)
                        </button>
                        <button
                            onClick={handleStopPlay}
                            disabled={!isPlaying}
                            className="py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 text-xs font-bold text-white transition shadow"
                        >
                            Dừng Tự Đi
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
