/**
 * ==============================================================================
 * MODULE KẾT NỐI REST API (FRONTEND HTTP CLIENT)
 * ==============================================================================
 * Cung cấp toàn bộ các hàm gọi API REST tới Backend FastAPI (http://localhost:8000/api):
 * - Huấn luyện và bểu diễn PPO (startTraining, loadModel, startPlay, stopPlay).
 * - Quản lý chế độ tự hành sinh tồn & tốc độ mô phỏng (toggleAutonomyLife, setSimulationSpeed).
 * - Tương tác Người Hướng Dẫn / Teacher (giveTeacherFeedback, setTeacherTarget).
 * - Quản lý sinh lý và thể chất (feedAgent, restAgent).
 * - Lưu trữ & Khôi phục trạng thái (saveAgentState, loadAgentState, resetAgentState).
 * - Huấn luyện Bắt chước / Behavioral Cloning (clearDemos, generateExpertDemos, startBCTraining, loadBCModel).
 * - Đổi chính sách vận động & Reset não bộ Tabula Rasa (setPolicyMode, resetTabulaRasa).
 */

const API_BASE = "http://localhost:8000/api";

/**
 * Bắt đầu tiến trình huấn luyện PPO offline trên backend.
 * @param timesteps Tổng số bước timesteps (mặc định 10,000)
 * @param nEnvs Số môi trường song song (mặc định 1)
 */
export async function startTraining(timesteps = 10000, nEnvs = 1) {
    const res = await fetch(
        `${API_BASE}/train/start?timesteps=${timesteps}&n_envs=${nEnvs}`,
        { method: "POST" }
    );
    return res.json();
}

/**
 * Nạp mô hình checkpoint PPO đã lưu trong thư mục models/.
 * @param modelName Tên file mô hình (không cần .zip)
 */
export async function loadModel(modelName = "obstacle_ppo_latest") {
    const res = await fetch(
        `${API_BASE}/model/load?model_name=${modelName}`,
        { method: "POST" }
    );
    return res.json();
}

/**
 * Bắt đầu chế độ biểu diễn (Play) theo mô hình PPO đã nạp.
 * @param episodes Số tập biểu diễn (mặc định 3)
 */
export async function startPlay(episodes = 3) {
    const res = await fetch(
        `${API_BASE}/play/start?episodes=${episodes}`,
        { method: "POST" }
    );
    return res.json();
}

/**
 * Dừng chế độ biểu diễn Play.
 */
export async function stopPlay() {
    const res = await fetch(`${API_BASE}/play/stop`, { method: "POST" });
    return res.json();
}

/**
 * Lấy trạng thái huấn luyện hiện tại của PPO và snapshot thế giới.
 */
export async function getStatus() {
    const res = await fetch(`${API_BASE}/train/status`);
    return res.json();
}

/**
 * Bật hoặc tắt vòng lặp tự hành sinh tồn của 2 bé.
 * @param active True để chạy tự do, False để dừng lại
 */
export async function toggleAutonomyLife(active = true) {
    const res = await fetch(`${API_BASE}/autonomy/toggle?active=${active}`, {
        method: "POST",
    });
    return res.json();
}

/**
 * Điều chỉnh tốc độ mô phỏng thời gian thế giới.
 * @param speed Hệ số tốc độ (0.0x = tạm dừng, 1.0x = chuẩn, 2.0x, 5.0x)
 */
export async function setSimulationSpeed(speed = 1.0) {
    const res = await fetch(`${API_BASE}/autonomy/speed?speed=${speed}`, {
        method: "POST",
    });
    return res.json();
}

/**
 * Gửi phản hồi Khen thưởng (+) hoặc Phạt (-) từ Teacher tới bé.
 * @param praise True nếu khen thưởng (+5 điểm), False nếu nhắc nhở (-8 điểm)
 * @param target Đối tượng nhận ('bo', 'bi' hoặc 'both')
 */
export async function giveTeacherFeedback(praise = true, target = "both") {
    const res = await fetch(`${API_BASE}/teacher/feedback?praise=${praise}&target=${target}`, {
        method: "POST",
    });
    return res.json();
}

/**
 * Chỉ định tọa độ đích đến cho bé qua click chuột trên sàn 3D.
 * @param x Tọa độ x [0.5 - 99.5]
 * @param z Tọa độ z [0.5 - 99.5]
 * @param label Nhãn mô tả đích đến
 * @param target Bé nhận lệnh ('bo', 'bi' hoặc 'both')
 */
