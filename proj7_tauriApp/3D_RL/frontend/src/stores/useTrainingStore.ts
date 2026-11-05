import { create } from "zustand";
import type { RobotState, LogItem, EnergyState, DrivesState } from "../types";

interface TrainingStore {
    // Trạng thái Thế giới (World State 20x20)
    robot: number[];
    goal: number[];
    food: number[];
    water: number[];
    bed: number[];
    obstacles: number[][];
    step: number;
    reward: number;
    dist: number;
    collided: boolean;
    ateFood: boolean;
    drankWater: boolean;
    isResting: boolean;
    mode: "idle" | "train" | "play" | "teacher";

    // Hệ thống nội tại (Energy & Drives)
    energyState: EnergyState;
    drivesState: DrivesState;
    demoCount: number;

    // Giao diện & Điều khiển Teacher
    isTraining: boolean;
    isPlaying: boolean;
    isTeacherMode: boolean;
    isRecordingDemo: boolean;
    logs: LogItem[];
    wsSend: ((payload: Record<string, unknown>) => void) | null;

    // Các hàm tác vụ (Actions)
    setStateFromWS: (data: Partial<RobotState> & { type?: string }) => void;
    setTraining: (value: boolean) => void;
    setPlaying: (value: boolean) => void;
    setTeacherMode: (value: boolean) => void;
    setRecordingDemo: (value: boolean) => void;
    setWsSend: (fn: ((payload: Record<string, unknown>) => void) | null) => void;
    sendTeacherAction: (action: [number, number]) => void;
    addLog: (message: string) => void;
    clearLogs: () => void;
}

const DEFAULT_ENERGY: EnergyState = {
    energy: 800,
    energy_max: 1000,
    energy_ratio: 0.8,
    digesting: 0,
    fatigue: 0,
    alpha_motor: 1.0,
    alpha_cognitive: 1.0,
};

const DEFAULT_DRIVES: DrivesState = {
    drives: {
        hunger: 0.2,
        thirst: 0.15,
        fatigue: 0.1,
        pain: 0.0,
        fear: 0.0,
        curiosity: 0.55,
        comfort: 0.85,
    },
    urgencies: {
        pain: 0,
        fear: 0,
        thirst: 0.03,
        hunger: 0.05,
        fatigue: 0.01,
        curiosity: 0.44,
    },
    dominant_drive: "curiosity",
    survival_override: false,
};

export const useTrainingStore = create<TrainingStore>((set, get) => ({
    robot: [2.5, 2.5],
    goal: [17.0, 17.0],
    food: [3.0, 17.0],
    water: [17.0, 3.0],
    bed: [2.5, 2.5],
    obstacles: [
        [6.5, 6.5],
        [13.5, 6.5],
        [6.5, 13.5],
        [13.5, 13.5],
        [10.0, 4.5],
        [10.0, 15.5],
    ],
    step: 0,
    reward: 0,
    dist: 0,
    collided: false,
    ateFood: false,
    drankWater: false,
    isResting: false,
    mode: "idle",

    energyState: DEFAULT_ENERGY,
    drivesState: DEFAULT_DRIVES,
    demoCount: 0,

    isTraining: false,
    isPlaying: false,
    isTeacherMode: false,
    isRecordingDemo: true,
    logs: [],
    wsSend: null,

    setStateFromWS: (data) =>
        set((state) => ({
            robot: data.robot ?? state.robot,
            goal: data.goal ?? state.goal,
            food: data.food ?? state.food,
            water: data.water ?? state.water,
            bed: data.bed ?? state.bed,
            obstacles: data.obstacles ?? state.obstacles,
            step: data.step ?? state.step,
            reward: data.reward ?? state.reward,
            dist: data.dist ?? state.dist,
            collided: data.collided ?? state.collided,
            ateFood: data.ate_food ?? state.ateFood,
            drankWater: data.drank_water ?? state.drankWater,
            isResting: data.is_resting ?? state.isResting,
            mode: data.mode ?? state.mode,
            energyState: data.energy_state ?? state.energyState,
            drivesState: data.drives_state ?? state.drivesState,
            demoCount: data.demo_count ?? state.demoCount,
        })),

    setTraining: (value) =>
        set((state) => ({
            isTraining: value,
            isTeacherMode: value ? false : state.isTeacherMode,
        })),

    setPlaying: (value) =>
        set((state) => ({
            isPlaying: value,
            isTeacherMode: value ? false : state.isTeacherMode,
        })),

    setTeacherMode: (value) =>
        set({
            isTeacherMode: value,
            mode: value ? "teacher" : "idle",
        }),

    setRecordingDemo: (value) => set({ isRecordingDemo: value }),

    setWsSend: (fn) => set({ wsSend: fn }),

    sendTeacherAction: (action) => {
        const { wsSend, isRecordingDemo } = get();
        if (wsSend) {
            wsSend({
                type: "teacher_action",
                action,
                record: isRecordingDemo,
            });
        }
    },

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
