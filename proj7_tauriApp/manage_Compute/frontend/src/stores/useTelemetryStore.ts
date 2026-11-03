import { create } from 'zustand';
import type { SystemSnapshot } from '../types/compute';

interface ConsoleLog {
    id: string;
    time: string;
    type: 'INFO' | 'ACTION' | 'ALERT' | 'STREAM';
    message: string;
}

interface TelemetryState {
    connected: boolean;
    snapshot: SystemSnapshot | null;
    logs: ConsoleLog[];
    setConnected: (status: boolean) => void;
    setSnapshot: (data: SystemSnapshot) => void;
    addLog: (type: ConsoleLog['type'], message: string) => void;
    clearLogs: () => void;
}

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
    setConnected: (connected) => set({ connected }),
    setSnapshot: (snapshot) => set({ snapshot }),
    addLog: (type, message) =>
        set((state) => ({
            logs: [
                ...state.logs.slice(-99),
                {
                    id: Math.random().toString(36).substring(2, 9),
                    time: new Date().toLocaleTimeString(),
                    type,
                    message,
                },
            ],
        })),
    clearLogs: () => set({ logs: [] }),
}));