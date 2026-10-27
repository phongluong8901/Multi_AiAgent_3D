import math
import json
import random
from typing import Dict, Any, List, Tuple
import numpy as np

class DQNAgent:
    """
    Deep Q-Network (DQN) with Experience Replay Buffer and Target Network.
    
    Takes 13-dim continuous vector as input.
    Predicts Q-values for all 6 discrete navigation actions.
    """
    def __init__(
        self,
        state_dim: int = 13,
        num_actions: int = 6,
        hidden_dim: int = 48,
        learning_rate: float = 0.005,
        discount_factor: float = 0.95,
        epsilon: float = 1.0,
        epsilon_decay: float = 0.995,
        epsilon_min: float = 0.05,
        buffer_size: int = 4000,
        batch_size: int = 32,
        target_update_freq: int = 60
    ):
        self.state_dim = state_dim
        self.num_actions = num_actions
        self.hidden_dim = hidden_dim
        self.gamma = discount_factor
        self.epsilon = epsilon
        self.epsilon_decay = epsilon_decay
        self.epsilon_min = epsilon_min
        self.lr = learning_rate
        self.batch_size = batch_size
        self.target_update_freq = target_update_freq

        # 1. Main Q-Network weights
        self.w1 = np.random.randn(state_dim, hidden_dim) * np.sqrt(2.0 / (state_dim + hidden_dim))
        self.b1 = np.zeros(hidden_dim)
        self.w2 = np.random.randn(hidden_dim, num_actions) * np.sqrt(2.0 / (hidden_dim + num_actions))
        self.b2 = np.zeros(num_actions)

        # 2. Target Q-Network weights (giúp ổn định mục tiêu Bellman)
        self.w1_target = self.w1.copy()
        self.b1_target = self.b1.copy()
        self.w2_target = self.w2.copy()
        self.b2_target = self.b2.copy()

        # Adam Moments
        self.m_w1, self.v_w1 = np.zeros_like(self.w1), np.zeros_like(self.w1)
        self.m_b1, self.v_b1 = np.zeros_like(self.b1), np.zeros_like(self.b1)
        self.m_w2, self.v_w2 = np.zeros_like(self.w2), np.zeros_like(self.w2)
        self.m_b2, self.v_b2 = np.zeros_like(self.b2), np.zeros_like(self.b2)
        self.t = 0

        # Experience Replay Buffer [(s, a, r, s_next, done)]
        self.replay_buffer: List[Tuple[np.ndarray, int, float, np.ndarray, bool]] = []
        self.buffer_size = buffer_size
        self.training_steps = 0

    def extract_state_vector(self, obs: Dict[str, Any]) -> np.ndarray:
        """Chuyển đổi quan sát liên tục thành vector 13 chiều chuẩn hóa"""
        agent = obs.get("agent", {})
        goal = obs.get("goal", {})
        lidar = obs.get("lidar", [8.0] * 8)

        heading = agent.get("heading", 0.0)
        dist = goal.get("distance", 10.0)
        angle_diff = goal.get("angle_diff", 0.0)

        norm_dist = min(1.0, dist / 20.0)
        cos_ang = math.cos(angle_diff)
        sin_ang = math.sin(angle_diff)
        cos_hd = math.cos(heading)
        sin_hd = math.sin(heading)

        norm_lidar = [min(1.0, max(0.0, l / 8.0)) for l in lidar[:8]]
        while len(norm_lidar) < 8:
            norm_lidar.append(1.0)

        return np.array([norm_dist, cos_ang, sin_ang, cos_hd, sin_hd] + norm_lidar, dtype=np.float32)

    def forward(self, s: np.ndarray, target: bool = False) -> Tuple[np.ndarray, np.ndarray]:
        """Forward pass Q-network"""
        w1 = self.w1_target if target else self.w1
        b1 = self.b1_target if target else self.b1
        w2 = self.w2_target if target else self.w2
        b2 = self.b2_target if target else self.b2

        h1 = np.maximum(0.0, np.dot(s, w1) + b1)  # ReLU
        q_vals = np.dot(h1, w2) + b2
        return q_vals, h1

    def choose_action(self, obs: Dict[str, Any], greedy: bool = False) -> int:
        """Epsilon-Greedy Action Selection"""
        if not greedy and random.random() < self.epsilon:
            return random.randint(0, self.num_actions - 1)

        s = self.extract_state_vector(obs)
        q_vals, _ = self.forward(s, target=False)
        return int(np.argmax(q_vals))

    def record_step(self, obs: Dict[str, Any], action: int, reward: float, next_obs: Dict[str, Any], done: bool):
        """Lưu bước di chuyển vào Replay Buffer"""
        s = self.extract_state_vector(obs)
        s_next = self.extract_state_vector(next_obs)
        self.replay_buffer.append((s, action, reward, s_next, done))
        if len(self.replay_buffer) > self.buffer_size:
            self.replay_buffer.pop(0)

    def learn_step(self) -> float:
        """Học 1 minibatch từ Replay Buffer qua Bellman Equation"""
        if len(self.replay_buffer) < self.batch_size:
            return 0.0

        batch = random.sample(self.replay_buffer, self.batch_size)
        self.t += 1
        beta1, beta2, eps = 0.9, 0.999, 1e-8
        loss = 0.0

        for s, a, r, s_next, done in batch:
            q_vals, h1 = self.forward(s, target=False)
            current_q = q_vals[a]

            if done:
                target_q = r
            else:
                next_q_vals, _ = self.forward(s_next, target=True)
                target_q = r + self.gamma * np.max(next_q_vals)

            td_err = target_q - current_q
            loss += td_err ** 2

            # Gradient update
            dq = np.zeros(self.num_actions)
            dq[a] = -td_err  # MSE gradient

            gw2 = np.outer(h1, dq)
            gb2 = dq
            dh1 = np.dot(dq, self.w2.T) * (h1 > 0.0)
            gw1 = np.outer(s, dh1)
            gb1 = dh1

            # Adam updates
            self.m_w1 = beta1 * self.m_w1 + (1 - beta1) * gw1
            self.v_w1 = beta2 * self.v_w1 + (1 - beta2) * (gw1 ** 2)
            self.w1 -= (self.lr / (np.sqrt(self.v_w1) + eps)) * self.m_w1

            self.m_w2 = beta1 * self.m_w2 + (1 - beta1) * gw2
            self.v_w2 = beta2 * self.v_w2 + (1 - beta2) * (gw2 ** 2)
            self.w2 -= (self.lr / (np.sqrt(self.v_w2) + eps)) * self.m_w2

        self.training_steps += 1

        # Định kỳ đồng bộ Target Network
        if self.training_steps % self.target_update_freq == 0:
            self.w1_target = self.w1.copy()
            self.b1_target = self.b1.copy()
            self.w2_target = self.w2.copy()
            self.b2_target = self.b2.copy()

        return float(loss / self.batch_size)

    def decay_epsilon(self):
        if self.epsilon > self.epsilon_min:
            self.epsilon = max(self.epsilon_min, self.epsilon * self.epsilon_decay)

    def export_policy(self) -> Dict[str, Any]:
        return {
            "algorithm": "DQN",
            "state_dim": self.state_dim,
            "num_actions": self.num_actions,
            "hidden_dim": self.hidden_dim,
            "training_steps": self.training_steps,
            "weights": {
                "w1": self.w1.tolist(),
                "b1": self.b1.tolist(),
                "w2": self.w2.tolist(),
                "b2": self.b2.tolist(),
            }
        }
