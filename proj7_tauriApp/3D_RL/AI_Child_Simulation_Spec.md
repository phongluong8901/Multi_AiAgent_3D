# AI Child Simulation – Đặc Tả Kỹ Thuật & Lộ Trình Triển Khai Toàn Hệ Thống

- **Mục tiêu**: Xây dựng môi trường mô phỏng gần với thế giới thực, trong đó một AI Agent ("Đứa trẻ") học đồng thời cả **Cơ thể** (di chuyển, lực, thăng bằng, năng lượng) lẫn **Tư duy** (nhận thức, lập kế hoạch, phản biện, ra quyết định) thông qua **Người hướng dẫn (Teacher)** kết hợp với trải nghiệm tự thân.
- **Công nghệ cốt lõi**: `Tauri 2.x` + `React / Three.js / Rapier Physics` (Frontend) + `Python Sidecar` (FastAPI, PyTorch, Stable-Baselines3, SQLite/Vector DB) chạy hoàn toàn **Local**.

---

## 1. Tầm Nhìn Tổng Thể

Agent không chỉ học một kỹ năng đơn lẻ mà là một thực thể hoàn chỉnh có:
- **Trạng thái nội tại (Internal Drives)**: Đói, khát, mệt, sợ hãi, đau đớn, bàng quang, tò mò, nhiệt độ/thoải mái.
- **Luồng năng lượng sinh học (Energy / Kcal)**: Năng lượng thu nạp và tiêu hao ảnh hưởng trực tiếp đến lực cơ bắp, tốc độ di chuyển và độ sâu suy nghĩ.
- **Mục tiêu phân층 & Áp lực đánh đổi (Goal Trade-offs)**: Phải lựa chọn giữa các nhu cầu xung đột (ví dụ: đang đói nhưng đường tới chỗ lấy thức ăn có nguy hiểm).
- **Luật pháp & Ranh giới xã hội**: Phân biệt hành vi được phép, hành vi bị hạn chế (soft constraint) và hành vi cấm tuyệt đối (hard constraint).
- **Tư duy & Phản biện**: Học mô hình thế giới (World Model) để dự đoán nhân-quả, có mức độ tự tin (confidence) và biết nghi ngờ/phản biện trước khi hành động.
- **Kế thừa & Sáng tạo**: Học từ Teacher trước, sau đó thử-sai có định hướng (guided exploration).
- **Trí nhớ chọn lọc & Lãng quên**: Ghi nhớ sự kiện quan trọng, quên dần thông tin ít giá trị, củng cố trí nhớ khi ngủ (Sleep Consolidation).
- **Kỹ năng mài dũa theo thời gian**: Kỹ năng vận động và thói quen càng thực hành nhiều càng mượt mà và tốn ít năng lượng hơn.

### Các Mô Hình Học Tập Chính
1. **Imitation Learning / Behavioral Cloning (BC)**: Học bắt chước trực tiếp từ thao tác điều khiển mẫu của Teacher.
2. **Reinforcement Learning from Teacher Feedback (Micro-RLHF)**: Tinh chỉnh hành vi qua tín hiệu thưởng / phạt / sửa sai theo thời gian thực từ Teacher.
3. **Curiosity-Driven & Drive-Driven Exploration**: Tự khám phá thế giới khi năng lượng dư dả và các nhu cầu sinh tồn đã ổn định.
4. **Hierarchical Reinforcement Learning (HRL)**: Tách biệt rõ tầng **Cognitive** (ra ý định/mục tiêu) và tầng **Motor** (điều khiển cơ thể thực thi).

---

## 2. Kiến Trúc Tổng Thể Hệ Thống

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Three.js + Tauri UI)                   │
│  - Môi trường 3D + Physics Engine (Rapier3D / Cannon-es)                │
│  - Avatar kép: Chế độ Agent tự hành hoặc Teacher điều khiển trực tiếp    │
│  - HUD & Dashboard: Hiển thị Drives, Kcal, Fatigue, Goal Tree, Memory   │
│  - Teacher Console: Nút Thưởng / Phạt / Ghi mẫu (Record) / Đặt luật      │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ IPC / WebSocket (State, Action, Feedback)
┌────────────────────────────────────▼────────────────────────────────────┐
│                    TAURI SIDECAR (Python AI Engine)                     │
│                                                                         │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────┐  │
│  │    Drive System     │  │  Energy/Kcal System │  │   Goal Manager  │  │
│  └──────────┬──────────┘  └──────────┬──────────┘  └────────┬────────┘  │
│             └────────────────────────┼──────────────────────┘           │
│                                      ▼                                  │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────┐  │
│  │  Cognitive Policy   ├──►    Skill Library    ├──►   Motor Policy  │  │
│  │ (Planning/Critique) │  │ (Motor Primitives)  │  │  (BC + PPO RL)  │  │
│  └──────────┬──────────┘  └─────────────────────┘  └─────────────────┘  │
│             │                                                           │
│  ┌──────────▼──────────┐  ┌─────────────────────┐  ┌─────────────────┐  │
│  │     World Model     │  │   Memory Systems    │  │   Persistence   │  │
│  │ (Causal Prediction) │  │ (SQLite + VectorDB) │  │  (Save / Sleep) │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Hệ Thống Nội Tại (Internal Systems)

