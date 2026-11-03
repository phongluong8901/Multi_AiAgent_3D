import { useTelemetryStore } from '../stores/useTelemetryStore';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:14200/ws/telemetry';

class TelemetrySocketManager {
    private ws: WebSocket | null = null;
    private reconnectTimer: number | null = null;

    connect() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        this.ws = new WebSocket(WS_URL);

        this.ws.onopen = () => {
            useTelemetryStore.getState().setConnected(true);
            useTelemetryStore.getState().addLog('INFO', `Connected to FastAPI Telemetry Stream (${WS_URL})`);
        };

        this.ws.onmessage = (event) => {
            try {
                const snapshot = JSON.parse(event.data);
                useTelemetryStore.getState().setSnapshot(snapshot);
            } catch (err) {
                console.error('Failed to parse telemetry JSON', err);
            }
        };

        this.ws.onclose = () => {
            useTelemetryStore.getState().setConnected(false);
            this.scheduleReconnect();
        };

        this.ws.onerror = () => {
            this.ws?.close();
        };
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = window.setTimeout(() => {
            this.connect();
        }, 2500);
    }

    disconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.ws?.close();
    }
}

export const socketClient = new TelemetrySocketManager();