import { useEffect } from "react";
import { useTrainingStore } from "../stores/useTrainingStore";

export function useWebSocket() {
    const { setStateFromWS, setTraining, setPlaying, setWsSend, addLog } =
        useTrainingStore();

    useEffect(() => {
        const ws = new WebSocket("ws://localhost:8000/api/ws");

        ws.onopen = () => {
            addLog("[THÀNH CÔNG] Đã kết nối với AI Engine (Python)");
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
                    setStateFromWS(data);
                }

                if (data.type === "train_done") {
                    setTraining(false);
                    addLog(data.message || "[THÀNH CÔNG] Dạy học PPO hoàn tất");
                }

                if (data.type === "play_done") {
                    setPlaying(false);
                    addLog("[THÔNG BÁO] Bé đã hoàn thành lượt tự đi");
                }
            } catch (err) {
                console.error("[LỖI] Phân giải dữ liệu WebSocket thất bại", err);
            }
        };

        ws.onclose = () => {
            setWsSend(null);
            addLog("[CẢNH BÁO] Đã ngắt kết nối WebSocket tới server");
        };

        ws.onerror = () => {
            addLog("[LỖI] Không thể kết nối tới server Python (ws://localhost:8000/api/ws)");
        };

        return () => {
            setWsSend(null);
            ws.close();
        };
    }, []);
}