### 3.1. Drive System (Hệ thống Nhu cầu / Động lực)
Mỗi drive là một biến liên tục thuộc đoạn `[0.0, 1.0]`, tự động tăng theo thời gian (`dt`) hoặc biến thiên theo sự kiện môi trường.

| Drive | Ý nghĩa | Tốc độ tăng cơ bản | Sự kiện làm giảm | Hệ quả khi quá ngưỡng (`> 0.85`) |
| :--- | :--- | :--- | :--- | :--- |
| `hunger` | Đói | Tăng đều theo thời gian | Ăn thức ăn | Giảm tốc độ hồi phục Energy, tăng ưu tiên tìm đồ ăn |
| `thirst` | Khát | Tăng nhanh hơn `hunger` | Uống nước | Tăng `fatigue` nhanh, giảm độ tập trung |
| `fatigue` | Mệt mỏi | Tăng khi vận động & suy nghĩ | Nghỉ ngơi / Ngủ | Giảm độ chính xác Motor, giảm độ sâu lập kế hoạch |
| `bladder` | Bàng quang | Tăng sau khi ăn/uống | Đi vệ sinh đúng chỗ | Gây mất tập trung, buộc ưu tiên mục tiêu vệ sinh |
| `pain` | Đau đớn | Tăng tức thời khi va chạm/ngã | Nghỉ ngơi, tránh tác nhân | Kích hoạt phản xạ né tránh tức thời, tăng `fear` |
| `fear` | Sợ hãi / Nguy hiểm | Tăng khi gặp vật nguy hiểm / bị phạt nặng | Ở vùng an toàn, gần Teacher | Ức chế `curiosity`, quá tải gây "đóng băng" (freeze) |
| `curiosity` | Tò mò | Tăng khi `energy` cao & môi trường mới | Khám phá vật thể/vùng mới | Kích hoạt thử nghiệm hành vi mới |
| `comfort` | Thoải mái / Nhiệt độ | Biến thiên theo môi trường | Ở nơi an toàn, nhiệt độ ổn | Hỗ trợ giảm stress và tăng hiệu quả học tập |
| `social` | Giao tiếp (Mở rộng) | Tăng khi lâu không tương tác Teacher | Nhận tương tác từ Teacher | Thúc đẩy hành vi tìm kiếm sự chú ý / hướng dẫn |

**Cơ chế tính điểm ưu tiên (Priority Score)**:
- Mỗi bước thời gian `t`, mỗi drive $i$ tạo ra áp lực cấp thiết:
  $$\text{Urgency}_i = w_i \cdot (\text{drive}_i)^{\gamma_i}$$
  *(với $\gamma_i > 1$ để khi drive tiến gần `1.0`, độ cấp thiết tăng phi tuyến).*
- Drive có `Urgency` cao nhất sẽ đẩy mục tiêu tương ứng lên đầu và ức chế các mục tiêu thứ yếu (như `curiosity`).
- Khi nhiều drive vượt ngưỡng nguy hiểm (`> 0.9`), Agent chuyển sang chế độ **Survival Override** (chỉ thực hiện hành vi sinh tồn cơ bản hoặc gọi Teacher).

### 3.2. Energy / Kcal System (Luồng Năng lượng)
Cầu nối vật lý giữa **Cơ thể** và **Tư duy**.

- **Biến số trạng thái**:
  - `energy`: Năng lượng hiện tại `[0, energy_max]` (đơn vị: Kcal quy đổi).
  - `energy_max`: Dung lượng năng lượng tối đa (tăng dần theo Developmental Stage).
  - `digesting`: Kho năng lượng đang tiêu hóa từ thức ăn, chuyển dần sang `energy` theo mỗi tick.
  - `fatigue`: Độ mỏi cơ và thần kinh tích lũy `[0.0, 1.0]`.
  - `basal_rate`: Tốc độ tiêu hao trao đổi chất nền.

