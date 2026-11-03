import { useEffect } from "react";
import { useTrainingStore } from "../stores/useTrainingStore";

export function useWebSocket() {
    const { setStateFromWS, setTraining, setPlaying, addLog } = useTrainingStore();

    useEffect(() => {
        const ws = new WebSocket("ws://localhost:8000/api/ws");

        ws.onopen = () => {
            addLog("WebSocket connected");
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === "state") {
                    setStateFromWS(data);
                }

                if (data.type === "train_done") {
                    setTraining(false);
                    addLog(data.message || "Training finished");
                }

                if (data.type === "play_done") {
                    setPlaying(false);
                    addLog("Play finished");
                }
            } catch (err) {
                console.error("WS parse error", err);
            }
        };

        ws.onclose = () => {
            addLog("WebSocket disconnected");
        };

        ws.onerror = () => {
            addLog("WebSocket error");
        };

        return () => {
            ws.close();
        };
    }, []);
}