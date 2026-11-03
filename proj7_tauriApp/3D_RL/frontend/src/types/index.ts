export interface RobotState {
    robot: number[];
    goal: number[];
    obstacles: number[][];
    step: number;
    reward: number;
    dist: number;
    collided: boolean;
    mode?: "train" | "play";
}

export interface LogItem {
    time: string;
    message: string;
}