import { useTrainingStore } from "../stores/useTrainingStore";

export default function LogPanel() {
    const logs = useTrainingStore((s) => s.logs);

    return (
        <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-4 h-64 overflow-y-auto font-mono text-xs">
            <div className="text-slate-400 mb-2 font-sans text-sm font-medium">Logs</div>
            {logs.length === 0 && (
                <div className="text-slate-500">No logs yet...</div>
            )}
            {logs.map((log, i) => (
                <div key={i} className="text-slate-300 leading-5">
                    <span className="text-slate-500">[{log.time}]</span> {log.message}
                </div>
            ))}
        </div>
    );
}