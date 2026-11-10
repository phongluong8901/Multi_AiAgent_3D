/**
 * ==============================================================================
 * KHO LƯU TRỮ TRẠNG THÁI TOÀN CỤC (ZUSTAND CENTRAL STORE)
 * ==============================================================================
 * Quản lý toàn bộ trạng thái đồng bộ giữa Frontend React và Backend Python:
 * - Trạng thái Thế giới: Tọa độ Bé Bo [x, z], Bé Bi [x, z], khoảng cách, mục tiêu.
 * - Các khu vực: Bếp ăn, Vòi nước, Giường Villa, Công viên, Hồ bơi, Lò lửa, Xe cộ.
 * - Trạng thái Thể chất & Động lực: Năng lượng Kcal, Mệt mỏi, Đói, Khát, Tò mò, Xã hội.
 * - Bản đồ Nhận thức: % Khám phá sương mù, Ký ức sự kiện, Vi mạch nơ-ron tự học.
 * - Tiến trình Huấn luyện & Biểu diễn: PPO, BC, Telemetry, Tốc độ mô phỏng.
 * - Hành động Tương tác (Actions): Lái WASD, Khen/Phạt, Click đặt mục tiêu 3D.
 */

import { create } from "zustand";
import type {
    RobotState,
    LogItem,
    EnergyState,
    DrivesState,
    CognitiveState,
    CognitiveStats,
    TrainProgress,
    AgentId,
    CameraMode,
    DayPhase,
    DynamicVehicle,
    TopoNode,
} from "../types";

export interface TrainingStore {
    // Trạng thái Thế giới (World State 100x100)
    robot: number[];       // Bé Bo [x, z]
    robot2: number[];      // Bé Bi [x, z]
    peerDist: number;      // Khoảng cách giữa Bo và Bi
    nearPeer: boolean;     // Hai bé đang ở gần nhau (< 2.5m)

    // Các khu vực thế giới
    goal: number[];
    food: number[];
    water: number[];
    bed: number[];
    play: number[];
    pool: number[];
    park: number[];
    obstacles: number[][];
    cityObstacles: number[][];
    cityObstacleRadii: number[];
    foodCapacity: number;
    waterCapacity: number;
    foodTimeLeft: number;
    waterTimeLeft: number;
    foodMaxTime: number;
    waterMaxTime: number;
    depletedSpots: { type: string; pos: number[]; step?: number }[];
    raceStats: {
        bo_wins: number;
        bi_wins: number;
        bo_food_wins: number;
        bi_food_wins: number;
        bo_water_wins: number;
        bi_water_wins: number;
        total_contests: number;
        last_winner?: string | null;
    };
    isRacing: boolean;
    worldSize: number;

    // Chu kỳ Ngày / Đêm sinh học đô thị
    timeOfDay: number;
    isNight: boolean;
    dayPhase: DayPhase;

    // Xe cộ giao thông động & Đồ thị Topo Graph A*
    dynamicVehicles: DynamicVehicle[];
    boTopoPath: number[][];
    biTopoPath: number[][];
    topoNodes: TopoNode[];
    showTopoAndTraffic: boolean;
    toggleTopoAndTraffic: () => void;

    // Chế độ Camera POV (Toàn cảnh / Theo chân Bé Bo / Theo chân Bé Bi)
    cameraMode: CameraMode;

    step: number;
    reward: number;
    dist: number;

    // Trạng thái Bé Bo (Agent 1)
    collided: boolean;
    ateFood: boolean;
    drankWater: boolean;
    isResting: boolean;
    energyState: EnergyState;
    drivesState: DrivesState;
    cognitiveState: CognitiveState;
    currentThought: string;
    currentGoalName: string;
    currentGoalPos: number[];

    // Trạng thái Bé Bi (Agent 2)
    collided2: boolean;
    ateFood2: boolean;
    drankWater2: boolean;
    isResting2: boolean;
    energyState2: EnergyState;
    drivesState2: DrivesState;
    cognitiveState2: CognitiveState;
    currentThought2: string;
    currentGoalName2: string;
    currentGoalPos2: number[];

    // Chế độ xem & Tương tác
    selectedAgent: AgentId;
    mode: "idle" | "train" | "play" | "teacher" | "autonomous" | "teacher_order";
    demoCount: number;
    isAutonomousLife: boolean;
    simulationSpeed: number;
    customMarkerPos: [number, number] | null;
    policyMode: "heuristic" | "bc" | "ppo" | "online_rl";
    hasBcModel: boolean;

