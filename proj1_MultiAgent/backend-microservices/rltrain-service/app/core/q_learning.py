import math
import random
from typing import Dict, Any, List, Tuple


class QLearningAgent:
    """
    Tabular Q(lambda) Agent with Eligibility Traces, Spatial State Discretization,
    and Sensor-Guided Warm-Start Initialization.
    """
    def __init__(
        self,
        num_actions: int = 6,
        learning_rate: float = 0.22,
        discount_factor: float = 0.97,
        epsilon: float = 0.65,
        epsilon_decay: float = 0.99,
        epsilon_min: float = 0.03,
        trace_lambda: float = 0.72
    ):
        self.num_actions = num_actions
        self.alpha = learning_rate
        self.gamma = discount_factor
        self.epsilon = epsilon
        self.epsilon_decay = epsilon_decay
        self.epsilon_min = epsilon_min
        self.trace_lambda = trace_lambda

        # Q-table: Dict[state_str, List[float]]
        self.q_table: Dict[str, List[float]] = {}
        # Eligibility Traces: Dict[Tuple[state_str, int], float]
        self.traces: Dict[Tuple[str, int], float] = {}
        self.training_steps = 0

    def get_state_key(self, obs: Dict[str, Any]) -> str:
        """
        Rời rạc hóa (Discretize) quan sát liên tục thành state key đại diện:
        - angle_bucket: 8 hướng tới mục tiêu
        - dist_bucket: 3 khoảng cách (gần, trung bình, xa)
        - front_danger: 3 mức (nguy hiểm <1.8m, cảnh giác 1.8-3.2m, an toàn >3.2m)
        - clear_side: 4 mức (0: kẹp 2 bên, 1: trái vướng, 2: phải vướng, 3: 2 bên thoáng)
        """
        goal = obs.get("goal", {})
        lidar = obs.get("lidar", [8.0] * 8)

        angle = goal.get("angle_diff", 0.0)
        dist = goal.get("distance", 10.0)

        # 1. Rời rạc hoá góc tới đích (8 khoảng, dịch +pi/8 để bucket 4 ứng với thẳng mặt angle ≈ 0)
        norm_angle = ((angle + math.pi) / (2 * math.pi)) % 1.0
        angle_bucket = int(norm_angle * 8) % 8

        # 2. Rời rạc hoá khoảng cách tới đích
        if dist < 2.5:
            dist_bucket = 0  # Rất gần
        elif dist < 6.0:
            dist_bucket = 1  # Trung bình
        else:
            dist_bucket = 2  # Xa

        # 3. Phân biệt rõ hướng chướng ngại vật
        c_dist = lidar[0] if len(lidar) > 0 else 8.0
        l_dist = min(lidar[1], lidar[2]) if len(lidar) > 2 else 8.0
        r_dist = min(lidar[7], lidar[6]) if len(lidar) > 7 else 8.0

        front_danger = 0 if c_dist < 1.8 else (1 if c_dist < 3.2 else 2)

        if l_dist < 1.8 and r_dist < 1.8:
            clear_side = 0  # Kẹp cả 2 bên
        elif l_dist < 2.2:
            clear_side = 1  # Bên trái vướng -> Nên né sang phải
        elif r_dist < 2.2:
            clear_side = 2  # Bên phải vướng -> Nên né sang trái
        else:
            clear_side = 3  # Cả 2 bên đều thoáng

        return f"A{angle_bucket}_D{dist_bucket}_F{front_danger}_S{clear_side}"

    def _warm_start_q(self, state_key: str) -> List[float]:
        """Khởi tạo Q-value thông minh dựa trên cấu trúc hình học của state_key"""
        q = [0.0] * self.num_actions
        try:
            parts = state_key.split("_")
            a_b = int(parts[0][1:])  # 0..7 (3, 4 là hướng thẳng về phía Goal)
            f_d = int(parts[2][1:])  # 0: nguy hiểm, 1: cảnh giác, 2: thoáng
            c_s = int(parts[3][1:])  # 0: kẹp, 1: trái vướng, 2: phải vướng, 3: thoáng

            # Action: 0=FWD, 1=BWD, 2=LEFT, 3=RIGHT, 4=FWD_LEFT, 5=FWD_RIGHT
            if f_d == 0:
                # Vật cản sát ngay trước mặt: cấm tiến thẳng, ưu tiên xoay về bên thoáng
                q[0] = -4.0
                q[1] = 1.0 if c_s == 0 else -0.5
                if c_s == 1:  # Trái vướng -> xoay phải
                    q[3] = 3.5
                    q[5] = 2.0
                elif c_s == 2:  # Phải vướng -> xoay trái
                    q[2] = 3.5
                    q[4] = 2.0
                else:
                    q[2] = 2.5 if a_b >= 4 else 1.5
                    q[3] = 2.5 if a_b < 4 else 1.5
            else:
                # Đường phía trước thông thoáng: điều hướng theo góc tới Goal
                q[1] = -2.5  # Không đi lùi khi đường thoáng
                if a_b in [3, 4]:  # Goal ở ngay trước mặt
                    q[0] = 4.0
                    q[4] = 2.5 if a_b == 4 else 1.5
                    q[5] = 2.5 if a_b == 3 else 1.5
                elif a_b in [5, 6]:  # Goal lệch bên trái
                    q[4] = 3.5 if c_s != 1 else 0.5
                    q[2] = 3.0
                    q[0] = 1.0
                elif a_b in [1, 2]:  # Goal lệch bên phải
                    q[5] = 3.5 if c_s != 2 else 0.5
                    q[3] = 3.0
                    q[0] = 1.0
                else:  # Goal ở phía sau lưng (0 hoặc 7)
                    q[2] = 3.2 if a_b == 7 else 2.0
                    q[3] = 3.2 if a_b == 0 else 2.0
                    q[0] = -1.0
        except Exception:
            pass
        return q

    def get_q_values(self, state_key: str) -> List[float]:
        if state_key not in self.q_table:
            self.q_table[state_key] = self._warm_start_q(state_key)
        return self.q_table[state_key]

    def choose_action(self, state_key: str, greedy: bool = False) -> int:
        """Epsilon-Greedy Action Selection"""
        q_values = self.get_q_values(state_key)
        if not greedy and random.random() < self.epsilon:
            return random.randint(0, self.num_actions - 1)

        max_q = max(q_values)
        best_actions = [a for a, q in enumerate(q_values) if abs(q - max_q) < 1e-5]
        return random.choice(best_actions)

    def learn(
        self,
        state_key: str,
        action: int,
        reward: float,
        next_state_key: str,
        done: bool
    ) -> float:
        """Cập nhật Q(lambda) với Eligibility Traces giúp lan truyền phần thưởng về đích cực nhanh"""
        current_q = self.get_q_values(state_key)[action]

        if done:
            target_q = reward
        else:
            next_max_q = max(self.get_q_values(next_state_key))
            target_q = reward + self.gamma * next_max_q

        td_error = target_q - current_q
        effective_alpha = max(0.06, self.alpha / (1.0 + 0.00002 * self.training_steps))

        # Replacing traces cho (state_key, action)
        self.traces[(state_key, action)] = 1.0

        # Lan truyền TD error cho toàn bộ các trạng thái gần đây trong trace
        to_delete = []
        for (s_k, act_idx), trace_val in list(self.traces.items()):
            self.q_table[s_k][act_idx] += effective_alpha * td_error * trace_val
            new_trace = trace_val * self.gamma * self.trace_lambda
            if new_trace < 0.02 or done:
                to_delete.append((s_k, act_idx))
            else:
                self.traces[(s_k, act_idx)] = new_trace

        for k in to_delete:
            self.traces.pop(k, None)

        if done:
            self.traces.clear()

        self.training_steps += 1
        return td_error

    def decay_epsilon(self):
        """Giảm dần tỷ lệ khám phá sau mỗi episode"""
        if self.epsilon > self.epsilon_min:
            self.epsilon = max(self.epsilon_min, self.epsilon * self.epsilon_decay)

    def export_policy(self) -> Dict[str, Any]:
        """Xuất toàn bộ tri thức (Q-Table & Hyperparameters) sang JSON format"""
        best_actions = {}
        for s, q_vals in self.q_table.items():
            best_actions[s] = int(q_vals.index(max(q_vals)))

        return {
            "algorithm": "Q-Learning",
            "states_learned": len(self.q_table),
            "training_steps": self.training_steps,
            "epsilon": round(self.epsilon, 4),
            "alpha": self.alpha,
            "gamma": self.gamma,
            "q_table": self.q_table,
            "best_actions": best_actions
        }

    def load_policy(self, data: Dict[str, Any]):
        """Nạp lại Q-Table đã huấn luyện từ file"""
        self.q_table = data.get("q_table", {})
        self.epsilon = data.get("epsilon", self.epsilon_min)
        self.training_steps = data.get("training_steps", 0)
        self.traces.clear()
