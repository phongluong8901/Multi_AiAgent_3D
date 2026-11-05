export interface EnergyState {
    energy: number;
    energy_max: number;
    energy_ratio: number;
    digesting: number;
    fatigue: number;
    alpha_motor: number;
    alpha_cognitive: number;
}

export interface DrivesMap {
    hunger: number;
    thirst: number;
    fatigue: number;
    pain: number;
    fear: number;
    curiosity: number;
    comfort: number;
}

export interface DrivesState {
    drives: DrivesMap;
    urgencies: Record<string, number>;
    dominant_drive: string;
    survival_override: boolean;
}

export interface RobotState {
    robot: number[];
    goal: number[];
    food?: number[];
    water?: number[];
    bed?: number[];
    obstacles: number[][];
    step: number;
    reward: number;
    dist: number;
    collided: boolean;
    ate_food?: boolean;
    drank_water?: boolean;
    is_resting?: boolean;
    mode?: "idle" | "train" | "play" | "teacher";
    energy_state?: EnergyState;
    drives_state?: DrivesState;
    demo_count?: number;
}

export interface LogItem {
    time: string;
    message: string;
}
