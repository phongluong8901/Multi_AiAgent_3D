/**
 * ==============================================================================
 * HỆ THỐNG ĐỊNH NGHĨA KIỂU DỮ LIỆU TOÀN CỤC (GLOBAL TYPES & INTERFACES)
 * ==============================================================================
 * Định nghĩa toàn bộ cấu trúc dữ liệu trao đổi giữa Backend Python và Frontend React:
 * - Trạng thái Thể chất (EnergyState - Kcal & Fatigue).
 * - Trạng thái Tâm lý & Nhu cầu (DrivesState & Homeostasis).
 * - Bản đồ Nhận thức & Ký ức Sự kiện (MemoryState & Episodic Memories).
 * - Vi mạch Nơ-ron Tự học Trực tuyến (OnlineLearnerState & Neural Circuit Metrics).
 * - Giấc Mộng Tái Hiện Ban Đêm (DreamState & Hippocampal Replay).
 * - Tiến trình Phát triển Nhận thức (DevelopmentalStage - Piagetian Stages).
 * - Phương tiện Giao thông Động (DynamicVehicle) & Đồ thị Topo A* (TopoNode).
 * - Trạng thái Toàn Cảnh Thế Giới 3D (RobotState).
 */

/** Định danh đại diện cho 2 bé tác tử */
export type AgentId = "bo" | "bi";

/** Chế độ Camera quan sát 3D: Toàn cảnh, Theo dõi Bé Bo, Theo dõi Bé Bi */
export type CameraMode = "overview" | "follow_bo" | "follow_bi";

/** Pha thời gian trong ngày theo chu kỳ Circadian */
export type DayPhase = "dawn" | "day" | "sunset" | "night";

/**
 * Trạng thái Năng lượng Sinh học & Thể chất của bé
 */
export interface EnergyState {
    /** Lượng Kcal hiện tại sẵn sàng tiêu thụ */
    energy: number;
    /** Dung lượng Kcal tối đa (mặc định 1000 Kcal) */
    energy_max: number;
    /** Tỷ lệ năng lượng hiện tại [0.0 - 1.0] */
    energy_ratio: number;
    /** Lượng thức ăn đang trong vùng tiêu hóa chờ hấp thu vào energy (Kcal) */
    digesting: number;
    /** Mức độ mệt mỏi thể chất [0.0 - 1.0] (tăng khi vận động, giảm khi ngủ nghỉ) */
    fatigue: number;
    /** Hệ số nhân suy giảm vận động cơ học [0.2 - 1.0] khi đói hoặc mệt */
    alpha_motor: number;
    /** Hệ số nhân suy giảm năng lực nhận thức và tập trung [0.25 - 1.0] */
    alpha_cognitive: number;
}

/**
 * Bản đồ 8 Động lực Nội tại của bé [0.0 - 1.0]
 */
export interface DrivesMap {
    /** Nhu cầu đói bụng */
    hunger: number;
    /** Nhu cầu khát nước */
    thirst: number;
    /** Cảm giác buồn ngủ / mệt mỏi */
    fatigue: number;
    /** Cảm giác đau đớn khi va chạm */
    pain: number;
    /** Nỗi sợ hãi khi ở gần lò lửa nguy hiểm */
    fear: number;
    /** Động lực tò mò khám phá những vùng đất chưa biết */
    curiosity: number;
    /** Mức độ thoải mái tinh thần (nghịch đảo của đau, sợ, đói) */
    comfort: number;
    /** Nhu cầu bầu bạn, gắn kết xã hội (tăng khi ở một mình lâu) */
    social: number;
}

/**
 * Trạng thái Động lực & Cân bằng Nội môi (Homeostasis State)
 */
export interface DrivesState {
    /** Giá trị của từng động lực [0.0 - 1.0] */
    drives: DrivesMap;
    /** Độ cấp thiết phi tuyến của từng động lực: w * (val ^ gamma) */
    urgencies: Record<string, number>;
    /** Động lực có độ cấp thiết cao nhất chi phối hành vi hiện tại */
    dominant_drive: string;
    /** Cờ báo hiệu có nhu cầu sinh tồn vượt ngưỡng khẩn cấp (> 0.85) */
    survival_override: boolean;
}

/**
 * Ký ức Sự kiện Đáng nhớ (Episodic Memory Item)
 */
export interface EpisodicMemory {
    /** ID định danh ký ức */
    id: number;
    /** Thời gian ghi nhận (HH:MM:SS) */
    time: string;
    /** Phân loại ký ức: phát hiện tài nguyên, va chạm nguy hiểm, giao tiếp xã hội,... */
    type: "discovery" | "danger" | "social" | "feedback" | "milestone";
    /** Nội dung mô tả sự kiện */
    text: string;
    /** Mức độ quan trọng của ký ức [0.0 - 1.0] */
    importance: number;
}

