import { create } from 'zustand';
import type { SystemSnapshot, ProcessInfo } from '../types/compute';

interface ConsoleLog {
    id: string;
    time: string;
    type: 'INFO' | 'ACTION' | 'ALERT' | 'STREAM' | 'CONFIG';
    level?: string;
    message: string;
}

interface TelemetryState {
    connected: boolean;
    snapshot: SystemSnapshot | null;
    logs: ConsoleLog[];
    cpuHistory: number[];
    ramHistory: number[];
    gpuHistory: number[];
    processLookup: Record<number, ProcessInfo>;
    processHistory: Record<number, number[]>;
    setConnected: (status: boolean) => void;
    setSnapshot: (data: SystemSnapshot) => void;
    addLog: (type: ConsoleLog['type'], message: string) => void;
    clearLogs: () => void;
}

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
