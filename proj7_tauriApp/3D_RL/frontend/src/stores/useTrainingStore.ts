import { create } from "zustand";
import type { RobotState, LogItem } from "../types";

interface TrainingStore {
    // State từ backend
    robot: number[];
    goal: number[];
    obstacles: number[][];
    step: number;
    reward: number;
    dist: number;
    collided: boolean;
    mode: "idle" | "train" | "play";

    // UI state
    isTraining: boolean;
    isPlaying: boolean;
    logs: LogItem[];

    // Actions
    setStateFromWS: (data: Partial<RobotState> & { type?: string }) => void;
    setTraining: (value: boolean) => void;
    setPlaying: (value: boolean) => void;
    addLog: (message: string) => void;
    clearLogs: () => void;
}

export const useTrainingStore = create<TrainingStore>((set) => ({
    robot: [1.2, 1.2],
    goal: [8.8, 8.8],
    obstacles: [
        [3.0, 3.5],
        [6.5, 2.5],
        [4.0, 7.0],
        [7.5, 6.5],
    ],
    step: 0,
    reward: 0,
    dist: 0,
    collided: false,
    mode: "idle",

    isTraining: false,
    isPlaying: false,
    logs: [],

    setStateFromWS: (data) =>
        set((state) => ({
            robot: data.robot ?? state.robot,
            goal: data.goal ?? state.goal,
            obstacles: data.obstacles ?? state.obstacles,
            step: data.step ?? state.step,
            reward: data.reward ?? state.reward,
            dist: data.dist ?? state.dist,
            collided: data.collided ?? state.collided,
            mode: (data.mode as any) ?? state.mode,
        })),

    setTraining: (value) => set({ isTraining: value }),
    setPlaying: (value) => set({ isPlaying: value }),

    addLog: (message) =>
        set((state) => ({
            logs: [
                ...state.logs.slice(-80),
                {
                    time: new Date().toLocaleTimeString(),
                    message,
                },
            ],
        })),

    clearLogs: () => set({ logs: [] }),
}));
