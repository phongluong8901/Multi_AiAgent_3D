/**
 * Trình quản lý kết nối WebSocket đo lường từ xa (Realtime Telemetry Socket Manager).
 * Tự động kết nối tới FastAPI Backend, phân tích gói tin JSON trạng thái phần cứng,
 * cập nhật vào Zustand Store và tự động thử kết nối lại (auto-reconnect) khi rớt mạng.
 */

import { useTelemetryStore } from '../stores/useTelemetryStore';

// Địa chỉ WebSocket endpoint mặc định
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:14200/ws/telemetry';

class TelemetrySocketManager {
    /** Thực thể WebSocket hiện tại */
    private ws: WebSocket | null = null;
    /** Bộ định thời cho việc tự động kết nối lại */
    private reconnectTimer: number | null = null;

    /**
     * Khởi tạo kết nối WebSocket với máy chủ nếu chưa kết nối.
     */
    connect() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        this.ws = new WebSocket(WS_URL);

        // Sự kiện khi kết nối thành công
        this.ws.onopen = () => {
            useTelemetryStore.getState().setConnected(true);
            useTelemetryStore.getState().addLog('INFO', `Connected to FastAPI Telemetry Stream (${WS_URL})`);
        };

        // Sự kiện khi nhận được gói tin telemetry định kỳ từ backend
        this.ws.onmessage = (event) => {
            try {
                const snapshot = JSON.parse(event.data);
                useTelemetryStore.getState().setSnapshot(snapshot);
            } catch (err) {
                console.error('Failed to parse telemetry JSON', err);
            }
        };

        // Sự kiện khi kết nối bị gián đoạn
        this.ws.onclose = () => {
            useTelemetryStore.getState().setConnected(false);
            this.scheduleReconnect();
        };

        // Sự kiện xảy ra lỗi kết nối
        this.ws.onerror = () => {
            this.ws?.close();
        };
    }

    /**
     * Lên lịch hẹn thử kết nối lại sau 2.5 giây khi mất kết nối mạng.
     */
    private scheduleReconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = window.setTimeout(() => {
            this.connect();
        }, 2500);
    }

    /**
     * Chủ động đóng ngắt kết nối WebSocket và hủy các bộ hẹn giờ chạy ngầm.
     */
    disconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.ws?.close();
    }
}

/** Thực thể Singleton quản lý kết nối socket trong toàn ứng dụng */
export const socketClient = new TelemetrySocketManager();
