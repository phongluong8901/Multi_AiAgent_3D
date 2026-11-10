/**
 * ==============================================================================
 * BIỂU ĐỒ & CHỈ SỐ ĐIỂM THƯỞNG (REWARD & METRICS COMPONENT)
 * ==============================================================================
 * Hiển thị chỉ số điểm thưởng (Reward) và bước tương tác (Step) hiện tại từ môi trường.
 */

import { useTrainingStore } from "../stores/useTrainingStore";

export default function RewardChart() {
    const { reward, step } = useTrainingStore();

    return (
        <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-4 text-xs font-mono">
            <div className="text-slate-400 mb-2 font-sans text-sm font-medium">Metrics</div>
            <div className="text-slate-300">
                Latest Step: {step} | Reward: {reward.toFixed(2)}
            </div>
        </div>
    );
}