export async function setTeacherTarget(x: number, z: number, label = "Chỉ định bởi Người Hướng Dẫn", target = "both") {
    const res = await fetch(
        `${API_BASE}/teacher/target?x=${x}&z=${z}&label=${encodeURIComponent(label)}&target=${target}`,
        { method: "POST" }
    );
    return res.json();
}

/**
 * Cho bé ăn bánh nạp Kcal trực tiếp.
 * @param kcal Lượng năng lượng (mặc định 250 Kcal)
 * @param target Bé được ăn ('bo', 'bi' hoặc 'both')
 */
export async function feedAgent(kcal = 250, target = "both") {
    const res = await fetch(`${API_BASE}/state/feed?kcal=${kcal}&target=${target}`, {
        method: "POST",
    });
    return res.json();
}

/**
 * Cho bé nghỉ ngơi hồi phục thể lực và giảm mệt mỏi tức thời.
 * @param target Bé được nghỉ ('bo', 'bi' hoặc 'both')
 */
export async function restAgent(target = "both") {
    const res = await fetch(`${API_BASE}/state/rest?target=${target}`, { method: "POST" });
    return res.json();
}

/**
 * Lưu toàn bộ trạng thái hiện tại ra file agent_state.json trên backend.
 */
export async function saveAgentState() {
    const res = await fetch(`${API_BASE}/state/save`, { method: "POST" });
    return res.json();
}

/**
 * Nạp lại trạng thái đã lưu trước đó từ file agent_state.json.
 */
export async function loadAgentState() {
    const res = await fetch(`${API_BASE}/state/load`, { method: "POST" });
    return res.json();
}

/**
 * Đặt lại trạng thái môi trường thế giới.
 * @param fullReset True nếu đặt lại cả thể chất và tâm lý về ban đầu
 */
export async function resetAgentState(fullReset = true) {
    const res = await fetch(`${API_BASE}/state/reset?full_reset=${fullReset}`, {
        method: "POST",
    });
    return res.json();
}

/**
 * Xóa sạch toàn bộ kho dữ liệu thị phạm trong memory.sqlite.
 */
export async function clearDemos() {
    const res = await fetch(`${API_BASE}/demos/clear`, { method: "POST" });
    return res.json();
}

/**
 * Tự động sinh mẫu thị phạm chất lượng cao từ bộ điều hướng chuyên gia.
 * @param count Số lượng mẫu cần sinh (mặc định 150)
 */
export async function generateExpertDemos(count = 150) {
    const res = await fetch(`${API_BASE}/demos/generate?count=${count}`, {
        method: "POST",
    });
    return res.json();
}

/**
 * Bắt đầu huấn luyện Bắt Chước (Behavioral Cloning) từ kho thị phạm.
 * @param epochs Số lượt epoch huấn luyện (mặc định 35)
 */
export async function startBCTraining(epochs = 35) {
    const res = await fetch(`${API_BASE}/train/bc?epochs=${epochs}`, {
        method: "POST",
    });
    return res.json();
}

/**
 * Nạp mô hình mạng nơ-ron Behavioral Cloning đã huấn luyện (bc_policy_latest.pt).
 */
export async function loadBCModel() {
    const res = await fetch(`${API_BASE}/model/bc/load`, {
        method: "POST",
    });
    return res.json();
}

/**
 * Chuyển đổi chế độ chính sách vận động cho Bé Bo:
 * - 'online_rl': Tự học liên tục theo thời gian thực (Actor-Critic + ICM).
 * - 'heuristic': Lực thế năng và đồ thị Topo Graph A*.
 * - 'bc': Mạng nơ-ron học bắt chước từ Teacher.
 * - 'ppo': Mô hình PPO đã huấn luyện.
 * @param mode Chế độ chính sách lựa chọn
 */
export async function setPolicyMode(mode: "heuristic" | "bc" | "ppo" | "online_rl") {
    const res = await fetch(`${API_BASE}/policy/mode?mode=${mode}`, {
        method: "POST",
    });
    return res.json();
}

/**
 * Xóa toàn bộ trí nhớ bản đồ, sương mù nhận thức và trọng số nơ-ron về con số 0 (Tabula Rasa).
 */
export async function resetTabulaRasa() {
    const res = await fetch(`${API_BASE}/brain/tabula-rasa`, {
        method: "POST",
    });
    return res.json();
}
