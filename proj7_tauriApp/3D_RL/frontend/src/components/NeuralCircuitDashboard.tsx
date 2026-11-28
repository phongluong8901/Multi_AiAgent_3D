/**
 * ==============================================================================
 * BẢNG ĐIỀU KHIỂN VI MẠCH NƠ-RON & TỰ HỌC TRỰC TUYẾN (NEURAL CIRCUIT DASHBOARD)
 * ==============================================================================
 * Trực quan hóa 4 trụ cột công nghệ AI tiên tiến của bộ não tự học (OnlineLearner):
 * 1. World Model & Intrinsic Curiosity Module (ICM):
 *    - Curiosity Bonus: Điểm thưởng tò mò nội tại từ sai số dự đoán Forward Model.
 *    - Surprise Score: Mức độ bất ngờ [0.0 - 1.0] trước những điều mới lạ.
 *    - World Model Loss: Độ chính xác dự đoán động lực học môi trường.
 * 2. Cross-Agent Social Observational RL (Học Quan Sát Xã Hội):
 *    - Đếm số lần học gián tiếp từ bạn bè (Social Events).
 *    - Điểm thưởng xã hội chiết khấu (0.75x) khi bạn ăn no, uống nước hoặc bị đau.
 * 3. Prioritized Experience Replay (PER):
 *    - Dung lượng bộ đệm ưu tiên lưu trữ trải nghiệm theo độ bất ngờ.
 * 4. Hippocampal Sleep Dream Replay (Giấc Mộng Tái Hiện Ban Đêm):
 *    - Tái hiện ký ức ban đêm tại Villa, tốc độ biến đổi xi-náp (Synaptic Plasticity),
 *    - Nút kích hoạt cưỡng bức một chu kỳ giấc mộng ("Kích hoạt Giấc mộng").
 * 5. Huy hiệu Giai đoạn Phát triển Nhận thức (Piagetian Developmental Stages: 1, 2, 3).
 */

import { useState } from "react";
import { useTrainingStore } from "../stores/useTrainingStore";