    // Tiến trình huấn luyện trực quan (Telemetry)
    trainProgress: TrainProgress;

    // Giao diện & Điều khiển Teacher
    isTraining: boolean;
    isPlaying: boolean;
    isTeacherMode: boolean;
    isRecordingDemo: boolean;
    logs: LogItem[];
    wsSend: ((payload: Record<string, unknown>) => void) | null;

    // Các hàm tác vụ (Actions)
    setSelectedAgent: (agent: AgentId) => void;
    setCameraMode: (mode: CameraMode) => void;
    setStateFromWS: (data: Partial<RobotState> & { type?: string }) => void;
    setTraining: (value: boolean) => void;
    setPlaying: (value: boolean) => void;
    setTeacherMode: (value: boolean) => void;
    setRecordingDemo: (value: boolean) => void;
    setPolicyModeState: (mode: "heuristic" | "bc" | "ppo" | "online_rl") => void;
    setTrainProgress: (p: Partial<TrainProgress>) => void;
    setWsSend: (fn: ((payload: Record<string, unknown>) => void) | null) => void;
    sendTeacherAction: (action: [number, number]) => void;
    sendTeacherFeedback: (praise: boolean) => void;
    sendClickTarget: (x: number, z: number, label?: string) => void;
    toggleAutonomy: (active?: boolean) => void;
    setSpeed: (speed: number) => void;
    triggerDream: (target?: string) => Promise<void>;
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

const DEFAULT_ENERGY_2: EnergyState = {
    energy: 820,
    energy_max: 1000,
    energy_ratio: 0.82,
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
        social: 0.3,
    },
    urgencies: {
        pain: 0,
        fear: 0,
        thirst: 0.03,
        hunger: 0.05,
        fatigue: 0.01,
        social: 0.12,
        curiosity: 0.44,
    },
    dominant_drive: "curiosity",
    survival_override: false,
};

const DEFAULT_DRIVES_2: DrivesState = {
    drives: {
        hunger: 0.18,
        thirst: 0.12,
        fatigue: 0.08,
        pain: 0.0,
        fear: 0.0,
        curiosity: 0.5,
        comfort: 0.9,
        social: 0.35,
    },
    urgencies: {
        pain: 0,
        fear: 0,
        thirst: 0.02,
        hunger: 0.04,
        fatigue: 0.01,
        social: 0.15,
        curiosity: 0.4,
    },
    dominant_drive: "social",
    survival_override: false,
};

const DEFAULT_STATS: CognitiveStats = {
    meals_eaten: 0,
    water_drank: 0,
    naps_taken: 0,
    praises: 0,
    scoldings: 0,
    collisions: 0,
    social_chats: 0,
};

const DEFAULT_COGNITIVE: CognitiveState = {
    name: "Bé Bo",
    personality: "energetic",
    is_autonomous: true,
    current_goal_name: "Tự do khám phá",
    current_goal_pos: [10.0, 10.0],
    current_thought: "Mình đang tò mò quan sát thế giới xung quanh...",
    has_custom_target: false,
    custom_target: null,
    stats: DEFAULT_STATS,
};

const DEFAULT_COGNITIVE_2: CognitiveState = {
    name: "Bé Bi",
    personality: "cautious_empathic",
    is_autonomous: true,
    current_goal_name: "Tìm bạn Bo",
    current_goal_pos: [2.5, 2.5],
    current_thought: "Chào bạn Bo! Chúng mình cùng nhau học tập và sinh hoạt nhé...",
    has_custom_target: false,
    custom_target: null,
    stats: { ...DEFAULT_STATS },
};

const DEFAULT_TRAIN_PROGRESS: TrainProgress = {
    isTraining: false,
    mode: null,
    step: 0,
    totalSteps: 10000,
    pct: 0,
    reward: 0,
    loss: 0,
    epoch: 0,
    totalEpochs: 35,
};