- **Công thức tiêu hao mỗi tick (`dt`)**:
  $$\Delta E_{\text{consumed}} = \left( E_{\text{basal}} + E_{\text{motor}} + E_{\text{cognitive}} + E_{\text{stress}} \right) \cdot dt$$
  Trong đó:
  - $E_{\text{basal}} = \text{basal\_rate}$ (luôn chạy).
  - $E_{\text{motor}} = k_m \cdot \|\text{action\_force}\|^2 \cdot \text{complexity}$ (tỷ lệ với lực và độ phức tạp động tác).
  - $E_{\text{cognitive}} = k_c \cdot \text{planning\_depth} \cdot \text{learning\_active}$ (tỷ lệ với độ sâu suy nghĩ).
  - $E_{\text{stress}} = k_s \cdot \text{fear}$ (tiêu hao do căng thẳng kéo dài).

- **Ảnh hưởng ngược lên Cơ thể & Tư duy**:
  - Hệ số suy giảm thể chất: $\alpha_{\text{motor}} = \text{clip}\left(\frac{\text{energy}}{0.3 \cdot \text{energy\_max}}, 0.2, 1.0\right) \cdot (1 - 0.5 \cdot \text{fatigue})$.
  - Giới hạn lực và tốc độ tối đa thực tế: `max_speed_actual = base_max_speed * alpha_motor`.
  - Giới hạn độ sâu lập kế hoạch (World Model rollout horizon): `horizon = int(max_horizon * alpha_cognitive)`.

### 3.3. Goal System (Hệ thống Mục tiêu Phân tầng)
Tổ chức theo cây phân cấp 4 mức:
1. **Long-term Goal (Dài hạn)**: Sinh tồn, phát triển kỹ năng, duy trì trạng thái cân bằng nội tại (Homeostasis).
2. **Mid-term Goal (Trung hạn)**: Giải quyết drive đang cấp thiết (ví dụ: `Satisfy_Hunger`, `Avoid_Hazard`, `Explore_Object`).
3. **Short-term Subgoal (Ngắn hạn)**: Chuỗi bước tuần tự (ví dụ: `Move_To(Food_Zone)` -> `Grab(Apple)` -> `Consume(Apple)`).
4. **Primitive Action**: Lệnh gửi xuống tầng Skill / Motor.

**Hàm Đánh Đổi (Trade-off Utility)**:
$$\text{Utility}(G) = \text{ExpectedDriveReduction}(G) - \lambda_E \cdot \text{EstimatedEnergyCost}(G) - \lambda_R \cdot \text{EstimatedRisk}(G) - \lambda_L \cdot \text{RuleViolationPenalty}(G)$$

### 3.4. Luật Pháp & Ranh Giới Xã Hội (Rules & Boundaries)
- **Hard Constraints (Cấm tuyệt đối)**: Các vùng cấm hoặc hành vi nguy hiểm cao. Vi phạm dẫn đến phạt cực nặng tức thời và hủy hành động.
- **Soft Constraints (Hạn chế)**: Hành vi không khuyến khích (ví dụ: làm rơi đồ, đi vào vùng bẩn). Giảm mạnh `Utility` của mục tiêu.
- **Cách học luật**: Học qua 3 kênh: (1) Quan sát vùng giới hạn, (2) Nhận lệnh phạt trực tiếp từ Teacher (`Punish`), (3) Ghi nhớ hậu quả đau/phạt vào Episodic & Semantic Memory.

---

## 4. Học Cả Cơ Thể Lẫn Tư Duy (Hierarchical Learning)

### 4.1. Tầng Motor (Cơ thể - Low-level Control)
- **Đầu vào**: Vector quan sát cục bộ `(vị trí bản thân, vận tốc, góc quay, cảm biến va chạm/tia quét xung quanh, vector hướng tới Subgoal, mức energy, mức fatigue)`.
- **Đầu ra**: Vector điều khiển liên tục `(lực đẩy X/Z, momen xoay, lệnh tương tác vật thể)`.
- **Quá trình huấn luyện**:
  1. Khởi tạo bằng **Behavioral Cloning (BC)** từ dữ liệu Teacher điều khiển.
  2. Tinh chỉnh bằng **PPO (Reinforcement Learning)** với hàm thưởng kết hợp: tiến gần subgoal + giữ thăng bằng - phạt va chạm - phạt tiêu phí năng lượng.

### 4.2. Lớp Trung Gian: Skill Library (Motor Primitives)
- Lưu trữ các kỹ năng cơ bản đã định hình: ` walk_to(target)`, `stop()`, `avoid_obstacle()`, `interact(object_id)`, `rest()`.
- Mỗi kỹ năng có chỉ số **Proficiency (Độ thuần thục)** $\in [0.1, 1.0]$:
  - Mỗi lần thực thi thành công: `proficiency += lr * (1 - proficiency)`.
  - Khi `proficiency` tăng: giảm nhiễu điều khiển (mượt hơn) và giảm hệ số tiêu hao năng lượng $E_{\text{motor}}$ (tối đa giảm 35%).

