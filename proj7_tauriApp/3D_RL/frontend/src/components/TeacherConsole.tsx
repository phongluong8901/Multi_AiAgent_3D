/**
 * ==============================================================================
 * BẢNG ĐIỀU KHIỂN NGƯỜI HƯỚNG DẪN (TEACHER INTERACTION CONSOLE)
 * ==============================================================================
 * Cung cấp toàn bộ công cụ tương tác, giáo dục và quản lý vòng đời cho Người Hướng Dẫn:
 * 1. Chế độ Tự Hành Sinh Tồn & Điều chỉnh tốc độ mô phỏng (0.0x Tạm dừng, 1.0x, 2.0x, 5.0x).
 * 2. Phản hồi Tức Thời Micro-RLHF:
 *    - Nút Khen thưởng (+5 điểm, phím tắt 'R'): Khích lệ hành vi tốt, củng cố trọng số nơ-ron ngay.
 *    - Nút Nhắc nhở (-8 điểm, phím tắt 'P'): Uốn nắn hành vi xấu, phạt giảm xác suất hành động.
 * 3. Chế độ Dắt Tay Đi (WASD) & Ghi Hình Thị Phạm:
 *    - Lái trực tiếp Bé Bo bằng phím bàn phím và ghi mẫu vào SQLite phục vụ Behavioral Cloning.
 * 4. Chăm Sóc Nhanh & Trạng Thái:
 *    - Cho ăn bánh (+250 Kcal), Cho nghỉ ngơi, Lưu trạng thái ra đĩa, Nạp lại, Reset màn chơi.
 * 5. Điều Phối Di Chuyển Nhanh:
 *    - Nút gửi bé đến các địa danh trọng điểm (Bếp ăn, Vòi nước, Giường Villa, Công viên, Đài phun nước).
 */

import { useState, useEffect } from "react";
import { useTrainingStore } from "../stores/useTrainingStore";
import {
    feedAgent,
    restAgent,
    saveAgentState,
    loadAgentState,
    resetAgentState,
    clearDemos,
    toggleAutonomyLife,
    setSimulationSpeed,
    giveTeacherFeedback,
    setTeacherTarget,
} from "../lib/api";

