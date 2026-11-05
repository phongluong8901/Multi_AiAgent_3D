import { useTrainingStore } from "../stores/useTrainingStore";
import {
    feedAgent,
    restAgent,
    saveAgentState,
    loadAgentState,
    resetAgentState,
    clearDemos,
} from "../lib/api";

export default function TeacherConsole() {
    const {
        isTraining,
        isPlaying,
        isTeacherMode,
        isRecordingDemo,
        demoCount,
        setTeacherMode,
        setRecordingDemo,
        sendTeacherAction,
        addLog,
    } = useTrainingStore();

    const handleToggleTeacher = () => {
        const next = !isTeacherMode;
        setTeacherMode(next);
        addLog(
            next
                ? "[THÔNG BÁO] Đã BẬT chế độ Người Hướng Dẫn: Dùng phím W, A, S, D hoặc Mũi tên để lái bé"
                : "[THÔNG BÁO] Đã TẮT chế độ Người Hướng Dẫn"
        );
    };

    const handleFeed = async () => {
        const res = await feedAgent(250);
        if (res.status === "fed") {
            addLog("[CHĂM SÓC] Người hướng dẫn cho bé ăn (+250 Kcal)");
        }
    };

    const handleRest = async () => {
        const res = await restAgent();
        if (res.status === "rested") {
            addLog("[CHĂM SÓC] Đã trấn an bé, giảm mệt mỏi và xoa dịu sợ hãi");
        }
    };

    const handleSave = async () => {
        const res = await saveAgentState();
        addLog(
            res.status === "saved"
                ? "[THÀNH CÔNG] Đã lưu trạng thái hiện tại của bé vào ổ đĩa"
                : "[LỖI] Không thể lưu trạng thái vào ổ đĩa"
        );
    };

    const handleLoad = async () => {
        const res = await loadAgentState();
        addLog(
            res.status === "loaded"
                ? "[THÀNH CÔNG] Đã khôi phục trạng thái cũ của bé từ ổ đĩa"
                : "[CẢNH BÁO] Không tìm thấy bản lưu nào trước đó"
        );
    };

    const handleReset = async () => {
        await resetAgentState(true);
        addLog("[THÔNG BÁO] Đã đặt lại thế giới và trạng thái nội tại về ban đầu");
    };

    const handleClearDemos = async () => {
        await clearDemos();
        addLog("[THÔNG BÁO] Đã xóa toàn bộ dữ liệu mẫu học (Demonstrations)");
    };

    return (
        <div className="bg-slate-800/95 backdrop-blur p-4 rounded-xl border border-slate-700 space-y-3.5 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-700/70 pb-2">
                <div>
                    <h2 className="text-sm font-bold uppercase tracking-wide text-white">
                        Bảng Người Hướng Dẫn (Teacher)
                    </h2>
                    <p className="text-[11px] text-slate-400">
                        Dạy bé bằng cách lái trực tiếp & chăm sóc sinh hoạt
                    </p>
                </div>
                <span className="text-xs font-mono text-indigo-300 bg-indigo-500/15 px-2.5 py-1 rounded border border-indigo-500/30 font-bold">
                    Mẫu Đã Ghi: {demoCount}
                </span>
            </div>

            {/* Bật/Tắt Lái Phím & Ghi Mẫu */}
            <div className="grid grid-cols-2 gap-2">
                <button
                    onClick={handleToggleTeacher}
                    disabled={isTraining || isPlaying}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition border ${
                        isTeacherMode
                            ? "bg-indigo-600 border-indigo-300 text-white shadow-lg shadow-indigo-600/30"
                            : "bg-slate-900 border-slate-600 text-slate-200 hover:bg-slate-700"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {isTeacherMode ? "Lái Bằng Phím: ĐANG BẬT" : "Bật Lái Phím (WASD)"}
                </button>

                <button
                    onClick={() => setRecordingDemo(!isRecordingDemo)}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition border ${
                        isRecordingDemo
                            ? "bg-emerald-600/25 border-emerald-400/60 text-emerald-300"
                            : "bg-slate-900 border-slate-700 text-slate-400"
                    }`}
                >
                    {isRecordingDemo ? "Ghi Dữ Liệu Mẫu: BẬT" : "Ghi Dữ Liệu: TẮT"}
                </button>
            </div>

            {/* Bàn phím điều hướng nhanh trên màn hình khi đang ở chế độ lái */}
            {isTeacherMode && (
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-700/80 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-300 font-medium">
                        Bấm phím trên bàn phím hoặc click nút:
                    </span>
                    <div className="flex gap-1.5 font-mono text-xs font-bold">
                        <button
                            onClick={() => sendTeacherAction([0, -1.4])}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded border border-slate-600 text-white"
                            title="Đi lên phía Bắc"
                        >
                            W (Lên)
                        </button>
                        <button
                            onClick={() => sendTeacherAction([-1.4, 0])}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded border border-slate-600 text-white"
                            title="Sang phía Tây"
                        >
                            A (Trái)
                        </button>
                        <button
                            onClick={() => sendTeacherAction([0, 1.4])}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded border border-slate-600 text-white"
                            title="Xuống phía Nam"
                        >
                            S (Xuống)
                        </button>
                        <button
                            onClick={() => sendTeacherAction([1.4, 0])}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded border border-slate-600 text-white"
                            title="Sang phía Đông"
                        >
                            D (Phải)
                        </button>
                    </div>
                </div>
            )}

            {/* Các hành động chăm sóc: Cho ăn, Nghỉ ngơi, Xóa mẫu */}
            <div className="grid grid-cols-3 gap-2">
                <button
                    onClick={handleFeed}
                    className="py-2 px-2 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-200 text-xs font-semibold transition"
                    title="Nạp ngay 250 Kcal vào hệ tiêu hóa của bé"
                >
                    Cho Ăn (+250 Kcal)
                </button>
                <button
                    onClick={handleRest}
                    className="py-2 px-2 rounded-lg bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/40 text-violet-200 text-xs font-semibold transition"
                    title="Cho bé nghỉ ngơi, giảm mệt mỏi và đau đớn"
                >
                    Trấn An / Nghỉ Ngơi
                </button>
                <button
                    onClick={handleClearDemos}
                    className="py-2 px-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium transition"
                    title="Xóa toàn bộ các bước mẫu đã ghi trong SQLite"
                >
                    Xóa Mẫu Đã Ghi
                </button>
            </div>

            {/* Lưu & Khôi phục trạng thái */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-700/60">
                <button
                    onClick={handleSave}
                    className="py-1.5 px-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold transition"
                >
                    Lưu Trạng Thái
                </button>
                <button
                    onClick={handleLoad}
                    className="py-1.5 px-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold transition"
                >
                    Tải Trạng Thái
                </button>
                <button
                    onClick={handleReset}
                    className="py-1.5 px-2 rounded-lg bg-rose-900/50 hover:bg-rose-800/60 border border-rose-700/50 text-rose-200 text-xs font-semibold transition"
                >
                    Đặt Lại Từ Đầu
                </button>
            </div>
        </div>
    );
}
