import { useTrainingStore } from "../stores/useTrainingStore";

export default function StatusBar() {
    const { mode, isTraining, isPlaying, step, reward, dist, collided } = useTrainingStore();

    const statusText = isTraining ? "Training" : isPlaying ? "Playing" : "Idle";
    const statusColor = isTraining
        ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
        : isPlaying
        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
        : "bg-slate-700/40 text-slate-300 border-slate-600/30";

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs font-mono">
            <div className="flex items-center gap-2">
                <span className="text-slate-400">Mode:</span>
                <span className={`px-2 py-0.5 rounded border ${statusColor}`}>
                    [{mode.toUpperCase()}] {statusText}
                </span>
            </div>
            <div className="flex items-center gap-4 text-slate-300">
                <div>Step: <span className="text-white font-semibold">{step}</span></div>
                <div>Reward: <span className="text-white font-semibold">{reward.toFixed(2)}</span></div>
                <div>Distance: <span className="text-white font-semibold">{dist.toFixed(2)}</span></div>
                {collided && (
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold">
                        [COLLISION]
                    </span>
                )}
            </div>
        </div>
    );
}