### 4.3. Tầng Cognitive (Tư duy - High-level Control)
- Không can thiệp vào từng bước nhích chân, chỉ quyết định **Chọn Subgoal nào** và **Gọi Skill nào** (cập nhật mỗi $N$ ticks, ví dụ mỗi 10–20 ticks hoặc khi Subgoal hiện tại hoàn tất/thất bại).
- Tích hợp **Confidence & Phản biện (Self-Critique)**:
  - Trước khi thực thi một kế hoạch, Cognitive dùng World Model dự đoán xác suất thành công $p_{\text{success}}$ và rủi ro $p_{\text{pain}}$.
  - Nếu `confidence < threshold` hoặc rủi ro cao, Agent sẽ tạm dừng, đổi kế hoạch hoặc phát tín hiệu "Hỏi Teacher".

---

## 5. Hệ Thống Trí Nhớ (Memory Systems)

### 5.1. Bốn Tầng Trí Nhớ
1. **Working Memory (Trí nhớ làm việc)**: Lưu trong RAM (ring buffer 50–100 ticks gần nhất) gồm vị trí các vật vừa nhìn thấy, mục tiêu đang làm dở, lệnh vừa nhận từ Teacher.
2. **Episodic Memory (Trí nhớ sự kiện)**: Lưu các trải nghiệm cụ thể `(timestamp, location, context_state, action_taken, outcome, emotion_valence, teacher_feedback)` vào bảng SQLite + Vector Embedding.
3. **Semantic Memory (Trí nhớ ngữ nghĩa / Kiến thức khái quát)**: Các quy tắc rút ra được (ví dụ: `"Vật màu đỏ = Nguy hiểm / Gây đau"`, `"Khu vực xanh lá = Có thức ăn"`, `"Chạm tường đỏ = Bị Teacher phạt"`).
4. **Procedural Memory (Trí nhớ kỹ năng)**: Trọng số mạng neural của các Motor Skills và điểm `proficiency` tương ứng.

### 5.2. Cơ Chế Ghi Nhớ Chọn Lọc & Lãng Quên
- Điểm quan trọng của mỗi ký ức:
  $$\text{Importance} = w_1 \cdot \text{Novelty} + w_2 \cdot |\text{Emotion / Pain / Reward}| + w_3 \cdot |\text{TeacherFeedback}| + w_4 \cdot \text{AccessFrequency}$$
- Suy giảm theo thời gian (Forgetting Curve):
  $$\text{Retention}(t) = \text{Importance} \cdot e^{-\lambda \cdot \frac{\Delta t}{\text{rehearsal\_count} + 1}}$$
- Khi `Retention(t) < threshold_forget`, bản ghi Episodic nhạt nhòa sẽ bị xóa khỏi DB để giữ bộ nhớ gọn nhẹ. Các ký ức có `Importance` cao được đánh dấu `protected = True`.

### 5.3. Memory Consolidation (Củng cố khi Ngủ)
- Khi Agent vào trạng thái **Sleep** (do `fatigue` cao hoặc người dùng bấm nút Sleep):
  1. Phục hồi dần `energy` và giảm `fatigue` về `0`.
  2. Lấy ra Top-$K$ sự kiện có `Importance` cao nhất trong Episodic Memory để huấn luyện lại (Experience Replay) cho **World Model** và **Policy**.
  3. Chưng cất các sự kiện lặp đi lặp lại thành quy tắc trong **Semantic Memory**.
  4. Dọn dẹp (prune) các ký ức có `Retention` thấp.

---

## 6. Cơ Chế Học Tập, Tương Tác Teacher & Các Giai Đoạn Phát Triển

### 6.1. Ba Chế Độ Tương Tác Của Teacher
1. **Teleoperation Mode (Cầm tay chỉ việc)**: Teacher dùng bàn phím (`WASD` / Chuột) điều khiển trực tiếp Avatar. Hệ thống tự động ghi lại các cặp `(observation, internal_state, action)` vào tập `demonstrations.db`.
2. **Guidance & Feedback Mode (Thưởng / Phạt thời gian thực)**: Agent tự chạy; Teacher bấm nút **Reward (+1)**, **Punish (-1)**, hoặc chỉ định điểm đến trên bản đồ 3D để sửa sai ngay lập tức.
3. **Rule Setting Mode (Đặt ranh giới)**: Teacher đánh dấu vùng cấm / vùng an toàn trên mặt phẳng 3D.

