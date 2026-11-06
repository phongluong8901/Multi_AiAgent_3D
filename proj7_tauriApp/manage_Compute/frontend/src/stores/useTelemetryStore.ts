/**
 * Kho lưu trữ Zustand quản lý trạng thái Telemetry và dữ liệu chuỗi thời gian (Time-series data).
 * Lưu trữ lịch sử tải CPU, RAM, GPU, danh sách tiến trình và nhật ký hoạt động trên giao diện điều khiển.
 */

import { create } from 'zustand';
import type { SystemSnapshot, ProcessInfo } from '../types/compute';

/**
 * Bản ghi nhật ký hiển thị trên khung điều khiển phía dưới (Bottom Console).
 */
interface ConsoleLog {
    /** Mã định danh duy nhất của dòng log */
    id: string;
    /** Thời gian ghi nhận nhật ký (định dạng HH:mm:ss) */
    time: string;
    /** Loại thông điệp nhật ký: INFO, ACTION, ALERT, STREAM, CONFIG */
    type: 'INFO' | 'ACTION' | 'ALERT' | 'STREAM' | 'CONFIG';
    /** Mức độ cảnh báo */
    level?: string;
    /** Nội dung thông điệp chi tiết */
    message: string;
}

/**
 * Cấu trúc trạng thái Telemetry State của ứng dụng.
 */
interface TelemetryState {
    /** Trạng thái kết nối WebSocket với backend */
    connected: boolean;
    /** Bản chụp tài nguyên hệ thống mới nhất nhận từ WebSocket */
    snapshot: SystemSnapshot | null;
    /** Danh sách nhật ký console */
    logs: ConsoleLog[];
    /** Chuỗi giá trị phần trăm tải CPU theo thời gian (Sparkline) */
    cpuHistory: number[];
    /** Chuỗi giá trị phần trăm sử dụng RAM theo thời gian */
    ramHistory: number[];
    /** Chuỗi giá trị phần trăm tải GPU theo thời gian */
    gpuHistory: number[];
    /** Bảng tra cứu thông tin tiến trình theo PID */
    processLookup: Record<number, ProcessInfo>;
    /** Lịch sử tải CPU của từng tiến trình theo PID */
    processHistory: Record<number, number[]>;
    /** Cập nhật cờ trạng thái kết nối mạng WebSocket */
    setConnected: (status: boolean) => void;
    /** Cập nhật snapshot mới và tính toán dịch chuyển mảng chuỗi thời gian */
    setSnapshot: (data: SystemSnapshot) => void;
    /** Thêm một dòng nhật ký vào bảng điều khiển */
    addLog: (type: ConsoleLog['type'], message: string) => void;
    /** Xóa sạch toàn bộ nhật ký console */
    clearLogs: () => void;
}

// Số lượng mẫu đo tối đa lưu trữ trong lịch sử Sparkline
const MAX_HISTORY = 30;

export const useTelemetryStore = create<TelemetryState>((set) => ({
    connected: false,
    snapshot: null,
    logs: [
        {
            id: 'init-1',
            time: new Date().toLocaleTimeString(),
            type: 'INFO',
            message: 'Compute Studio Workbench initialized. Waiting for Python engine...',
        },
    ],
    cpuHistory: Array(MAX_HISTORY).fill(0),
    ramHistory: Array(MAX_HISTORY).fill(0),
    gpuHistory: Array(MAX_HISTORY).fill(0),
    processLookup: {},
    processHistory: {},

    setConnected: (connected) => set({ connected }),

    setSnapshot: (snapshot) =>
        set((state) => {
            // Đẩy giá trị mới vào cuối mảng và loại bỏ giá trị cũ nhất ở đầu
            const nextCpu = [...state.cpuHistory.slice(1), snapshot.cpu.percent];
            const nextRam = [...state.ramHistory.slice(1), snapshot.ram.percent];
            const nextGpu = [...state.gpuHistory.slice(1), snapshot.gpus?.[0]?.load_percent ?? 0];

            const nextLookup = { ...state.processLookup };
            const nextProcHistory = { ...state.processHistory };

            if (snapshot.processes && Array.isArray(snapshot.processes)) {
                for (const p of snapshot.processes) {
                    nextLookup[p.pid] = p;
                    const prev = nextProcHistory[p.pid] || Array(15).fill(0);
                    nextProcHistory[p.pid] = [...prev.slice(1), p.cpu_percent];
                }
            }

            return {
                snapshot,
                cpuHistory: nextCpu,
                ramHistory: nextRam,
                gpuHistory: nextGpu,
                processLookup: nextLookup,
                processHistory: nextProcHistory,
            };
        }),

    addLog: (type, message) =>
        set((state) => ({
            logs: [
                ...state.logs.slice(-99),
                {
                    id: Math.random().toString(36).substring(2, 9),
                    time: new Date().toLocaleTimeString(),
                    type,
                    level: type,
                    message,
                },
            ],
        })),

    clearLogs: () => set({ logs: [] }),
}));