/**
 * Trạng thái nhận thức về một điểm tài nguyên (Bếp ăn, Vòi nước, Giường ngủ)
 */
export interface DiscoveredResource {
    /** True nếu bé đã tự mình phát hiện ra điểm này trên bản đồ */
    discovered: boolean;
    /** Tọa độ [x, z] nếu đã biết, hoặc null nếu chưa biết */
    pos: number[] | null;
    /** Tên tiếng Việt của địa điểm */
    name: string;
}

/**
 * Mục lịch sử các vị trí tài nguyên từng xuất hiện
 */
export interface DiscoveredHistoryItem {
    type: string;
    pos: number[];
    status: "active" | "depleted";
    name: string;
    time?: string;
}

/**
 * Bản đồ Nhận thức Không gian & Trí nhớ Sự kiện
 */
export interface MemoryState {
    /** Tỷ lệ % bản đồ đã được bé khai phá sương mù */
    exploration_pct: number;
    /** Danh mục trạng thái các tài nguyên bé đang ghi nhớ */
    discovered_resources: Record<string, DiscoveredResource>;
    /** Lịch sử các điểm tài nguyên đã từng tìm thấy */
    discovered_history?: DiscoveredHistoryItem[];
    /** Các ký ức sự kiện gần nhất hiển thị trên giao diện */
    recent_memories: EpisodicMemory[];
    /** Ma trận lưới sương mù thu nhỏ 10x10 phục vụ vẽ radar */
    mini_explored_grid: number[][];
    /** Ma trận lưới vết sẹo nguy hiểm thu nhỏ 10x10 */
    mini_danger_grid: number[][];
}

/**
 * Trạng thái Giấc Mộng Tái Hiện Ban Đêm (Hippocampal Sleep Dream Replay)
 */
export interface DreamState {
    /** True nếu bé đang trong chu kỳ tái hiện giấc mộng */
    is_dreaming: boolean;
    /** Chủ đề giấc mơ sinh ra từ ký ức nổi bật nhất */
    dream_topic: string;
    /** Tổng số chu kỳ giấc mộng đã diễn ra */
    dream_cycles: number;
    /** Tổng số ký ức đã được tái hiện và củng cố */
    replayed_memories: number;
    /** Tốc độ biến đổi xi-náp thần kinh (Synaptic Plasticity Rate) */
    synaptic_plasticity_rate: number;
    /** Sai số loss trung bình của đợt huấn luyện giấc mộng gần nhất */
    last_dream_loss: number;
}

/**
 * Thông số Vi mạch Nơ-ron Tự học Trực tuyến (Online Continual Learner)
 */
export interface OnlineLearnerState {
    /** Tổng số bước tối ưu hóa gradient descent trực tuyến đã thực hiện */
    total_online_updates: number;
    /** Giá trị loss mới nhất của mạng Actor-Critic */
    latest_loss: number;
    /** Giá trị kỳ vọng V(s) do Critic ước lượng */
    latest_value: number;
    /** Số lượng trải nghiệm đang lưu trong bộ đệm ưu tiên PER */
    buffer_size: number;
    /** Trạng thái kích hoạt của bộ nơ-ron tự học */
    is_active: boolean;
    /** Điểm thưởng tò mò nội tại (ICM Curiosity Bonus) */
    curiosity_bonus?: number;
    /** Chỉ số đo lường mức độ bất ngờ trước các tình huống mới lạ [0.0 - 1.0] */
    surprise_metric?: number;
    /** Sai số dự đoán của mô hình thế giới World Model Forward/Inverse */
    world_model_loss?: number;
    /** Số lần học quan sát gián tiếp từ bạn bè (Social Observational Learning) */
    social_learning_events?: number;
    /** Điểm thưởng nhận được từ quan sát bạn bè gần nhất */
    last_social_reward?: number;
    /** Trạng thái giấc mộng ban đêm */
    dream_state?: DreamState;
}

/**
 * Thống kê các hành động sinh hoạt đời thường của bé
 */
export interface CognitiveStats {
    meals_eaten: number;
    water_drank: number;
    naps_taken: number;
    praises: number;
    scoldings: number;
    collisions: number;
    social_chats?: number;
}

/**
 * Thông tin Giai đoạn Trưởng thành Nhận thức (Piagetian Developmental Stage)
 */
export interface DevelopmentalStage {
    stage_id: number;
    stage_key: "toddler" | "explorer" | "autonomous_partner";
    stage_name: string;
    stage_badge: string;
    /** Tỷ lệ trao quyền cho mạng nơ-ron Actor-Critic [0.0 - 1.0] */
    competence: number;
    step: number;
    desc: string;
}

/**
 * Phương tiện Giao thông Động đô thị (Xe buýt, Taxi, Xe cứu thương,...)
 */