### 6.2. Các Giai Đoạn Phát Triển (Developmental Curriculum)
- **Stage 0 – Infant (Sơ sinh)**: Chỉ có Motor cơ bản, Teacher điều khiển nhiều để tạo dữ liệu Behavioral Cloning.
- **Stage 1 – Toddler (Tập đi)**: Tự di chuyển tới mục tiêu đơn giản, bắt đầu chịu ảnh hưởng của `Energy` và `Hunger`.
- **Stage 2 – Child (Nhận thức)**: Mở rộng đầy đủ các Drives, biết đánh đổi mục tiêu (Goal Trade-offs), học từ thưởng/phạt của Teacher.
- **Stage 3 – Autonomous Learner (Tự chủ)**: Có World Model dự đoán nhân-quả, có phản biện, tuân thủ luật pháp/ranh giới, tự củng cố trí nhớ khi ngủ, Teacher giảm dần can thiệp.

---

## 7. Cấu Trúc Thư Mục Mục Tiêu (Mở Rộng Từ Codebase Hiện Tại)

Dựa trên cấu trúc `backend/`, `frontend/`, và `desktop/` sẵn có của dự án, hệ thống sẽ được mở rộng theo kiến trúc mô-đun hóa như sau:

```text
3D_RL/
├── AI_Child_Simulation_Spec.md        # Tài liệu đặc tả & lộ trình triển khai
├── read.md                            # Hướng dẫn chạy nhanh
│
├── backend/                           # Python Sidecar AI Engine
│   ├── main.py                        # Entrypoint FastAPI + WebSocket Server
│   ├── requirements.txt
│   ├── pyrefly.toml
│   ├── data/                          # Lưu trữ Persistence local
│   │   ├── agent_state.json           # Drives, Energy, Stage, Proficiency
│   │   ├── memory.sqlite              # Episodic, Semantic, Demonstrations
│   │   └── models/                    # Trọng số BC, PPO Motor, World Model
│   │
│   └── app/
│       ├── api/
│       │   └── routes.py              # REST + WebSocket (State, Teacher Control, Feedback)
│       ├── core/
│       │   ├── config.py
│       │   ├── websocket_manager.py
│       │   └── persistence.py         # Lưu/Load toàn bộ trạng thái Agent
│       ├── internal/                  # [MỚI] Hệ thống nội tại
│       │   ├── drives.py              # DriveSystem (Hunger, Fatigue, Pain, Fear, Curiosity...)
│       │   ├── energy.py              # EnergySystem (Kcal, Metabolism, Digestion, Penalties)
│       │   ├── goals.py               # GoalManager (Hierarchical Goals & Trade-off Utility)
│       │   └── rules.py               # RuleEngine (Hard/Soft constraints)
│       ├── brain/                     # [MỚI] Tư duy, Trí nhớ & World Model
│       │   ├── cognitive_policy.py    # Tầng tư duy chọn Subgoal & Phản biện
│       │   ├── skill_library.py       # Lớp trung gian Motor Primitives & Proficiency
│       │   ├── world_model.py         # Mạng dự đoán trạng thái tiếp theo & rủi ro
│       │   └── memory_system.py       # Working, Episodic, Semantic, Consolidation
│       ├── envs/
│       │   ├── base.py
│       │   ├── obstacle_avoidance.py  # Env hiện tại (nền tảng Phase 1)
│       │   └── child_world_env.py     # [MỚI] Môi trường tích hợp thức ăn, nguy hiểm, vùng ngủ
│       ├── trainers/
│       │   ├── ppo_trainer.py         # Tinh chỉnh Motor Policy bằng RL
│       │   ├── bc_trainer.py          # [MỚI] Behavioral Cloning từ Teacher Demos
│       │   └── feedback_buffer.py     # [MỚI] Lưu trữ & cập nhật từ Teacher Reward/Punish
│       └── services/
│           └── simulation_service.py  # Điều phối vòng lặp chính (Tick Loop)
│
├── frontend/                          # Giao diện 3D & Bảng điều khiển (React + Three.js)
│   └── src/
│       ├── App.tsx
│       ├── components/
│       │   ├── Scene3D.tsx            # Không gian 3D (Sàn, Vật cản, Thức ăn, Vùng ngủ, Vùng cấm)
│       │   ├── Robot.tsx              # Avatar Agent (hiển thị màu sắc/hiệu ứng theo trạng thái)
│       │   ├── Goal.tsx               # Điểm đích / Thức ăn / Vật thể tương tác
│       │   ├── Obstacles.tsx          # Vật cản & Vùng nguy hiểm
│       │   ├── ControlPanel.tsx       # Điều khiển Train / Play / Sleep / Save
│       │   ├── InternalMonitor.tsx    # [MỚI] Thanh tiến trình Drives, Energy Kcal, Goal hiện tại
│       │   ├── TeacherConsole.tsx     # [MỚI] Chế độ cầm lái (WASD) + Nút Thưởng / Phạt
│       │   ├── StatusBar.tsx
│       │   └── LogPanel.tsx
│       ├── hooks/
│       │   ├── useWebSocket.ts
│       │   └── useTeacherInput.ts     # [MỚI] Bắt sự kiện bàn phím/chuột khi Teacher điều khiển
│       ├── stores/
│       │   └── useTrainingStore.ts    # Zustand store lưu toàn bộ State & Internal Metrics
│       └── types/
│           └── index.ts               # Định nghĩa TypeScript interfaces đồng bộ với Backend
│
└── desktop/                           # Tauri Desktop App
    ├── package.json
    └── src-tauri/
        ├── Cargo.toml
        ├── tauri.conf.json            # Cấu hình cửa sổ & Sidecar binary
        └── src/
            ├── main.rs
            └── lib.rs
```

