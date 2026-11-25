import math
import random
from typing import Dict, Any, List, Tuple
import numpy as np


class DQNAgent:
    """
    Double Deep Q-Network (Double DQN) with Prioritized Experience Replay,
    Huber TD-Loss, Bias-Corrected Adam Optimizer, and Polyak Target Updates.
    """
    def __init__(
        self,
        state_dim: int = 13,
        num_actions: int = 6,
        hidden_dim: int = 64,
        learning_rate: float = 0.003,
        discount_factor: float = 0.98,
        epsilon: float = 0.35,
        epsilon_decay: float = 0.99,
        epsilon_min: float = 0.04,
        buffer_size: int = 6000,
        batch_size: int = 48,
        target_update_freq: int = 40,
        tau: float = 0.02
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
        self.tau = tau
        self.buffer_size = buffer_size

        self.t = 0
        self.training_steps = 0
        self.replay_buffer: List[Tuple[np.ndarray, int, float, np.ndarray, bool]] = []
        self.priority_buffer: List[Tuple[np.ndarray, int, float, np.ndarray, bool]] = []

        self._init_networks(hidden_dim)

    def _init_networks(self, hidden_dim: int):
        self.hidden_dim = hidden_dim
        # 1. Main Q-Network weights (He Initialization for ReLU)
        self.w1 = (np.random.randn(self.state_dim, hidden_dim) * np.sqrt(2.0 / self.state_dim)).astype(np.float32)
        self.b1 = np.zeros(hidden_dim, dtype=np.float32)
        self.w2 = (np.random.randn(hidden_dim, self.num_actions) * np.sqrt(2.0 / (hidden_dim + self.num_actions))).astype(np.float32)
        self.b2 = np.zeros(self.num_actions, dtype=np.float32)

        # 2. Target Q-Network weights
        self.w1_target = self.w1.copy()
        self.b1_target = self.b1.copy()
        self.w2_target = self.w2.copy()
        self.b2_target = self.b2.copy()

        # Adam Moments
        self.m_w1, self.v_w1 = np.zeros_like(self.w1), np.zeros_like(self.w1)
        self.m_b1, self.v_b1 = np.zeros_like(self.b1), np.zeros_like(self.b1)
        self.m_w2, self.v_w2 = np.zeros_like(self.w2), np.zeros_like(self.w2)
        self.m_b2, self.v_b2 = np.zeros_like(self.b2), np.zeros_like(self.b2)

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

    def _navigation_prior(self, s: np.ndarray) -> np.ndarray:
        single = (s.ndim == 1)
        if single:
            s = s[None, :]

        cos_ang = s[:, 1]
        sin_ang = s[:, 2]
        front_l = s[:, 5]
        fl_l = s[:, 6]
        l_l = s[:, 7]
        r_l = s[:, 11]
        fr_l = s[:, 12]

        left_clear = 0.65 * fl_l + 0.35 * l_l
        right_clear = 0.65 * fr_l + 0.35 * r_l
        front_min = np.minimum(front_l, np.minimum(fl_l * 1.15, fr_l * 1.15))
        front_blocked = np.maximum(0.0, 0.22 - front_min) * 8.0

        prior = np.zeros((s.shape[0], self.num_actions), dtype=np.float32)
        prior[:, 0] = 3.2 * cos_ang * (front_min > 0.15) - 6.0 * (front_min <= 0.15) - front_blocked
        prior[:, 1] = -2.5 + 4.0 * (front_l < 0.10)
        prior[:, 2] = 2.4 * np.maximum(0.0, sin_ang) + 2.8 * (front_min <= 0.18) * (left_clear >= right_clear)
        prior[:, 3] = 2.4 * np.maximum(0.0, -sin_ang) + 2.8 * (front_min <= 0.18) * (right_clear > left_clear)
        prior[:, 4] = 2.5 * cos_ang + 2.5 * np.maximum(0.0, sin_ang) + 1.8 * (left_clear - right_clear) - 2.5 * (fl_l < 0.12)
        prior[:, 5] = 2.5 * cos_ang + 2.5 * np.maximum(0.0, -sin_ang) + 1.8 * (right_clear - left_clear) - 2.5 * (fr_l < 0.12)

        decay = max(0.45, 1.0 / (1.0 + 0.0003 * self.training_steps))
        prior *= decay
        return prior[0] if single else prior

    def forward(self, s: np.ndarray, target: bool = False) -> Tuple[np.ndarray, np.ndarray]:
        """Forward pass Q-network"""
        w1 = self.w1_target if target else self.w1
        b1 = self.b1_target if target else self.b1
        w2 = self.w2_target if target else self.w2
        b2 = self.b2_target if target else self.b2

        h1 = np.maximum(0.0, np.dot(s, w1) + b1)
        q_vals = np.dot(h1, w2) + b2 + self._navigation_prior(s)
        return q_vals, h1

    def choose_action(self, obs: Dict[str, Any], greedy: bool = False) -> int:
        """Smart Epsilon-Greedy Action Selection"""
        s = self.extract_state_vector(obs)
        if not greedy and random.random() < self.epsilon:
            # 50% ngẫu nhiên hoàn toàn, 50% lấy mẫu Boltzmann theo hướng cảm biến để khám phá thông minh
            if random.random() < 0.5:
                return random.randint(0, self.num_actions - 1)
            prior = self._navigation_prior(s)
            probs = np.exp(prior - np.max(prior))
            probs /= np.sum(probs)
            return int(np.random.choice(self.num_actions, p=probs))

        q_vals, _ = self.forward(s, target=False)
        return int(np.argmax(q_vals))

    def record_step(self, obs: Dict[str, Any], action: int, reward: float, next_obs: Dict[str, Any], done: bool):
        """Lưu bước di chuyển vào Replay Buffer"""
        s = self.extract_state_vector(obs)
        s_next = self.extract_state_vector(next_obs)
        transition = (s, action, reward, s_next, done)
        self.replay_buffer.append(transition)
        if len(self.replay_buffer) > self.buffer_size:
            self.replay_buffer.pop(0)

        if done or abs(reward) >= 4.0:
            self.priority_buffer.append(transition)
            if len(self.priority_buffer) > self.buffer_size // 3:
                self.priority_buffer.pop(0)

    def _sample_batch(self) -> List[Tuple[np.ndarray, int, float, np.ndarray, bool]]:
        if len(self.priority_buffer) >= 8:
            n_prio = min(len(self.priority_buffer), self.batch_size // 4)
            n_reg = self.batch_size - n_prio
            return random.sample(self.priority_buffer, n_prio) + random.sample(self.replay_buffer, n_reg)
        return random.sample(self.replay_buffer, self.batch_size)

    def _adam_step(self, param: np.ndarray, grad: np.ndarray, m: np.ndarray, v: np.ndarray, lr: float):
        beta1, beta2, eps = 0.9, 0.999, 1e-8
        grad = np.clip(grad, -2.5, 2.5)
        m[:] = beta1 * m + (1.0 - beta1) * grad
        v[:] = beta2 * v + (1.0 - beta2) * (grad ** 2)
        m_hat = m / (1.0 - (beta1 ** self.t))
        v_hat = v / (1.0 - (beta2 ** self.t))
        param -= lr * m_hat / (np.sqrt(v_hat) + eps)

    def learn_step(self) -> float:
        """Học 1 minibatch bằng Vectorized Double DQN (DDQN) & Huber Loss"""
        if len(self.replay_buffer) < self.batch_size:
            return 0.0

        batch = self._sample_batch()
        bs = len(batch)
        self.t += 1
        self.training_steps += 1

        s_batch = np.array([b[0] for b in batch], dtype=np.float32)
        a_batch = np.array([b[1] for b in batch], dtype=np.int32)
        r_batch = np.array([b[2] for b in batch], dtype=np.float32)
        s_next_batch = np.array([b[3] for b in batch], dtype=np.float32)
        done_batch = np.array([b[4] for b in batch], dtype=np.float32)

        # Double DQN Target:
        # Online network chọn best_next_actions, Target network đánh giá Q
        next_q_online, _ = self.forward(s_next_batch, target=False)
        best_next_actions = np.argmax(next_q_online, axis=1)
        next_q_target, _ = self.forward(s_next_batch, target=True)

        idx = np.arange(bs)
        target_q = r_batch + (1.0 - done_batch) * self.gamma * next_q_target[idx, best_next_actions]

        q_vals, h1 = self.forward(s_batch, target=False)
        td_err = q_vals[idx, a_batch] - target_q

        # Huber-clipped gradient
        grad_q = np.zeros_like(q_vals)
        grad_q[idx, a_batch] = np.clip(td_err, -15.0, 15.0) / bs

        gw2 = np.dot(h1.T, grad_q)
        gb2 = np.sum(grad_q, axis=0)
        dh1 = np.dot(grad_q, self.w2.T) * (h1 > 0.0)
        gw1 = np.dot(s_batch.T, dh1)
        gb1 = np.sum(dh1, axis=0)

        self._adam_step(self.w1, gw1, self.m_w1, self.v_w1, self.lr)
        self._adam_step(self.b1, gb1, self.m_b1, self.v_b1, self.lr)
        self._adam_step(self.w2, gw2, self.m_w2, self.v_w2, self.lr)
        self._adam_step(self.b2, gb2, self.m_b2, self.v_b2, self.lr)

        # Polyak Soft-Update Target Network mỗi bước
        self.w1_target = self.tau * self.w1 + (1.0 - self.tau) * self.w1_target
        self.b1_target = self.tau * self.b1 + (1.0 - self.tau) * self.b1_target
        self.w2_target = self.tau * self.w2 + (1.0 - self.tau) * self.w2_target
        self.b2_target = self.tau * self.b2 + (1.0 - self.tau) * self.b2_target

        return float(np.mean(td_err ** 2))

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

    def load_policy(self, data: Dict[str, Any]):
        w = data.get("weights", {})
        if "w1" in w:
            w1_arr = np.array(w["w1"], dtype=np.float32)
            if w1_arr.shape[1] != self.hidden_dim:
                self._init_networks(int(w1_arr.shape[1]))
            self.w1 = w1_arr
            self.b1 = np.array(w["b1"], dtype=np.float32)
            self.w2 = np.array(w["w2"], dtype=np.float32)
            self.b2 = np.array(w["b2"], dtype=np.float32)
            self.w1_target = self.w1.copy()
            self.b1_target = self.b1.copy()
            self.w2_target = self.w2.copy()
            self.b2_target = self.b2.copy()
            self.training_steps = data.get("training_steps", 0)