export interface DynamicVehicle {
    id: string;
    name: string;
    type: "bus" | "taxi" | "van" | "patrol_bot" | "ambulance";
    pos: number[]; // [x, z]
    velocity: number[]; // [vx, vz]
    yaw: number;
    radius: number;
    color: string;
}

/**
 * Nút trên Đồ thị Topo Ngữ nghĩa đô thị (Giao lộ hoặc Địa danh)
 */
export interface TopoNode {
    id: string;
    name: string;
    pos: number[]; // [x, z]
    type: string;
    discovered?: boolean;
}

/**
 * Trạng thái Nhận thức Tổng thể của một bé
 */
export interface CognitiveState {
    name?: string;
    personality?: string;
    is_autonomous: boolean;
    current_goal_name: string;
    current_goal_pos: number[];
    current_thought: string;
    has_custom_target: boolean;
    custom_target: number[] | null;
    development_step?: number;
    stage_info?: DevelopmentalStage;
    competence?: number;
    recent_reflections?: string[];
    last_neural_action?: number[];
    last_base_action?: number[];
    stats: CognitiveStats;
    memory?: MemoryState;
    online_learner?: OnlineLearnerState;
    current_waypoints?: number[][];
    is_traffic_avoiding?: boolean;
}

/**
 * Dữ liệu Toàn bộ Thế giới Truyền qua WebSocket từ Backend
 */
export interface RobotState {
    // Tọa độ hai bé
    robot: number[];       // Bé Bo [x, z]
    robot2?: number[];     // Bé Bi [x, z]
    peer_dist?: number;    // Khoảng cách giữa hai bé
    near_peer?: boolean;   // Đang ở gần nhau (< 2.5m)

    // Các khu vực thế giới
    goal: number[];
    food?: number[];
    water?: number[];
    bed?: number[];
    play?: number[];
    pool?: number[];
    park?: number[];
    obstacles: number[][];
    city_obstacles?: number[][];
    city_obstacle_radii?: number[];
    food_capacity?: number;
    water_capacity?: number;
    food_time_left?: number;
    water_time_left?: number;
    food_max_time?: number;
    water_max_time?: number;
    food_respawned?: boolean;
    water_respawned?: boolean;
    depleted_spots?: { type: string; pos: number[]; step?: number }[];
    race_stats?: {
        bo_wins: number;
        bi_wins: number;
        bo_food_wins: number;
        bi_food_wins: number;
        bo_water_wins: number;
        bi_water_wins: number;
        total_contests: number;
        last_winner?: string | null;
    };
    raceStats?: {
        bo_wins: number;
        bi_wins: number;
        bo_food_wins: number;
        bi_food_wins: number;
        bo_water_wins: number;
        bi_water_wins: number;
        total_contests: number;
        last_winner?: string | null;
    };
    is_racing?: boolean;
    world_size?: number;

    // Chu kỳ Ngày / Đêm sinh học đô thị
    time_of_day?: number;
    is_night?: boolean;
    day_phase?: DayPhase;

    step: number;
    reward: number;
    dist: number;

    // Trạng thái Bé Bo
    collided: boolean;
    ate_food?: boolean;
    drank_water?: boolean;
    is_resting?: boolean;
    energy_state?: EnergyState;
    drives_state?: DrivesState;
    cognitive_state?: CognitiveState;
    current_thought?: string;
    current_goal_name?: string;
    current_goal_pos?: number[];

    // Trạng thái Bé Bi
    collided2?: boolean;
    ate_food2?: boolean;
    drank_water2?: boolean;
    is_resting2?: boolean;
    energy_state2?: EnergyState;
    drives_state2?: DrivesState;
    cognitive_state2?: CognitiveState;
    current_thought2?: string;
    current_goal_name2?: string;
    current_goal_pos2?: number[];

    // Xe cộ giao thông động đô thị
    dynamic_vehicles?: DynamicVehicle[];
    traffic_collision1?: boolean;
    traffic_collision2?: boolean;

    // Bản đồ Topo Graph & Lộ trình toàn cục A*
    bo_topo_path?: number[][];
    bi_topo_path?: number[][];
    topo_nodes?: TopoNode[];

    // Trạng thái chung
    mode?: "idle" | "train" | "play" | "teacher" | "autonomous" | "teacher_order";
    demo_count?: number;
    is_autonomous_life?: boolean;
    simulation_speed?: number;
    policy_mode?: "heuristic" | "bc" | "ppo" | "online_rl";
    has_bc_model?: boolean;
}

/**
 * Dữ liệu Telemetry Tiến độ Huấn luyện PPO hoặc BC
 */
export interface TrainProgress {
    isTraining: boolean;
    mode: "ppo" | "bc" | null;
    step: number;
    totalSteps: number;
    pct: number;
    reward: number;
    loss: number;
    epoch: number;
    totalEpochs: number;
}

/**
 * Một dòng log kỹ thuật hiển thị trên LogPanel
 */
export interface LogItem {
    time: string;
    message: string;
}