---

## 8. Lộ Trình Từng Bước Hoàn Thiện Dự Án (Step-by-Step Implementation Plan)

Hiện tại bạn đã có **Giai đoạn 0 (Baseline)**: Môi trường 3D hiển thị Robot, Goal, Obstacles và luồng huấn luyện PPO cơ bản qua FastAPI + WebSocket. Dưới đây là từng bước cụ thể để nâng cấp lên hệ thống **AI Child Simulation** hoàn chỉnh.

---

### GIAI ĐOẠN 1: Nền Tảng Nội Tại, Teacher Điều Khiển & Lưu Trạng Thái (MVP) - [COMPLETED]
**Mục tiêu**: Đưa hệ thống `Energy (Kcal)` + `Drives` vào hoạt động, cho phép Teacher dùng phím `WASD` điều khiển Avatar để ghi dữ liệu mẫu (Demonstration), và lưu/load trạng thái.

- [x] **Bước 1.1 – Xây dựng `EnergySystem` và `DriveSystem` ở Backend**:
  - Tạo `backend/app/internal/energy.py`: Quản lý `energy` (0–1000 Kcal), `digesting`, `fatigue`, hàm `consume(motor_force, cognitive_load, dt)` và hàm `eat(kcal)`.
  - Tạo `backend/app/internal/drives.py`: Quản lý 5 drives cốt lõi (`hunger`, `thirst`, `fatigue`, `pain`, `curiosity`), hàm `step(dt, events)` cập nhật giá trị và tính `priority_score`.
- [x] **Bước 1.2 – Mở rộng Môi trường `ChildWorldEnv`**:
  - Tạo `backend/app/envs/child_world_env.py` (kế thừa từ `obstacle_avoidance.py`):
    - Thêm vùng thức ăn (`food_pos`), vùng nghỉ ngơi (`bed_pos`), vật cản gây đau (`obstacles`).
    - Khi chạm `food_pos` -> giảm `hunger`, tăng `digesting`.
    - Khi chạm `obstacles` -> tăng vọt `pain` và `fear`.
    - Áp dụng hệ số `alpha_motor` từ `EnergySystem` để giảm `max_speed` khi Agent đói hoặc mệt.
- [x] **Bước 1.3 – Chế độ Teacher Điều Khiển (Teleoperation) & Ghi Demo**:
  - Thêm endpoint WebSocket nhận lệnh điều khiển `[vx, vy]` trực tiếp từ bàn phím người dùng.
  - Tạo bảng `demonstrations` trong `backend/data/memory.sqlite` để lưu cặp `(obs, drives, action)` mỗi khi Teacher điều khiển.
- [x] **Bước 1.4 – Cập nhật UI Frontend hiển thị Nội tại & Teacher Console**:
  - Tạo `frontend/src/components/InternalMonitor.tsx`: Hiển thị thanh trạng thái cho `Energy (Kcal)`, `Hunger`, `Fatigue`, `Pain`, `Curiosity`.
  - Tạo `frontend/src/hooks/useTeacherInput.ts`: Cho phép bấm phím `WASD` hoặc phím mũi tên để lái Agent trên màn hình 3D khi bật chế độ `"Teacher Control"`.
- [x] **Bước 1.5 – Persistence (Lưu / Load State)**:
  - Tạo `backend/app/core/persistence.py`: Lưu tự động toàn bộ `drives`, `energy`, vị trí vào `backend/data/agent_state.json` để khi tắt/mở lại app, Agent tiếp tục đúng trạng thái cũ.

---

