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
        addLog(`Start training ${timesteps} steps...`);
        const res = await startTraining(timesteps, 1);
        if (res.status !== "started") {
            setTraining(false);
            addLog("Cannot start training");
        }
    };

    const handleLoadModel = async () => {
        addLog("Loading model...");
        const res = await loadModel("obstacle_ppo_latest");
        addLog(res.status === "loaded" ? "Model loaded" : `Load failed: ${res.detail}`);
    };

    const handlePlay = async () => {
        setPlaying(true);
        addLog("Start playing policy...");
        const res = await startPlay(3);
        if (res.status === "no_model") {
            setPlaying(false);
            addLog("No model loaded");
        }
    };

    const handleStopPlay = async () => {
        await stopPlay();
        setPlaying(false);
        addLog("Stop play");
    };

    return (
        <div className="bg-slate-800/90 backdrop-blur p-5 rounded-xl border border-slate-700 space-y-4">
            <h2 className="text-lg font-semibold text-white">Control Panel</h2>

            <div className="grid grid-cols-2 gap-2 text-sm text-slate-300">
                <div>Step: <span className="text-white font-mono">{step}</span></div>
                <div>Reward: <span className="text-white font-mono">{reward.toFixed(2)}</span></div>
                <div>Dist: <span className="text-white font-mono">{dist.toFixed(2)}</span></div>
                <div>
                    Status:{" "}
                    <span className="text-emerald-400">
                        {isTraining ? "Training" : isPlaying ? "Playing" : "Idle"}
                    </span>
                </div>
            </div>

            <div>
                <label className="text-xs text-slate-400">Timesteps</label>
                <input
                    type="number"
                    value={timesteps}
                    onChange={(e) => setTimesteps(Number(e.target.value))}
                    className="w-full mt-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                />
            </div>

            <div className="space-y-2">
                <button
                    onClick={handleStartTrain}
                    disabled={isTraining || isPlaying}
                    className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-sm font-medium transition"
                >
                    {isTraining ? "Training..." : "Start Training"}
                </button>

                <button
                    onClick={handleLoadModel}
                    disabled={isTraining}
                    className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 text-sm font-medium transition"
                >
                    Load Model
                </button>

                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={handlePlay}
                        disabled={isTraining || isPlaying}
                        className="py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-sm font-medium transition"
                    >
                        Play
                    </button>
                    <button
                        onClick={handleStopPlay}
                        disabled={!isPlaying}
                        className="py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:bg-slate-600 text-sm font-medium transition"
                    >
                        Stop
                    </button>
                </div>
            </div>
        </div>
    );
}