export const useTrainingStore = create<TrainingStore>((set, get) => ({
    robot: [14.0, 20.0],
    robot2: [70.0, 70.0],
    peerDist: 75.0,
    nearPeer: false,

    goal: [50.0, 50.0],
    food: [74.0, 58.0],
    water: [68.0, 14.0],
    bed: [12.0, 12.0],
    play: [12.0, 90.0],
    pool: [72.0, 14.0],
    park: [14.0, 78.0],
    obstacles: [
        [12.0, 12.0], [24.0, 10.0], [10.0, 24.0], [24.0, 24.0],
        [50.0, 12.0], [38.0, 24.0], [62.0, 24.0], [72.0, 14.0],
        [86.0, 10.0], [78.0, 26.0], [90.0, 24.0], [12.0, 50.0],
        [50.0, 50.0], [40.0, 40.0], [60.0, 40.0], [74.0, 40.0],
    ],
    cityObstacles: [
        [12.0, 12.0], [24.0, 10.0], [10.0, 24.0], [24.0, 24.0],
        [50.0, 12.0], [38.0, 24.0], [62.0, 24.0], [72.0, 14.0],
        [86.0, 10.0], [78.0, 26.0], [90.0, 24.0], [12.0, 50.0],
        [50.0, 50.0], [40.0, 40.0], [60.0, 40.0], [74.0, 40.0],
    ],
    cityObstacleRadii: [3.6, 2.8, 2.8, 3.2, 3.0, 3.2, 3.2, 4.2, 3.8, 2.2, 2.8, 3.8, 3.2, 3.8, 3.8, 4.2],
    foodCapacity: 100.0,
    waterCapacity: 100.0,
    foodTimeLeft: 75.0,
    waterTimeLeft: 90.0,
    foodMaxTime: 75.0,
    waterMaxTime: 90.0,
    depletedSpots: [],
    raceStats: {
        bo_wins: 0,
        bi_wins: 0,
        bo_food_wins: 0,
        bi_food_wins: 0,
        bo_water_wins: 0,
        bi_water_wins: 0,
        total_contests: 0,
        last_winner: null,
    },
    isRacing: false,
    worldSize: 100.0,
    timeOfDay: 8.5,
    isNight: false,
    dayPhase: "day",
    cameraMode: "overview",
    step: 0,
    reward: 0,
    dist: 0,

    // Bé Bo
    collided: false,
    ateFood: false,
    drankWater: false,
    isResting: false,
    energyState: DEFAULT_ENERGY,
    drivesState: DEFAULT_DRIVES,
    cognitiveState: DEFAULT_COGNITIVE,
    currentThought: "Chào bạn Bi! Chúng mình cùng khám phá thế giới nhé.",
    currentGoalName: "Tự do khám phá",
    currentGoalPos: [10.0, 10.0],

    // Bé Bi
    collided2: false,
    ateFood2: false,
    drankWater2: false,
    isResting2: false,
    energyState2: DEFAULT_ENERGY_2,
    drivesState2: DEFAULT_DRIVES_2,
    cognitiveState2: DEFAULT_COGNITIVE_2,
    currentThought2: "Chào Bo! Cẩn thận lò lửa nóng bên đường nhé.",
    currentGoalName2: "Đi dạo cùng Bo",
    currentGoalPos2: [3.0, 3.0],

    selectedAgent: "bo",
    mode: "autonomous",
    demoCount: 0,
    isAutonomousLife: true,
    simulationSpeed: 1.0,
    customMarkerPos: null,
    policyMode: "online_rl",
    hasBcModel: false,

    // Xe cộ động & Topo Graph A*
    dynamicVehicles: [],
    boTopoPath: [],
    biTopoPath: [],
    topoNodes: [],
    showTopoAndTraffic: true,
    toggleTopoAndTraffic: () => set((s) => ({ showTopoAndTraffic: !s.showTopoAndTraffic })),

    trainProgress: DEFAULT_TRAIN_PROGRESS,

    isTraining: false,
    isPlaying: false,
    isTeacherMode: false,
    isRecordingDemo: false,
    logs: [],
    wsSend: null,

    setSelectedAgent: (agent) => set({ selectedAgent: agent }),
    setCameraMode: (mode) => set({ cameraMode: mode }),

    setStateFromWS: (data) =>
        set((state) => {
            const cog1 = data.cognitive_state ?? state.cognitiveState;
            const cog2 = data.cognitive_state2 ?? state.cognitiveState2;
            const customPos =
                cog1 && cog1.custom_target && cog1.custom_target.length === 2
                    ? ([cog1.custom_target[0], cog1.custom_target[1]] as [number, number])
                    : state.customMarkerPos;

            return {
                robot: data.robot ?? state.robot,
                robot2: data.robot2 ?? state.robot2,
                peerDist: data.peer_dist !== undefined ? data.peer_dist : state.peerDist,
                nearPeer: data.near_peer !== undefined ? data.near_peer : state.nearPeer,

                goal: data.goal ?? state.goal,
                food: data.food ?? state.food,
                water: data.water ?? state.water,
                bed: data.bed ?? state.bed,
                play: data.play ?? state.play,
                pool: data.pool ?? state.pool,
                park: data.park ?? state.park,
                obstacles: data.obstacles ?? state.obstacles,
                cityObstacles: data.city_obstacles ?? state.cityObstacles,
                cityObstacleRadii: data.city_obstacle_radii ?? state.cityObstacleRadii,
                foodCapacity: data.food_capacity !== undefined ? data.food_capacity : state.foodCapacity,
                waterCapacity: data.water_capacity !== undefined ? data.water_capacity : state.waterCapacity,
                foodTimeLeft: data.food_time_left !== undefined ? data.food_time_left : state.foodTimeLeft,
                waterTimeLeft: data.water_time_left !== undefined ? data.water_time_left : state.waterTimeLeft,
                foodMaxTime: data.food_max_time !== undefined ? data.food_max_time : state.foodMaxTime,
                waterMaxTime: data.water_max_time !== undefined ? data.water_max_time : state.waterMaxTime,
                depletedSpots: data.depleted_spots ?? state.depletedSpots,
                raceStats: data.race_stats ?? state.raceStats,
                isRacing: data.is_racing !== undefined ? data.is_racing : state.isRacing,
                worldSize: data.world_size !== undefined ? data.world_size : state.worldSize,
                timeOfDay: data.time_of_day !== undefined ? data.time_of_day : state.timeOfDay,
                isNight: data.is_night !== undefined ? data.is_night : state.isNight,
                dayPhase: data.day_phase ?? state.dayPhase,
                step: data.step ?? state.step,
                reward: data.reward ?? state.reward,
                dist: data.dist ?? state.dist,

                // Bé Bo
                collided: data.collided ?? state.collided,
                ateFood: data.ate_food ?? state.ateFood,
                drankWater: data.drank_water ?? state.drankWater,
                isResting: data.is_resting ?? state.isResting,
                energyState: data.energy_state ?? state.energyState,
                drivesState: data.drives_state ?? state.drivesState,
                cognitiveState: cog1,
                currentThought: data.current_thought ?? cog1.current_thought ?? state.currentThought,
                currentGoalName: data.current_goal_name ?? cog1.current_goal_name ?? state.currentGoalName,
                currentGoalPos: data.current_goal_pos ?? cog1.current_goal_pos ?? state.currentGoalPos,

                // Bé Bi
                collided2: data.collided2 !== undefined ? data.collided2 : state.collided2,
                ateFood2: data.ate_food2 !== undefined ? data.ate_food2 : state.ateFood2,
                drankWater2: data.drank_water2 !== undefined ? data.drank_water2 : state.drankWater2,
                isResting2: data.is_resting2 !== undefined ? data.is_resting2 : state.isResting2,
                energyState2: data.energy_state2 ?? state.energyState2,
                drivesState2: data.drives_state2 ?? state.drivesState2,
                cognitiveState2: cog2,
                currentThought2: data.current_thought2 ?? cog2.current_thought ?? state.currentThought2,
                currentGoalName2: data.current_goal_name2 ?? cog2.current_goal_name ?? state.currentGoalName2,
                currentGoalPos2: data.current_goal_pos2 ?? cog2.current_goal_pos ?? state.currentGoalPos2,

                mode: data.mode ?? state.mode,
                demoCount: data.demo_count ?? state.demoCount,
                isAutonomousLife:
                    data.is_autonomous_life !== undefined
                        ? data.is_autonomous_life
                        : state.isAutonomousLife,
                simulationSpeed: data.simulation_speed ?? state.simulationSpeed,
                policyMode: data.policy_mode ?? state.policyMode,
                hasBcModel: data.has_bc_model !== undefined ? data.has_bc_model : state.hasBcModel,
                customMarkerPos: cog1.has_custom_target ? customPos : null,
                dynamicVehicles: data.dynamic_vehicles ?? state.dynamicVehicles,
                boTopoPath: data.bo_topo_path ?? state.boTopoPath,
                biTopoPath: data.bi_topo_path ?? state.biTopoPath,
                topoNodes: data.topo_nodes ?? state.topoNodes,
            };
        }),

    setTraining: (value) =>
        set((state) => ({
            isTraining: value,
            isTeacherMode: value ? false : state.isTeacherMode,
            isAutonomousLife: value ? false : state.isAutonomousLife,
            trainProgress: {
                ...state.trainProgress,
                isTraining: value,
            },
        })),

    setPlaying: (value) =>
        set((state) => ({
            isPlaying: value,
            isTeacherMode: value ? false : state.isTeacherMode,
            isAutonomousLife: value ? false : state.isAutonomousLife,
        })),

    setTeacherMode: (value) =>
        set((state) => ({
            isTeacherMode: value,
            isAutonomousLife: value ? false : state.isAutonomousLife,
            mode: value ? "teacher" : state.isAutonomousLife ? "autonomous" : "idle",
        })),

    setRecordingDemo: (value) => set({ isRecordingDemo: value }),

    setPolicyModeState: (mode) => set({ policyMode: mode }),

    setTrainProgress: (p) =>
        set((state) => ({
            trainProgress: {
                ...state.trainProgress,
                ...p,
            },
        })),

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

    sendTeacherFeedback: (praise) => {
        const { wsSend, addLog, selectedAgent } = get();
        if (wsSend) {
            wsSend({
                type: "teacher_feedback",
                praise,
                target: selectedAgent,
            });
        }
        const name = selectedAgent === "bo" ? "Bé Bo" : "Bé Bi";
        addLog(
            praise
                ? `[KHEN THƯỞNG] Người hướng dẫn khen ngợi ${name}! (+5 điểm củng cố)`
                : `[NHẮC NHỞ] Người hướng dẫn uốn nắn hành vi của ${name} (-8 điểm)`
        );
    },

    sendClickTarget: (x, z, label = "Điểm chỉ định trên sàn 3D") => {
        const { wsSend, addLog, selectedAgent } = get();
        set({ customMarkerPos: [x, z] });
        if (wsSend) {
            wsSend({
                type: "set_target",
                x,
                z,
                label,
                target: selectedAgent,
            });
        }
        const name = selectedAgent === "bo" ? "Bé Bo" : "Bé Bi";
        addLog(`[MỤC TIÊU MỚI] Chỉ dẫn ${name} đến tọa độ [${x.toFixed(1)}, ${z.toFixed(1)}]`);
    },

    toggleAutonomy: (active) => {
        const { wsSend, isAutonomousLife, addLog } = get();
        const nextActive = active !== undefined ? active : !isAutonomousLife;
        set({ isAutonomousLife: nextActive });
        if (wsSend) {
            wsSend({
                type: "toggle_autonomy",
                active: nextActive,
            });
        }
        addLog(
            nextActive
                ? "[CHẾ ĐỘ] Đã BẬT Cuộc sống tự hành cho hai bé (Bo & Bi)"
                : "[CHẾ ĐỘ] Đã TẮT Tự hành (Cả hai bé dừng chuyển động)"
        );
    },

    setSpeed: (speed) => {
        const { wsSend, addLog } = get();
        set({ simulationSpeed: speed });
        if (wsSend) {
            wsSend({
                type: "set_speed",
                speed,
            });
        }
        addLog(`[TỐC ĐỘ] Đã đổi tốc độ mô phỏng sang ${speed.toFixed(1)}x`);
    },

    triggerDream: async (target = "both") => {
        const { addLog } = get();
        try {
            const res = await fetch(`http://localhost:8000/api/brain/dream?target=${target}`, {
                method: "POST",
            });
            if (res.ok) {
                const data = await res.json();
                addLog(`[GIẤC MỘNG] Đã kích hoạt giấc mộng củng cố nơ-ron (${target})`);
                if (data.snapshot) {
                    get().setStateFromWS(data.snapshot);
                }
            }
        } catch (e) {
            console.error("Error triggering dream:", e);
        }
    },

    addLog: (message) => {
        const time = new Date().toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
        set((state) => ({
            logs: [{ time, message }, ...state.logs.slice(0, 99)],
        }));
    },

    clearLogs: () => set({ logs: [] }),
}));