### GIAI ĐOẠN 2: Học Cơ Thể (Behavioral Cloning + Hierarchical Motor Skill)
**Mục tiêu**: Agent học cách di chuyển từ dữ liệu mẫu của Teacher (Imitation Learning), sau đó tự tinh chỉnh bằng RL và hình thành thư viện kỹ năng cơ bản.

- [ ] **Bước 2.1 – Huấn luyện Behavioral Cloning (`bc_trainer.py`)**:
  - Tạo `backend/app/trainers/bc_trainer.py`: Đọc dữ liệu `(obs, action)` từ bảng `demonstrations` của Teacher, huấn luyện mạng MLP bằng hàm mất mát MSE để Agent bắt chước cách đi và né vật cản của Teacher chỉ trong vài giây.
- [ ] **Bước 2.2 – Khởi tạo PPO từ trọng số BC**:
  - Nạp trọng số mạng BC vào `PPOTrainer` để tinh chỉnh tiếp bằng Reinforcement Learning (giúp Agent không cần học mò từ con số 0).
- [ ] **Bước 2.3 – Xây dựng `SkillLibrary` (`skill_library.py`)**:
  - Tạo các kỹ năng cơ bản: `go_to_target(x, y)`, `flee_from_danger()`, `rest_in_bed()`.
  - Lưu chỉ số `proficiency` cho từng kỹ năng: mỗi lần đến đích thành công mà không va chạm, tăng `proficiency` và giảm mức tiêu hao Kcal của kỹ năng đó.

---

### GIAI ĐOẠN 3: Tầng Tư Duy, Hệ Thống Mục Tiêu & Teacher Feedback (RLHF)
**Mục tiêu**: Agent tự biết chọn mục tiêu dựa trên cơn đói/mệt/tò mò, biết nghe lời khen/chê của Teacher, và có World Model phiên bản đầu.

- [ ] **Bước 3.1 – Xây dựng `GoalManager` (`goals.py`)**:
  - Tính điểm `Utility` cho các mục tiêu ứng viên: `Find_Food`, `Go_To_Sleep`, `Explore_World`, `Follow_Teacher_Command`.
  - Ví dụ: Khi `hunger > 0.6`, mục tiêu `Find_Food` thắng thế -> truyền tọa độ thức ăn xuống làm Subgoal cho tầng Motor.
- [ ] **Bước 3.2 – Tích hợp Teacher Feedback (Nút Thưởng / Phạt thời gian thực)**:
  - Tạo `frontend/src/components/TeacherConsole.tsx` với 2 nút (hoặc phím tắt `R` / `P`): **Reward (+)** và **Punish (-)**.
  - Khi Teacher bấm nút, gửi tín hiệu về `backend/app/trainers/feedback_buffer.py` để cộng/trừ trực tiếp vào hàm Reward của các bước vừa thực hiện và lưu sự kiện vào bộ nhớ.
- [ ] **Bước 3.3 – Xây dựng `WorldModel` cơ bản (`world_model.py`)**:
  - Mạng neural nhỏ dự đoán: `(obs_t, action_t) -> (predicted_obs_t+1, predicted_pain, predicted_energy_cost)`.
  - Tầng `CognitivePolicy` dùng `WorldModel` thử phỏng đoán 3–5 bước phía trước: nếu hướng đi dự báo `predicted_pain` cao, Agent chủ động đổi hướng hoặc dừng lại.

---

### GIAI ĐOẠN 4: Hệ Thống Trí Nhớ Đa Tầng, Lãng Quên & Cơ Chế Ngủ (Consolidation)
**Mục tiêu**: Agent nhớ được các sự kiện quan trọng, quên đi thông tin rác, và thông minh hơn sau mỗi chu kỳ ngủ.

- [ ] **Bước 4.1 – Xây dựng `MemorySystem` (`memory_system.py`)**:
  - Cài đặt **Working Memory** (deque lưu các sự kiện vừa diễn ra).
  - Cài đặt **Episodic Memory** trên SQLite: Lưu các sự kiện có cảm xúc/đau đớn cao hoặc có tương tác từ Teacher, kèm công thức tính `Importance` và `Retention` suy giảm theo thời gian.
  - Cài đặt **Semantic Memory**: Tổng hợp thành quy tắc (ví dụ: lưu tọa độ các vùng nguy hiểm đã từng gây đau để vẽ lên bản đồ nhận thức của Agent).
- [ ] **Bước 4.2 – Cơ chế Ngủ & Củng cố trí nhớ (`Sleep Consolidation`)**:
  - Khi Agent đi vào vùng ngủ (`bed_pos`) và chuyển sang mode `"sleep"`:
    - Hiển thị hiệu ứng ngủ trên UI 3D.
    - Chạy vòng lặp huấn luyện ngầm (Background Replay) trên các ký ức có `Importance` cao nhất để cập nhật `WorldModel` và `MotorPolicy`.
    - Xóa các ký ức có `Retention < 0.15`.
    - Hồi phục `energy` và đưa `fatigue` về `0`.

