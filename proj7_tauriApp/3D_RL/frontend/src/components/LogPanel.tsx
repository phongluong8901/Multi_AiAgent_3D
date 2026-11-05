import { useTrainingStore } from "../stores/useTrainingStore";

export default function LogPanel() {
    const logs = useTrainingStore((s) => s.logs);
    const clearLogs = useTrainingStore((s) => s.clearLogs);

    return (
        <div className="bg-slate-800/95 border border-slate-700 rounded-xl p-3 flex-1 min-h-[140px] flex flex-col shadow-md">
            <div className="flex items-center justify-between mb-1.5 border-b border-slate-700/60 pb-1">
                <span className="text-slate-200 font-sans text-xs font-bold uppercase tracking-wider">
                    Nhật Ký Hoạt Động (Telemetry Logs)
                </span>
                <button
                    onClick={clearLogs}
                    className="text-[11px] text-slate-400 hover:text-white font-mono transition"
                >
                    [XÓA NHẬT KÝ]
                </button>
            </div>
            <div className="flex-1 overflow-y-auto font-mono text-xs space-y-1 pr-1">
                {logs.length === 0 && (
                    <div className="text-slate-500 italic py-2">
                        Đang chờ kết nối và sự kiện từ AI Engine...
                    </div>
                )}
                {logs.map((log, i) => (
                    <div key={i} className="text-slate-300 leading-relaxed break-words">
                        <span className="text-slate-500 mr-1.5">[{log.time}]</span>
                        {log.message}
                    </div>
                ))}
            </div>
        </div>
    );
}