export default function NeuralCircuitDashboard() {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const selectedAgent = useTrainingStore((s) => s.selectedAgent);
    const setSelectedAgent = useTrainingStore((s) => s.setSelectedAgent);

    const isBo = selectedAgent === "bo";
    const agentName = isBo ? "Bé Bo" : "Bé Bi";
    const peerName = isBo ? "Bé Bi" : "Bé Bo";

    const cognitiveState = useTrainingStore((s) => (isBo ? s.cognitiveState : s.cognitiveState2));
    const peerDist = useTrainingStore((s) => s.peerDist);
    const nearPeer = useTrainingStore((s) => s.nearPeer);
    const isNight = useTrainingStore((s) => s.isNight);
    const policyMode = useTrainingStore((s) => s.policyMode);
    const triggerDream = useTrainingStore((s) => s.triggerDream);

    const learner = cognitiveState?.online_learner;
    const curiosityBonus = learner?.curiosity_bonus ?? 0.0;
    const surpriseMetric = learner?.surprise_metric ?? 0.0;
    const worldModelLoss = learner?.world_model_loss ?? 0.0;
    const socialEvents = learner?.social_learning_events ?? 0;
    const lastSocialReward = learner?.last_social_reward ?? 0.0;
    const dreamState = learner?.dream_state;
    const isDreaming = dreamState?.is_dreaming || false;

    const [isTriggeringDream, setIsTriggeringDream] = useState(false);

    const handleForceDream = async () => {
        setIsTriggeringDream(true);
        await triggerDream(selectedAgent);
        setTimeout(() => setIsTriggeringDream(false), 800);
    };

    return (
        <div className="bg-slate-900/90 border border-cyan-800/60 rounded-xl p-3 shadow-lg shadow-cyan-950/30 backdrop-blur-md flex flex-col gap-2.5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                    {/* SVG Brain Icon */}
                    <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-700/50 text-cyan-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 01-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-xs font-bold text-cyan-300 tracking-wide uppercase">
                            Vi Mạch Nơ-ron & Học Tăng Cường
                        </h3>
                        <div className="text-[10px] text-slate-400 font-mono">
                            {policyMode.toUpperCase()} • ICM • PER • Social RL • Sleep Replay
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    {/* Tab chuyển Agent */}
                    <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-700 text-xs font-medium">
                        <button
                            onClick={() => setSelectedAgent("bo")}
                            className={`px-2 py-0.5 rounded ${isBo ? "bg-cyan-600 text-white font-bold" : "text-slate-400 hover:text-slate-200"}`}
                        >
                            Bo
                        </button>
                        <button
                            onClick={() => setSelectedAgent("bi")}
                            className={`px-2 py-0.5 rounded ${!isBo ? "bg-amber-600 text-white font-bold" : "text-slate-400 hover:text-slate-200"}`}
                        >
                            Bi
                        </button>
                    </div>

                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="text-slate-400 hover:text-slate-200 text-xs px-1.5 py-0.5 rounded bg-slate-800"
                        title={isCollapsed ? "Mở rộng bảng" : "Thu gọn bảng"}
                    >
                        {isCollapsed ? "+" : "-"}
                    </button>
                </div>
            </div>

            {!isCollapsed && (
                <div className="grid grid-cols-1 gap-2.5">
                    {/* 1. WORLD MODEL & INTRINSIC CURIOSITY (ICM) */}
                    <div className="bg-slate-950/70 border border-cyan-900/40 rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold text-cyan-400 flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Mô Hình Thế Giới & Động Lực Tò Mò (ICM)
                            </span>
                            <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800/50">
                                +{curiosityBonus.toFixed(2)} Kcal/bước
                            </span>
                        </div>

                        {/* Thanh đo Độ Bất Ngờ (Surprise Metric) */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px]">
                                <span className="text-slate-400">Độ Bất Ngờ (Surprise Novelty):</span>
                                <span className="font-mono text-amber-300 font-bold">{(surpriseMetric * 100).toFixed(1)}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
                                <div
                                    className="h-full bg-gradient-to-r from-cyan-500 to-amber-400 transition-all duration-200"
                                    style={{ width: `${Math.min(100, Math.max(0, surpriseMetric * 100))}%` }}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800/80 text-[10px]">
                            <div>
                                <span className="text-slate-400">Sai số dự đoán thế giới:</span>
                                <div className="font-mono text-slate-200 font-semibold">{worldModelLoss.toFixed(4)}</div>
                            </div>
                            <div>
                                <span className="text-slate-400">Cơ chế tự thưởng:</span>
                                <div className="text-emerald-400 font-semibold">Tò mò nội tại (Intrinsic)</div>
                            </div>
                        </div>
                    </div>

                    {/* 2. HỌC QUAN SÁT XÃ HỘI (CROSS-AGENT SOCIAL RL) */}
                    <div className="bg-slate-950/70 border border-violet-900/40 rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold text-violet-400 flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                Học Quan Sát Xã Hội Đa Tác Tử
                            </span>
                            <span className="text-[10px] font-mono text-violet-300 bg-violet-950/80 px-1.5 py-0.5 rounded border border-violet-800/50">
                                {socialEvents} sự kiện học hỏi
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div>
                                <span className="text-slate-400">Quan sát đối tượng:</span>
                                <div className="text-slate-200 font-semibold">{peerName}</div>
                            </div>
                            <div>
                                <span className="text-slate-400">Thưởng gián tiếp (Vicarious):</span>
                                <div className={`font-mono font-semibold ${lastSocialReward >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                    {lastSocialReward >= 0 ? `+${lastSocialReward}` : lastSocialReward}
                                </div>
                            </div>
                            <div>
                                <span className="text-slate-400">Khoảng cách bạn bè:</span>
                                <div className="font-mono text-slate-200 font-semibold">{peerDist.toFixed(1)}m</div>
                            </div>
                            <div>
                                <span className="text-slate-400">Đồng hành & Chia sẻ:</span>
                                <div className={`font-semibold ${nearPeer ? "text-emerald-400 font-bold" : "text-slate-400"}`}>
                                    {nearPeer ? "Đang gần nhau (<2.5m)" : "Đang dạo phố"}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. BỘ NHỚ TRẢI NGHIỆM ƯU TIÊN (PER) & VI MẠCH NƠ-RON */}
                    <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                                </svg>
                                Bộ Nhớ Trải Nghiệm Ưu Tiên (PER)
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                                {learner?.buffer_size ?? 0} / 5000 samples
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                            <div className="bg-slate-900/90 p-1.5 rounded border border-slate-800">
                                <span className="text-slate-400 block">TD-Loss:</span>
                                <span className="font-mono text-rose-400 font-bold">{learner?.latest_loss ?? 0.0}</span>
                            </div>
                            <div className="bg-slate-900/90 p-1.5 rounded border border-slate-800">
                                <span className="text-slate-400 block">Giá trị V(s):</span>
                                <span className="font-mono text-cyan-400 font-bold">{learner?.latest_value ?? 0.0}</span>
                            </div>
                            <div className="bg-slate-900/90 p-1.5 rounded border border-slate-800">
                                <span className="text-slate-400 block">Gradient Updates:</span>
                                <span className="font-mono text-emerald-400 font-bold">{learner?.total_online_updates ?? 0}</span>
                            </div>
                        </div>
                    </div>

                    {/* 4. GIẤC MỘNG TÁI HIỆN BAN ĐÊM (HIPPOCAMPAL SLEEP REPLAY) */}
                    <div className="bg-slate-950/70 border border-indigo-900/50 rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold text-indigo-400 flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                </svg>
                                Giấc Mộng Tái Hiện Ban Đêm (Sleep Replay)
                            </span>
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${isDreaming || isNight ? "bg-indigo-950 text-indigo-300 border-indigo-700 animate-pulse" : "bg-slate-900 text-slate-400 border-slate-800"}`}>
                                {isDreaming ? "Đang Mơ Củng Cố Nơ-ron" : isNight ? "Đêm Thành Phố" : "Đang Thức"}
                            </span>
                        </div>

                        <div className="text-[10px] space-y-1.5">
                            <div className="text-slate-300 italic bg-indigo-950/40 p-1.5 rounded border border-indigo-900/30">
                                {dreamState?.dream_topic || "Chưa có chủ đề giấc mơ gần đây..."}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <span className="text-slate-400">Số chu kỳ mộng (Cycles):</span>
                                    <div className="font-mono text-indigo-300 font-semibold">{dreamState?.dream_cycles ?? 0} đợt</div>
                                </div>
                                <div>
                                    <span className="text-slate-400">Độ linh hoạt xi-náp:</span>
                                    <div className="font-mono text-emerald-400 font-semibold">
                                        {((dreamState?.synaptic_plasticity_rate ?? 0.15) * 100).toFixed(0)}%
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Nút bấm Kích hoạt giấc mộng cưỡng bức */}
                        <button
                            onClick={handleForceDream}
                            disabled={isTriggeringDream}
                            className="mt-2.5 w-full py-1.5 px-2 bg-gradient-to-r from-indigo-800 to-violet-800 hover:from-indigo-700 hover:to-violet-700 text-white rounded text-xs font-semibold shadow flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                            {isTriggeringDream ? "Đang Tái Hiện Ký Ức..." : `Kích Hoạt Giấc Mộng Củng Cố Nơ-ron (${agentName})`}
                        </button>
                    </div>

                    {/* 5. ĐỒ THỊ TOPO GRAPH A* & NÉ TRÁNH XE CỘ ORCA */}
                    <div className="bg-slate-950/70 border border-emerald-900/50 rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                </svg>
                                Topo Graph A* & Né Tránh ORCA
                            </span>
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${cognitiveState?.is_traffic_avoiding ? "bg-amber-950 text-amber-300 border-amber-600 animate-pulse font-bold" : "bg-emerald-950/60 text-emerald-400 border-emerald-800"}`}>
                                {cognitiveState?.is_traffic_avoiding ? "NÉ TRÁNH XE CỘ (ORCA)" : "ĐƯỜNG THÔNG THOÁNG"}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px] mb-2">
                            <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                                <span className="text-slate-400 block">Lộ trình Waypoint:</span>
                                <span className="font-mono text-cyan-400 font-bold">
                                    {isBo ? (useTrainingStore.getState().boTopoPath?.length ?? 0) : (useTrainingStore.getState().biTopoPath?.length ?? 0)} mốc tiếp theo
                                </span>
                            </div>
                            <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                                <span className="text-slate-400 block">Xe cộ tuần tra:</span>
                                <span className="font-mono text-amber-400 font-bold">
                                    {useTrainingStore.getState().dynamicVehicles?.length ?? 0} xe đang chạy
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={useTrainingStore.getState().toggleTopoAndTraffic}
                            className="w-full py-1 px-2 rounded text-[11px] font-semibold border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition-all flex items-center justify-center gap-1.5"
                        >
                            <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            {useTrainingStore.getState().showTopoAndTraffic ? "Ẩn Đường Đồ Thị & Tuyến Xe" : "Hiện Đường Đồ Thị & Tuyến Xe"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