---

### GIAI ĐOẠN 5: Luật Pháp, Phản Biện & Đóng Gói Ứng Dụng Độc Lập (.exe)
**Mục tiêu**: Hoàn thiện ranh giới xã hội, cơ chế tự phản biện (Confidence), bảng điều khiển trực quan và đóng gói Python Sidecar vào Tauri.

- [ ] **Bước 5.1 – Luật pháp & Ranh giới (`rules.py`)**:
  - Cho phép Teacher kẻ vùng cấm (Forbidden Zone) trên mặt phẳng 3D.
  - Phân biệt Hard Constraint (không được bước vào) và Soft Constraint (chỉ bước vào nếu `hunger` hoặc `fear` ở mức sinh tử).
- [ ] **Bước 5.2 – Phản biện & Độ tự tin (`Confidence`)**:
  - Tính độ lệch dự đoán của `WorldModel` (Prediction Error). Nếu môi trường thay đổi lạ lẫm khiến `confidence` thấp, Agent đi chậm lại và ưu tiên quan sát hoặc chờ Teacher hướng dẫn.
- [ ] **Bước 5.3 – Đóng gói Python Sidecar cùng Tauri Installer**:
  - Dùng `PyInstaller` đóng gói `backend/main.py` thành binary thực thi.
  - Cấu hình `externalBin` trong `desktop/src-tauri/tauri.conf.json` để Tauri tự động bật/tắt AI Engine khi người dùng chạy file cài đặt `.exe`.

---

## 9. Nguyên Tắc Thiết Kế Cốt Lõi (Checklist Khi Code)

1. **Mọi hành vi đều có nguyên nhân nội tại**: Không có hành động ngẫu nhiên vô nghĩa; mọi chuyển động đều xuất phát từ `Drives` + `Energy` + `Goals`.
2. **Phân tầng rõ ràng**: `Cognitive` chỉ ra quyết định cấp cao (đi đâu, làm gì); `Motor` chịu trách nhiệm điều khiển vật lý (lực, vận tốc, tránh va chạm).
3. **Năng lượng là tài nguyên hữu hạn**: Mọi cử động và suy nghĩ đều tốn Kcal; đói và mệt phải làm thay đổi rõ rệt dáng đi và tốc độ phản ứng của Agent.
4. **Mô-đun hóa & Bật/Tắt độc lập**: Mỗi hệ thống (`Drive`, `Energy`, `Memory`, `WorldModel`) phải có cờ cấu hình (feature flag) để có thể kiểm thử độc lập từng phần.
5. **Toàn bộ trạng thái phải Serializable**: Có thể lưu ra JSON/SQLite bất cứ lúc nào và khôi phục chính xác 100%.

---

## 10. Mẫu Câu Lệnh (Prompt) Để Triển Khai Tiếp Từng Bước

Để quá trình code diễn ra mạch lạc, không bị quá tải và đảm bảo code chạy chuẩn ngay sau mỗi bước, bạn chỉ cần yêu cầu theo thứ tự:

- **Bắt đầu Giai đoạn 1**:
  > *"Hãy triển khai Giai đoạn 1 (Bước 1.1 đến 1.5): Tạo hệ thống Energy, Drives, mở rộng môi trường có thức ăn/giường ngủ, thêm chế độ Teacher điều khiển bằng bàn phím và hiển thị thanh trạng thái nội tại lên UI."*
- **Chuyển sang Giai đoạn 2**:
  > *"Hãy triển khai Giai đoạn 2: Xây dựng bộ ghi Demonstration của Teacher, thuật toán Behavioral Cloning và thư viện kỹ năng SkillLibrary."*
- **Chuyển sang Giai đoạn 3**:
  > *"Hãy triển khai Giai đoạn 3: Xây dựng GoalManager tự động chọn mục tiêu theo Drives, nút Thưởng/Phạt thời gian thực từ Teacher và WorldModel cơ bản."*
- **Chuyển sang Giai đoạn 4**:
  > *"Hãy triển khai Giai đoạn 4: Xây dựng hệ thống Memory (Working, Episodic, Semantic), cơ chế lãng quên và chu kỳ Ngủ (Sleep Consolidation)."*
- **Chuyển sang Giai đoạn 5**:
  > *"Hãy triển khai Giai đoạn 5: Thêm hệ thống Luật pháp/Vùng cấm, cơ chế Phản biện/Confidence và đóng gói Python Sidecar vào Tauri."*
