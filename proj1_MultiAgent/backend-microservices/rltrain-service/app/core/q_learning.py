import math
import json
import random
from typing import Dict, Any, List, Tuple

class QLearningAgent:
    """
    Tabular Q-Learning Agent with spatial state discretization.
    Learns optimal navigation actions (Forward, Backward, Turn Left/Right)
    to reach target while avoiding obstacles based on 8-direction LIDAR.
    """
    def __init__(
        self,
        num_actions: int = 6,
        learning_rate: float = 0.15,
        discount_factor: float = 0.95,
        epsilon: float = 1.0,
        epsilon_decay: float = 0.995,
        epsilon_min: float = 0.05
    ):
        self.num_actions = num_actions
        self.alpha = learning_rate
        self.gamma = discount_factor
        self.epsilon = epsilon
        self.epsilon_decay = epsilon_decay
        self.epsilon_min = epsilon_min

        # Q-table: Dict[state_str, List[float]]
        self.q_table: Dict[str, List[float]] = {}
        self.training_steps = 0

    def get_state_key(self, obs: Dict[str, Any]) -> str:
        """
        Rời rạc hóa (Discretize) quan sát liên tục thành state key đại diện.
        Tối ưu số lượng state để hội tụ nhanh chỉ sau vài trăm episode:
        - angle_bucket: 8 hướng tới mục tiêu
        - dist_bucket: 3 khoảng cách (gần, trung bình, xa)
        - lidar_front: 3 mức (an toàn >3m, cảnh giác 1.5-3m, nguy hiểm <1.5m)
        - lidar_left: 2 mức
        - lidar_right: 2 mức
        """
        goal = obs.get("goal", {})
        lidar = obs.get("lidar", [8.0] * 8)

        angle = goal.get("angle_diff", 0.0)
        dist = goal.get("distance", 10.0)

        # 1. Rời rạc hoá góc tới đích (8 khoảng)
        # angle in [-pi, pi]
        norm_angle = (angle + math.pi) / (2 * math.pi)  # [0, 1]
        angle_bucket = int(norm_angle * 8) % 8

        # 2. Rời rạc hoá khoảng cách tới đích
        if dist < 2.5:
            dist_bucket = 0  # Rất gần
        elif dist < 6.0:
            dist_bucket = 1  # Trung bình
        else:
            dist_bucket = 2  # Xa

        # 3. Phân biệt rõ hướng chướng ngại vật để tránh nhập nhằng cảm biến (Perceptual Aliasing)
        c_dist = lidar[0] if len(lidar) > 0 else 8.0
        l_dist = min(lidar[1], lidar[2]) if len(lidar) > 2 else 8.0
        r_dist = min(lidar[7], lidar[6]) if len(lidar) > 7 else 8.0

        # Mức độ an toàn ngay trước mặt
        front_danger = 0 if c_dist < 1.8 else (1 if c_dist < 3.2 else 2)

        # Xác định rõ phía nào đang thoáng hơn để Agent biết chính xác cần bẻ lái bên nào
        if l_dist < 1.8 and r_dist < 1.8:
            clear_side = 0  # Kẹp cả 2 bên (cần lùi hoặc xoay tại chỗ)
        elif l_dist < 2.2:
            clear_side = 1  # Bên trái vướng vật cản -> Nên né sang phải
        elif r_dist < 2.2:
            clear_side = 2  # Bên phải vướng vật cản -> Nên né sang trái
        else:
            clear_side = 3  # Cả 2 bên đều thoáng

        return f"A{angle_bucket}_D{dist_bucket}_F{front_danger}_S{clear_side}"

    def get_q_values(self, state_key: str) -> List[float]:
        if state_key not in self.q_table:
            # Khởi tạo giá trị Q ban đầu = 0.0
            self.q_table[state_key] = [0.0] * self.num_actions
        return self.q_table[state_key]

    def choose_action(self, state_key: str, greedy: bool = False) -> int:
        """Epsilon-Greedy Action Selection"""
        if not greedy and random.random() < self.epsilon:
            # Khám phá (Exploration)
            return random.randint(0, self.num_actions - 1)

        # Khai thác (Exploitation)
        q_values = self.get_q_values(state_key)
        max_q = max(q_values)
        # Nếu nhiều action có cùng max_q, chọn ngẫu nhiên một trong số chúng
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
        """Bellman Equation Update với Learning Rate Decay nhẹ để ổn định khi train lâu"""
        current_q = self.get_q_values(state_key)[action]

        if done:
            target_q = reward
        else:
            next_max_q = max(self.get_q_values(next_state_key))
            target_q = reward + self.gamma * next_max_q

        td_error = target_q - current_q

        # Giảm dần alpha vừa phải theo số bước để củng cố tri thức mà không bị đóng băng quá sớm
        effective_alpha = max(0.05, self.alpha / (1.0 + 0.00003 * self.training_steps))
        self.q_table[state_key][action] += effective_alpha * td_error
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
