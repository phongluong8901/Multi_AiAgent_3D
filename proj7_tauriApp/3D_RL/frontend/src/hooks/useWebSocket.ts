/**
 * ==============================================================================
 * HOOK KẾT NỐI VÀ ĐỒNG BỘ WEBSOCKET (REALTIME TELEMETRY HOOK)
 * ==============================================================================
 * Quản lý vòng đời kết nối WebSocket (ws://localhost:8000/api/ws):
 * - Tự động thiết lập kết nối khi ứng dụng khởi động.
 * - Tự động thử kết nối lại (Auto-reconnect) sau mỗi 2.5 giây nếu mất kết nối.
 * - Lắng nghe các loại sự kiện từ Backend:
 *   + 'state': Cập nhật toàn cảnh tọa độ, Kcal, tâm lý 2 bé, xe cộ, đồ thị Topo.
 *   + 'train_progress': Cập nhật % tiến độ và reward huấn luyện PPO.
 *   + 'bc_progress': Cập nhật % tiến độ và loss huấn luyện Behavioral Cloning.
 *   + 'bc_done', 'train_done', 'play_done': Báo hiệu hoàn tất tiến trình.
 * - Đăng ký hàm gửi tin nhắn 2 chiều `wsSend` vào Zustand store.
 */

import { useEffect, useRef } from "react";
import { useTrainingStore } from "../stores/useTrainingStore";

export function useWebSocket() {
    const {
        setStateFromWS,
        setTraining,
        setPlaying,
        setWsSend,
        addLog,
        setTrainProgress,
        setPolicyModeState,
    } = useTrainingStore();

    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        let isMounted = true;

        const connect = () => {
            if (!isMounted) return;

            try {
                const ws = new WebSocket("ws://localhost:8000/api/ws");
                wsRef.current = ws;

                ws.onopen = () => {
                    addLog("[THÀNH CÔNG] Đã kết nối với AI Engine (Python)");
                    // Đăng ký callback gửi dữ liệu qua WebSocket vào Zustand Store
                    setWsSend((payload: Record<string, unknown>) => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify(payload));
                        }
                    });
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);

                        if (data.type === "state") {
                            // Cập nhật toàn bộ trạng thái thế giới vào Store
                            setStateFromWS(data);
                        } else if (data.type === "train_progress") {
                            // Tiến độ huấn luyện PPO
                            setTrainProgress({
                                isTraining: true,
                                mode: "ppo",
                                step: Number(data.step || 0),
                                totalSteps: Number(data.total_steps || 10000),
                                pct: Number(data.pct || 0),
                                reward: Number(data.reward || 0),
                            });
                        } else if (data.type === "bc_progress") {
                            // Tiến độ huấn luyện Behavioral Cloning
                            setTrainProgress({
                                isTraining: true,
                                mode: "bc",
                                epoch: Number(data.epoch || 0),
                                totalEpochs: Number(data.total_epochs || 35),
                                pct: Number(data.pct || 0),
                                loss: Number(data.loss || 0),
                            });
                        } else if (data.type === "bc_done") {
                            // Hoàn tất huấn luyện BC
                            setTraining(false);
                            setPolicyModeState("bc");
                            setTrainProgress({ isTraining: false, pct: 100 });
                            addLog(data.message || "[THÀNH CÔNG] Huấn luyện Bắt Chước hoàn tất");
                        } else if (data.type === "train_done") {
                            // Hoàn tất huấn luyện PPO
                            setTraining(false);
                            setPolicyModeState("ppo");
                            setTrainProgress({ isTraining: false, pct: 100 });
                            addLog(data.message || "[THÀNH CÔNG] Dạy học PPO hoàn tất");
                        } else if (data.type === "play_done") {
                            // Hoàn tất lượt tự đi biểu diễn
                            setPlaying(false);
                            addLog("[THÔNG BÁO] Bé đã hoàn thành lượt tự đi");
                        }
                    } catch (err) {
                        console.error("[LỖI] Phân giải dữ liệu WebSocket thất bại", err);
                    }
                };

                ws.onclose = () => {
                    setWsSend(null);
                    if (isMounted) {
                        addLog("[KẾT NỐI] Đang thử kết nối lại AI Engine sau 2.5s...");
                        reconnectTimerRef.current = setTimeout(connect, 2500);
                    }
                };

                ws.onerror = () => {
                    setWsSend(null);
                };
            } catch (e) {
                if (isMounted) {
                    reconnectTimerRef.current = setTimeout(connect, 2500);
                }
            }
        };

        connect();

        return () => {
            isMounted = false;
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
            }
            setWsSend(null);
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [setStateFromWS, setTraining, setPlaying, setWsSend, addLog, setTrainProgress, setPolicyModeState]);
}