export default function TeacherConsole() {
    const {
        isTraining,
        isPlaying,
        isTeacherMode,
        isRecordingDemo,
        isAutonomousLife,
        simulationSpeed,
        demoCount,
        robot,
        robot2,
        setTeacherMode,
        setRecordingDemo,
        sendTeacherFeedback,
        sendClickTarget,
        toggleAutonomy,
        setSpeed,
        addLog,
    } = useTrainingStore();

    const [targetAgent, setTargetAgent] = useState<"both" | "bo" | "bi">("both");

    // Lắng nghe phím tắt: R (Khen thưởng), P (Phạt)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA") return;

            if (e.key.toLowerCase() === "r") {
                e.preventDefault();
                handleReward();
            } else if (e.key.toLowerCase() === "p") {
                e.preventDefault();
                handlePunish();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [targetAgent]);

    const handleToggleAutonomy = async () => {
        const next = !isAutonomousLife;
        toggleAutonomy(next);
        await toggleAutonomyLife(next);
    };

    const handleSpeedChange = async (speed: number) => {
        setSpeed(speed);
        await setSimulationSpeed(speed);
    };

    const handleReward = async () => {
        sendTeacherFeedback(true);
        await giveTeacherFeedback(true, targetAgent);
    };

    const handlePunish = async () => {
        sendTeacherFeedback(false);
        await giveTeacherFeedback(false, targetAgent);
    };

    const handleDirectTo = async (x: number, z: number, label: string) => {
        sendClickTarget(x, z, label);
        await setTeacherTarget(x, z, label, targetAgent);
    };

    // Chỉ đạo hai bé gặp gỡ nhau
    const handleMeetEachOther = async () => {
        addLog("[TƯƠNG TÁC] Chỉ dẫn hai bé đi đến vị trí của nhau để trò chuyện!");
        if (robot2 && robot2.length === 2) {
            await setTeacherTarget(robot2[0], robot2[1], "Đến gặp bạn Bi", "bo");
        }
        if (robot && robot.length === 2) {
            await setTeacherTarget(robot[0], robot[1], "Đến gặp bạn Bo", "bi");
        }
    };

    const handleToggleTeacher = () => {
        const next = !isTeacherMode;
        setTeacherMode(next);
        addLog(
            next
                ? "[THÔNG BÁO] Đã BẬT chế độ Người Hướng Dẫn dắt tay Bé Bo bằng phím (WASD)"
                : "[THÔNG BÁO] Đã TẮT chế độ lái bằng phím"
        );
    };

    const handleFeed = async () => {
        const res = await feedAgent(250, targetAgent);
        if (res.status === "fed") {
            const targetName =
                targetAgent === "both" ? "cả hai bé" : targetAgent === "bo" ? "Bé Bo" : "Bé Bi";
            addLog(`[CHĂM SÓC] Người hướng dẫn cho ${targetName} ăn bánh (+250 Kcal)`);
        }
    };

    const handleRest = async () => {
        const res = await restAgent(targetAgent);
        if (res.status === "rested") {
            const targetName =
                targetAgent === "both" ? "cả hai bé" : targetAgent === "bo" ? "Bé Bo" : "Bé Bi";
            addLog(`[CHĂM SÓC] Đã vỗ về ${targetName}, giảm mệt mỏi và xoa dịu sợ hãi`);
        }
    };

    const handleSave = async () => {
        const res = await saveAgentState();
        addLog(
            res.status === "saved"
                ? "[THÀNH CÔNG] Đã lưu trạng thái hai bé vào ổ đĩa"
                : "[LỖI] Không thể lưu trạng thái vào ổ đĩa"
        );
    };

    const handleLoad = async () => {
        const res = await loadAgentState();
        addLog(
            res.status === "loaded"
                ? "[THÀNH CÔNG] Đã khôi phục trạng thái cũ của hai bé từ ổ đĩa"
                : "[CẢNH BÁO] Không tìm thấy bản lưu nào trước đó"
        );
    };

    const handleReset = async () => {
        await resetAgentState(true);
        addLog("[THÔNG BÁO] Đã đặt lại thế giới và trạng thái nội tại của hai bé về ban đầu");
    };

    const handleClearDemos = async () => {
        await clearDemos();
        addLog("[THÔNG BÁO] Đã xóa toàn bộ dữ liệu mẫu học (Demonstrations)");
    };

    return (
        <div className="bg-slate-800/95 backdrop-blur p-4 rounded-xl border border-slate-700 space-y-3.5 shadow-md">
            {/* Tiêu đề & Công tắc Tự Hành */}
            <div className="flex items-center justify-between border-b border-slate-700/70 pb-2.5">
                <div>
                    <h2 className="text-sm font-bold uppercase tracking-wide text-white flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 inline-block" />
                        Bảng Người Hướng Dẫn (Teacher)
                    </h2>
                    <p className="text-[11px] text-slate-400">
                        Giáo dục bằng Thưởng/Phạt, Chỉ định mục tiêu & Chăm sóc hai bé
                    </p>
                </div>
                <button
                    onClick={handleToggleAutonomy}
                    disabled={isTraining || isPlaying}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition border shadow ${
                        isAutonomousLife
                            ? "bg-emerald-600 border-emerald-400 text-white shadow-emerald-600/30"
                            : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
                    }`}
                >
                    TỰ HÀNH: {isAutonomousLife ? "BẬT" : "TẮT"}
                </button>
            </div>

            {/* Chọn Đối Tượng Hướng Dẫn: Cả hai bé / Bé Bo / Bé Bi */}
            <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-700/80 flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold text-[11px]">Đối tượng tác động:</span>
                <div className="flex gap-1">
                    <button
                        onClick={() => setTargetAgent("both")}
                        className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                            targetAgent === "both"
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-800 text-slate-400 hover:text-white"
                        }`}
                    >
                        Cả Hai Bé
                    </button>
                    <button
                        onClick={() => setTargetAgent("bo")}
                        className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                            targetAgent === "bo"
                                ? "bg-blue-600 text-white"
                                : "bg-slate-800 text-slate-400 hover:text-white"
                        }`}
                    >
                        Bé Bo
                    </button>
                    <button
                        onClick={() => setTargetAgent("bi")}
                        className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                            targetAgent === "bi"
                                ? "bg-pink-600 text-white"
                                : "bg-slate-800 text-slate-400 hover:text-white"
                        }`}
                    >
                        Bé Bi
                    </button>
                </div>
            </div>

            {/* 1. Bộ Giáo Dục Micro-RLHF (Thưởng / Phạt Thời Gian Thực) */}
            <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-200 font-bold">
                        Giáo Dục Hành Vi (Teacher Feedback)
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                        Phím tắt: R / P
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={handleReward}
                        className="py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 border border-emerald-400 text-white text-xs font-bold transition shadow flex items-center justify-center gap-1.5"
                    >
                        [+] Khen Thưởng (R)
                    </button>
                    <button
                        onClick={handlePunish}
                        className="py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 border border-rose-400 text-white text-xs font-bold transition shadow flex items-center justify-center gap-1.5"
                    >
                        [-] Phạt Răn Đe (P)
                    </button>
                </div>
            </div>

            {/* 2. Chỉ Định Mục Tiêu Nhanh Cho Bé */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">Lệnh Nhanh Đi Đến:</span>
                    <button
                        onClick={handleMeetEachOther}
                        className="text-[11px] text-pink-400 hover:text-pink-300 underline font-semibold"
                    >
                        Hai Bé Tìm Nhau
                    </button>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                    <button
                        onClick={() => handleDirectTo(3.0, 17.0, "Khu Bếp Ăn")}
                        className="py-1.5 px-1 rounded bg-amber-600/25 hover:bg-amber-600/40 border border-amber-500/40 text-amber-200 text-[11px] font-semibold transition text-center"
                    >
                        Bếp Ăn
                    </button>
                    <button
                        onClick={() => handleDirectTo(17.0, 3.0, "Vòi Nước")}
                        className="py-1.5 px-1 rounded bg-cyan-600/25 hover:bg-cyan-600/40 border border-cyan-500/40 text-cyan-200 text-[11px] font-semibold transition text-center"
                    >
                        Vòi Nước
                    </button>
                    <button
                        onClick={() => handleDirectTo(2.5, 2.5, "Giường Ngủ")}
                        className="py-1.5 px-1 rounded bg-indigo-600/25 hover:bg-indigo-600/40 border border-indigo-500/40 text-indigo-200 text-[11px] font-semibold transition text-center"
                    >
                        Giường Ngủ
                    </button>
                    <button
                        onClick={() => handleDirectTo(10.0, 10.0, "Thảm Chơi")}
                        className="py-1.5 px-1 rounded bg-sky-600/25 hover:bg-sky-600/40 border border-sky-500/40 text-sky-200 text-[11px] font-semibold transition text-center"
                    >
                        Thảm Chơi
                    </button>
                </div>
            </div>

            {/* 3. Tốc Độ Mô Phỏng Cuộc Sống */}
            <div className="flex items-center justify-between bg-slate-900/60 p-2 rounded-lg border border-slate-700/60 text-xs">
                <span className="text-slate-400">Tốc độ thời gian:</span>
                <div className="flex gap-1 font-mono font-bold">
                    {[
                        { label: "Dừng", val: 0.0 },
                        { label: "1x", val: 1.0 },
                        { label: "2x", val: 2.0 },
                        { label: "5x", val: 5.0 },
                    ].map((btn) => (
                        <button
                            key={btn.val}
                            onClick={() => handleSpeedChange(btn.val)}
                            className={`px-2 py-0.5 rounded text-[11px] transition ${
                                simulationSpeed === btn.val
                                    ? "bg-blue-600 text-white font-bold"
                                    : "bg-slate-800 text-slate-400 hover:text-white"
                            }`}
                        >
                            {btn.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 4. Lái Trực Tiếp Bằng Phím & Thu Thập Dữ Liệu Mẫu */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-700/60">
                <button
                    onClick={handleToggleTeacher}
                    disabled={isTraining || isPlaying}
                    className={`py-2 px-2.5 rounded-lg text-xs font-bold transition border ${
                        isTeacherMode
                            ? "bg-indigo-600 border-indigo-300 text-white shadow-lg"
                            : "bg-slate-900 border-slate-600 text-slate-300 hover:bg-slate-700"
                    }`}
                >
                    {isTeacherMode ? "Dừng Lái Phím" : "Dắt Tay Bo (WASD)"}
                </button>

                <button
                    onClick={() => setRecordingDemo(!isRecordingDemo)}
                    disabled={!isTeacherMode}
                    className={`py-2 px-2.5 rounded-lg text-xs font-bold transition border ${
                        isRecordingDemo
                            ? "bg-rose-600/90 border-rose-400 text-white animate-pulse"
                            : "bg-slate-900 border-slate-600 text-slate-400 hover:text-slate-200 disabled:opacity-40"
                    }`}
                >
                    {isRecordingDemo ? "Đang Ghi Mẫu..." : `Ghi Mẫu (${demoCount})`}
                </button>
            </div>

            {/* 5. Chăm Sóc Sinh Học Trực Tiếp & Lưu / Tải Thế Giới */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-700/60">
                <button
                    onClick={handleFeed}
                    className="py-1.5 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-200 text-xs font-semibold transition"
                >
                    Cho Ăn Bánh (+250 Kcal)
                </button>
                <button
                    onClick={handleRest}
                    className="py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 text-xs font-semibold transition"
                >
                    Vỗ Về & Nghỉ Ngơi
                </button>
            </div>

            <div className="grid grid-cols-4 gap-1.5 pt-1 text-[11px] font-medium">
                <button
                    onClick={handleSave}
                    className="py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
                >
                    Lưu Game
                </button>
                <button
                    onClick={handleLoad}
                    className="py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
                >
                    Nạp Lại
                </button>
                <button
                    onClick={handleReset}
                    className="py-1 rounded bg-rose-900/60 hover:bg-rose-900 text-rose-200 border border-rose-700/60 transition"
                >
                    Reset Map
                </button>
                <button
                    onClick={handleClearDemos}
                    className="py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 transition"
                >
                    Xóa Demos
                </button>
            </div>
        </div>
    );
}
