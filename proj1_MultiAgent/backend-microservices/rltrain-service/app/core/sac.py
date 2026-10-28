import math
import random
from typing import Dict, Any, List, Tuple
import numpy as np


class SACAgent:
    """
    Discrete Soft Actor-Critic (SAC) with Maximum Entropy Reinforcement Learning,
    Reward-Prioritized Replay Sampling, Normalized Q-Advantage Actor Updates,
    and Clipped Double Q-Learning.
    """
    def __init__(
        self,
        state_dim: int = 13,
        num_actions: int = 6,
        hidden_dim: int = 64,
        lr_actor: float = 0.002,
        lr_critic: float = 0.003,
        gamma: float = 0.98,
        tau: float = 0.015,
        alpha: float = 0.18,
        buffer_size: int = 6000,
        batch_size: int = 48
    ):
        self.state_dim = state_dim
        self.num_actions = num_actions
        self.hidden_dim = hidden_dim
        self.gamma = gamma
        self.tau = tau
        self.alpha = alpha
        self.lr_actor = lr_actor
        self.lr_critic = lr_critic
        self.batch_size = batch_size
        self.buffer_size = buffer_size

        self.t = 0
        self.training_steps = 0
        self.replay_buffer: List[Tuple[np.ndarray, int, float, np.ndarray, bool]] = []
        self.priority_buffer: List[Tuple[np.ndarray, int, float, np.ndarray, bool]] = []

        self._init_networks(hidden_dim)

    def _init_networks(self, hidden_dim: int):
        self.hidden_dim = hidden_dim
        # 1. Actor Network (Policy: s -> action distribution)
        self.w1_pi = (np.random.randn(self.state_dim, hidden_dim) * np.sqrt(2.0 / (self.state_dim + hidden_dim))).astype(np.float32)
        self.b1_pi = np.zeros(hidden_dim, dtype=np.float32)
        self.w2_pi = (np.random.randn(hidden_dim, self.num_actions) * 0.1).astype(np.float32)
        self.b2_pi = np.zeros(self.num_actions, dtype=np.float32)

        # 2. Critic 1 Network (s -> Q1(s, a))
        self.w1_q1 = (np.random.randn(self.state_dim, hidden_dim) * np.sqrt(2.0 / self.state_dim)).astype(np.float32)
        self.b1_q1 = np.zeros(hidden_dim, dtype=np.float32)
        self.w2_q1 = (np.random.randn(hidden_dim, self.num_actions) * np.sqrt(2.0 / (hidden_dim + self.num_actions))).astype(np.float32)
        self.b2_q1 = np.zeros(self.num_actions, dtype=np.float32)

        # 3. Critic 2 Network (s -> Q2(s, a))
        self.w1_q2 = (np.random.randn(self.state_dim, hidden_dim) * np.sqrt(2.0 / self.state_dim)).astype(np.float32)
        self.b1_q2 = np.zeros(hidden_dim, dtype=np.float32)
        self.w2_q2 = (np.random.randn(hidden_dim, self.num_actions) * np.sqrt(2.0 / (hidden_dim + self.num_actions))).astype(np.float32)
        self.b2_q2 = np.zeros(self.num_actions, dtype=np.float32)

        # Target Critics
        self.w1_q1_tgt = np.copy(self.w1_q1)
        self.b1_q1_tgt = np.copy(self.b1_q1)
        self.w2_q1_tgt = np.copy(self.w2_q1)
        self.b2_q1_tgt = np.copy(self.b2_q1)

        self.w1_q2_tgt = np.copy(self.w1_q2)
        self.b1_q2_tgt = np.copy(self.b1_q2)
        self.w2_q2_tgt = np.copy(self.w2_q2)
        self.b2_q2_tgt = np.copy(self.b2_q2)

        self._init_adam_moments()

    def _init_adam_moments(self):
        for name in [
            "w1_pi", "b1_pi", "w2_pi", "b2_pi",
            "w1_q1", "b1_q1", "w2_q1", "b2_q1",
            "w1_q2", "b1_q2", "w2_q2", "b2_q2",
        ]:
            p = getattr(self, name)
            setattr(self, f"m_{name}", np.zeros_like(p))
            setattr(self, f"v_{name}", np.zeros_like(p))

    def extract_state_vector(self, obs: Dict[str, Any]) -> np.ndarray:
        """Trích xuất continuous 13-dim state vector"""
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
        front_blocked = np.maximum(0.0, 0.30 - front_l) * 4.0

        prior = np.zeros((s.shape[0], self.num_actions), dtype=np.float32)
        prior[:, 0] = 1.0 * cos_ang * (front_l > 0.24) - 1.8 * front_blocked
        prior[:, 1] = -0.8 + 1.5 * (front_l < 0.16)
        prior[:, 2] = 0.8 * np.maximum(0.0, sin_ang) + 0.7 * front_blocked * (left_clear >= right_clear)
        prior[:, 3] = 0.8 * np.maximum(0.0, -sin_ang) + 0.7 * front_blocked * (right_clear > left_clear)
        prior[:, 4] = 0.7 * cos_ang + 0.7 * np.maximum(0.0, sin_ang) + 0.45 * (left_clear - right_clear) - front_blocked * 0.5
        prior[:, 5] = 0.7 * cos_ang + 0.7 * np.maximum(0.0, -sin_ang) + 0.45 * (right_clear - left_clear) - front_blocked * 0.5

        decay = max(0.22, 1.0 / (1.0 + 0.0005 * self.training_steps))
        prior *= decay
        return prior[0] if single else prior

    def _softmax(self, x: np.ndarray) -> np.ndarray:
        e_x = np.exp(x - np.max(x, axis=-1, keepdims=True))
        return e_x / (np.sum(e_x, axis=-1, keepdims=True) + 1e-8)

    def forward_actor(self, s: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Actor forward pass"""
        h1 = np.tanh(np.dot(s, self.w1_pi) + self.b1_pi)
        logits = np.dot(h1, self.w2_pi) + self.b2_pi + self._navigation_prior(s)
        probs = self._softmax(logits)
        return probs, h1

    def forward_critic(self, s: np.ndarray, target: bool = False) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """Forward pass cả 2 mạng Twin Critics Q1 và Q2"""
        w1_1 = self.w1_q1_tgt if target else self.w1_q1
        b1_1 = self.b1_q1_tgt if target else self.b1_q1
        w2_1 = self.w2_q1_tgt if target else self.w2_q1
        b2_1 = self.b2_q1_tgt if target else self.b2_q1

        w1_2 = self.w1_q2_tgt if target else self.w1_q2
        b1_2 = self.b1_q2_tgt if target else self.b1_q2
        w2_2 = self.w2_q2_tgt if target else self.w2_q2
        b2_2 = self.b2_q2_tgt if target else self.b2_q2

        h1_q1 = np.maximum(0.0, np.dot(s, w1_1) + b1_1)
        q1_vals = np.dot(h1_q1, w2_1) + b2_1

        h1_q2 = np.maximum(0.0, np.dot(s, w1_2) + b1_2)
        q2_vals = np.dot(h1_q2, w2_2) + b2_2

        return q1_vals, h1_q1, q2_vals, h1_q2

    def choose_action(self, obs: Dict[str, Any], greedy: bool = False) -> int:
        """Chọn hành động dựa trên xác suất Actor Maximum Entropy"""
        s = self.extract_state_vector(obs)
        probs, _ = self.forward_actor(s)

        if greedy:
            return int(np.argmax(probs))
        return int(np.random.choice(self.num_actions, p=probs))

    def record_step(self, obs: Dict[str, Any], action: int, reward: float, next_obs: Dict[str, Any], done: bool):
        s = self.extract_state_vector(obs)
        s_next = self.extract_state_vector(next_obs)
        transition = (s, action, reward, s_next, done)
        self.replay_buffer.append(transition)
        if len(self.replay_buffer) > self.buffer_size:
            self.replay_buffer.pop(0)

        # Lưu thêm các bước quan trọng (về đích, thưởng cao, hoặc va chạm) vào Priority Buffer
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

    def learn_step(self) -> float:
        """Học 1 batch từ Replay Buffer bằng Discrete SAC Bellman Update"""
        if len(self.replay_buffer) < self.batch_size:
            return 0.0

        self.t += 1
        self.training_steps += 1
        batch = self._sample_batch()
        bs = len(batch)

        s_batch = np.array([b[0] for b in batch], dtype=np.float32)
        a_batch = np.array([b[1] for b in batch], dtype=np.int32)
        r_batch = np.array([b[2] for b in batch], dtype=np.float32)
        s_next_batch = np.array([b[3] for b in batch], dtype=np.float32)
        done_batch = np.array([b[4] for b in batch], dtype=np.float32)

        # 1. Tính Target Value với Entropy:
        next_probs, _ = self.forward_actor(s_next_batch)
        next_q1_tgt, _, next_q2_tgt, _ = self.forward_critic(s_next_batch, target=True)
        next_min_q = np.minimum(next_q1_tgt, next_q2_tgt)

        next_log_probs = np.log(np.maximum(1e-8, next_probs))
        next_v = np.sum(next_probs * (next_min_q - self.alpha * next_log_probs), axis=1)
        targets = r_batch + (1.0 - done_batch) * self.gamma * next_v

        # 2. Cập nhật Critic 1 và Critic 2 qua Huber-clipped MSE loss
        q1_vals, h1_q1, q2_vals, h1_q2 = self.forward_critic(s_batch, target=False)
        grad_out_q1 = np.zeros_like(q1_vals)
        grad_out_q2 = np.zeros_like(q2_vals)

        idx = np.arange(bs)
        td_err1 = q1_vals[idx, a_batch] - targets
        td_err2 = q2_vals[idx, a_batch] - targets
        grad_out_q1[idx, a_batch] = np.clip(td_err1, -15.0, 15.0) / bs
        grad_out_q2[idx, a_batch] = np.clip(td_err2, -15.0, 15.0) / bs

        # Backprop Q1
        dw2_q1 = np.dot(h1_q1.T, grad_out_q1)
        db2_q1 = np.sum(grad_out_q1, axis=0)
        dh1_q1 = np.dot(grad_out_q1, self.w2_q1.T) * (h1_q1 > 0)
        dw1_q1 = np.dot(s_batch.T, dh1_q1)
        db1_q1 = np.sum(dh1_q1, axis=0)

        # Backprop Q2
        dw2_q2 = np.dot(h1_q2.T, grad_out_q2)
        db2_q2 = np.sum(grad_out_q2, axis=0)
        dh1_q2 = np.dot(grad_out_q2, self.w2_q2.T) * (h1_q2 > 0)
        dw1_q2 = np.dot(s_batch.T, dh1_q2)
        db1_q2 = np.sum(dh1_q2, axis=0)

        # 3. Cập nhật Actor với Normalized Q-Advantage (chống bão hòa softmax khi Q lớn)
        probs, h1_pi = self.forward_actor(s_batch)
        min_q = np.minimum(q1_vals, q2_vals)
        v_baseline = np.sum(probs * min_q, axis=1, keepdims=True)
        q_adv = min_q - v_baseline
        q_scale = np.maximum(1.0, np.std(q_adv, axis=1, keepdims=True) + 1e-5)
        norm_q_adv = q_adv / q_scale

        log_probs = np.log(np.maximum(1e-8, probs))
        actor_objective = self.alpha * log_probs - norm_q_adv
        grad_logits = (probs * (actor_objective - np.sum(probs * actor_objective, axis=1, keepdims=True))) / bs

        dw2_pi = np.dot(h1_pi.T, grad_logits)
        db2_pi = np.sum(grad_logits, axis=0)
        dh1_pi = np.dot(grad_logits, self.w2_pi.T) * (1.0 - h1_pi ** 2)
        dw1_pi = np.dot(s_batch.T, dh1_pi)
        db1_pi = np.sum(dh1_pi, axis=0)

        # Adam Update
        self._adam_step(self.w1_q1, dw1_q1, self.m_w1_q1, self.v_w1_q1, self.lr_critic)
        self._adam_step(self.b1_q1, db1_q1, self.m_b1_q1, self.v_b1_q1, self.lr_critic)
        self._adam_step(self.w2_q1, dw2_q1, self.m_w2_q1, self.v_w2_q1, self.lr_critic)
        self._adam_step(self.b2_q1, db2_q1, self.m_b2_q1, self.v_b2_q1, self.lr_critic)

        self._adam_step(self.w1_q2, dw1_q2, self.m_w1_q2, self.v_w1_q2, self.lr_critic)
        self._adam_step(self.b1_q2, db1_q2, self.m_b1_q2, self.v_b1_q2, self.lr_critic)
        self._adam_step(self.w2_q2, dw2_q2, self.m_w2_q2, self.v_w2_q2, self.lr_critic)
        self._adam_step(self.b2_q2, db2_q2, self.m_b2_q2, self.v_b2_q2, self.lr_critic)

        self._adam_step(self.w1_pi, dw1_pi, self.m_w1_pi, self.v_w1_pi, self.lr_actor)
        self._adam_step(self.b1_pi, db1_pi, self.m_b1_pi, self.v_b1_pi, self.lr_actor)
        self._adam_step(self.w2_pi, dw2_pi, self.m_w2_pi, self.v_w2_pi, self.lr_actor)
        self._adam_step(self.b2_pi, db2_pi, self.m_b2_pi, self.v_b2_pi, self.lr_actor)

        # Giảm nhẹ alpha theo thời gian để hội tụ chính xác
        self.alpha = max(0.04, self.alpha * 0.9997)

        # Polyak Soft-Update Target Critics
        self.w1_q1_tgt = self.tau * self.w1_q1 + (1.0 - self.tau) * self.w1_q1_tgt
        self.b1_q1_tgt = self.tau * self.b1_q1 + (1.0 - self.tau) * self.b1_q1_tgt
        self.w2_q1_tgt = self.tau * self.w2_q1 + (1.0 - self.tau) * self.w2_q1_tgt
        self.b2_q1_tgt = self.tau * self.b2_q1 + (1.0 - self.tau) * self.b2_q1_tgt

        self.w1_q2_tgt = self.tau * self.w1_q2 + (1.0 - self.tau) * self.w1_q2_tgt
        self.b1_q2_tgt = self.tau * self.b1_q2 + (1.0 - self.tau) * self.b1_q2_tgt
        self.w2_q2_tgt = self.tau * self.w2_q2 + (1.0 - self.tau) * self.w2_q2_tgt
        self.b2_q2_tgt = self.tau * self.b2_q2 + (1.0 - self.tau) * self.b2_q2_tgt

        return float(np.mean(td_err1 ** 2))

    def _adam_step(self, param: np.ndarray, grad: np.ndarray, m: np.ndarray, v: np.ndarray, lr: float):
        beta1, beta2, eps = 0.9, 0.999, 1e-8
        grad = np.clip(grad, -2.0, 2.0)
        m[:] = beta1 * m + (1.0 - beta1) * grad
        v[:] = beta2 * v + (1.0 - beta2) * (grad ** 2)
        m_hat = m / (1.0 - (beta1 ** self.t))
        v_hat = v / (1.0 - (beta2 ** self.t))
        param -= lr * m_hat / (np.sqrt(v_hat) + eps)

    def export_policy(self) -> Dict[str, Any]:
        return {
            "algorithm": "sac",
            "algorithm_name": "Soft Actor-Critic (SAC)",
            "alpha": float(self.alpha),
            "weights": {
                "w1_pi": self.w1_pi.tolist(),
                "b1_pi": self.b1_pi.tolist(),
                "w2_pi": self.w2_pi.tolist(),
                "b2_pi": self.b2_pi.tolist()
            }
        }

    def load_policy(self, data: Dict[str, Any]):
        w = data.get("weights", {})
        if "w1_pi" in w:
            w1_arr = np.array(w["w1_pi"], dtype=np.float32)
            if w1_arr.shape[1] != self.hidden_dim:
                self._init_networks(int(w1_arr.shape[1]))
            self.w1_pi = w1_arr
            self.b1_pi = np.array(w["b1_pi"], dtype=np.float32)
            self.w2_pi = np.array(w["w2_pi"], dtype=np.float32)
            self.b2_pi = np.array(w["b2_pi"], dtype=np.float32)
        if "alpha" in data:
            loaded_alpha = float(data["alpha"])
            self.alpha = loaded_alpha if 0.01 <= loaded_alpha <= 2.0 else 0.15
