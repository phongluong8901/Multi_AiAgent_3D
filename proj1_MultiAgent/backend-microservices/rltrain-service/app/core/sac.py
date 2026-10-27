import math
import random
from typing import Dict, Any, List, Tuple
import numpy as np

class SACAgent:
    """
    Discrete Soft Actor-Critic (SAC) with Maximum Entropy Reinforcement Learning.
    
    Architecture:
    - Twin Critics (Q1, Q2): Alleviates positive bias in Q-learning (Clipped Double Q)
    - Target Twin Critics (Q1_target, Q2_target): Polyak soft-update (tau = 0.01)
    - Actor Network (Policy pi): Outputs categorical distribution over discrete actions
    - Temperature alpha: Balances reward maximization and entropy exploration
    - Experience Replay Buffer: 4000 transitions
    
    Input: Continuous 13-dim state vector
    Output: 6 discrete navigation actions
    """
    def __init__(
        self,
        state_dim: int = 13,
        num_actions: int = 6,
        hidden_dim: int = 48,
        lr_actor: float = 0.003,
        lr_critic: float = 0.005,
        gamma: float = 0.95,
        tau: float = 0.02,
        alpha: float = 0.2,
        buffer_size: int = 4000,
        batch_size: int = 32
    ):
        self.state_dim = state_dim
        self.num_actions = num_actions
        self.hidden_dim = hidden_dim
        self.gamma = gamma
        self.tau = tau
        self.alpha = alpha  # Entropy temperature
        self.lr_actor = lr_actor
        self.lr_critic = lr_critic
        self.batch_size = batch_size
        self.buffer_size = buffer_size

        # 1. Actor Network (Policy: s -> action distribution)
        self.w1_pi = np.random.randn(state_dim, hidden_dim) * np.sqrt(2.0 / (state_dim + hidden_dim))
        self.b1_pi = np.zeros(hidden_dim)
        self.w2_pi = np.random.randn(hidden_dim, num_actions) * np.sqrt(2.0 / (hidden_dim + num_actions))
        self.b2_pi = np.zeros(num_actions)

        # 2. Critic 1 Network (s -> Q1(s, a))
        self.w1_q1 = np.random.randn(state_dim, hidden_dim) * np.sqrt(2.0 / (state_dim + hidden_dim))
        self.b1_q1 = np.zeros(hidden_dim)
        self.w2_q1 = np.random.randn(hidden_dim, num_actions) * np.sqrt(2.0 / (hidden_dim + num_actions))
        self.b2_q1 = np.zeros(num_actions)

        # 3. Critic 2 Network (s -> Q2(s, a))
        self.w1_q2 = np.random.randn(state_dim, hidden_dim) * np.sqrt(2.0 / (state_dim + hidden_dim))
        self.b1_q2 = np.zeros(hidden_dim)
        self.w2_q2 = np.random.randn(hidden_dim, num_actions) * np.sqrt(2.0 / (hidden_dim + num_actions))
        self.b2_q2 = np.zeros(num_actions)

        # Target Critics (Q1_target, Q2_target)
        self.w1_q1_tgt = np.copy(self.w1_q1)
        self.b1_q1_tgt = np.copy(self.b1_q1)
        self.w2_q1_tgt = np.copy(self.w2_q1)
        self.b2_q1_tgt = np.copy(self.b2_q1)

        self.w1_q2_tgt = np.copy(self.w1_q2)
        self.b1_q2_tgt = np.copy(self.b1_q2)
        self.w2_q2_tgt = np.copy(self.w2_q2)
        self.b2_q2_tgt = np.copy(self.b2_q2)

        # Adam Optimizer moments
        self.m_w1_pi, self.v_w1_pi = np.zeros_like(self.w1_pi), np.zeros_like(self.w1_pi)
        self.m_b1_pi, self.v_b1_pi = np.zeros_like(self.b1_pi), np.zeros_like(self.b1_pi)
        self.m_w2_pi, self.v_w2_pi = np.zeros_like(self.w2_pi), np.zeros_like(self.w2_pi)
        self.m_b2_pi, self.v_b2_pi = np.zeros_like(self.b2_pi), np.zeros_like(self.b2_pi)

        self.m_w1_q1, self.v_w1_q1 = np.zeros_like(self.w1_q1), np.zeros_like(self.w1_q1)
        self.m_b1_q1, self.v_b1_q1 = np.zeros_like(self.b1_q1), np.zeros_like(self.b1_q1)
        self.m_w2_q1, self.v_w2_q1 = np.zeros_like(self.w2_q1), np.zeros_like(self.w2_q1)
        self.m_b2_q1, self.v_b2_q1 = np.zeros_like(self.b2_q1), np.zeros_like(self.b2_q1)

        self.m_w1_q2, self.v_w1_q2 = np.zeros_like(self.w1_q2), np.zeros_like(self.w1_q2)
        self.m_b1_q2, self.v_b1_q2 = np.zeros_like(self.b1_q2), np.zeros_like(self.b1_q2)
        self.m_w2_q2, self.v_w2_q2 = np.zeros_like(self.w2_q2), np.zeros_like(self.w2_q2)
        self.m_b2_q2, self.v_b2_q2 = np.zeros_like(self.b2_q2), np.zeros_like(self.b2_q2)

        self.t = 0
        self.replay_buffer: List[Tuple[np.ndarray, int, float, np.ndarray, bool]] = []
        self.training_steps = 0

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

    def _softmax(self, x: np.ndarray) -> np.ndarray:
        e_x = np.exp(x - np.max(x, axis=-1, keepdims=True))
        return e_x / np.sum(e_x, axis=-1, keepdims=True)

    def forward_actor(self, s: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Actor forward pass"""
        h1 = np.tanh(np.dot(s, self.w1_pi) + self.b1_pi)
        logits = np.dot(h1, self.w2_pi) + self.b2_pi
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

        h1_q1 = np.maximum(0.0, np.dot(s, w1_1) + b1_1)  # ReLU
        q1_vals = np.dot(h1_q1, w2_1) + b2_1

        h1_q2 = np.maximum(0.0, np.dot(s, w1_2) + b1_2)  # ReLU
        q2_vals = np.dot(h1_q2, w2_2) + b2_2

        return q1_vals, h1_q1, q2_vals, h1_q2

    def choose_action(self, obs: Dict[str, Any], greedy: bool = False) -> int:
        """Chọn hành động dựa trên xác suất Actor Maximum Entropy"""
        s = self.extract_state_vector(obs)
        probs, _ = self.forward_actor(s)

        if greedy:
            return int(np.argmax(probs))

        # Lấy mẫu phân phối softmax có entropy
        return int(np.random.choice(self.num_actions, p=probs))

    def record_step(self, obs: Dict[str, Any], action: int, reward: float, next_obs: Dict[str, Any], done: bool):
        s = self.extract_state_vector(obs)
        s_next = self.extract_state_vector(next_obs)
        self.replay_buffer.append((s, action, reward, s_next, done))
        if len(self.replay_buffer) > self.buffer_size:
            self.replay_buffer.pop(0)

    def learn_step(self) -> float:
        """Học 1 batch từ Replay Buffer bằng Discrete SAC Bellman Update"""
        if len(self.replay_buffer) < self.batch_size:
            return 0.0

        self.t += 1
        self.training_steps += 1
        batch = random.sample(self.replay_buffer, self.batch_size)

        s_batch = np.array([b[0] for b in batch], dtype=np.float32)
        a_batch = np.array([b[1] for b in batch], dtype=np.int32)
        r_batch = np.array([b[2] for b in batch], dtype=np.float32)
        s_next_batch = np.array([b[3] for b in batch], dtype=np.float32)
        done_batch = np.array([b[4] for b in batch], dtype=np.float32)

        # 1. Tính Target Value với Entropy:
        # V(s') = sum_a' pi(a'|s') * [min(Q1_tgt, Q2_tgt) - alpha * log(pi(a'|s'))]
        next_probs, _ = self.forward_actor(s_next_batch)
        next_q1_tgt, _, next_q2_tgt, _ = self.forward_critic(s_next_batch, target=True)
        next_min_q = np.minimum(next_q1_tgt, next_q2_tgt)

        next_log_probs = np.log(np.maximum(1e-8, next_probs))
        # Kỳ vọng Value tại trạng thái kế tiếp
        next_v = np.sum(next_probs * (next_min_q - self.alpha * next_log_probs), axis=1)
        targets = r_batch + (1.0 - done_batch) * self.gamma * next_v

        # 2. Cập nhật Critic 1 và Critic 2 qua MSE loss
        q1_vals, h1_q1, q2_vals, h1_q2 = self.forward_critic(s_batch, target=False)
        grad_out_q1 = np.zeros_like(q1_vals)
        grad_out_q2 = np.zeros_like(q2_vals)

        for i in range(self.batch_size):
            a = a_batch[i]
            grad_out_q1[i, a] = (q1_vals[i, a] - targets[i]) / self.batch_size
            grad_out_q2[i, a] = (q2_vals[i, a] - targets[i]) / self.batch_size

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

        # 3. Cập nhật Actor:
        # Tối đa hóa: sum_a pi(a|s) * [min(Q1, Q2) - alpha * log(pi(a|s))]
        probs, h1_pi = self.forward_actor(s_batch)
        min_q = np.minimum(q1_vals, q2_vals)
        log_probs = np.log(np.maximum(1e-8, probs))

        # Actor Objective: L_pi = sum_a pi(a|s) * (alpha * log(pi(a|s)) - min_q)
        actor_objective = self.alpha * log_probs - min_q
        grad_logits = (probs * (actor_objective - np.sum(probs * actor_objective, axis=1, keepdims=True))) / self.batch_size

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

        # Polyak Soft-Update Target Critics: theta_tgt = tau * theta + (1 - tau) * theta_tgt
        self.w1_q1_tgt = self.tau * self.w1_q1 + (1.0 - self.tau) * self.w1_q1_tgt
        self.b1_q1_tgt = self.tau * self.b1_q1 + (1.0 - self.tau) * self.b1_q1_tgt
        self.w2_q1_tgt = self.tau * self.w2_q1 + (1.0 - self.tau) * self.w2_q1_tgt
        self.b2_q1_tgt = self.tau * self.b2_q1 + (1.0 - self.tau) * self.b2_q1_tgt

        self.w1_q2_tgt = self.tau * self.w1_q2 + (1.0 - self.tau) * self.w1_q2_tgt
        self.b1_q2_tgt = self.tau * self.b1_q2 + (1.0 - self.tau) * self.b1_q2_tgt
        self.w2_q2_tgt = self.tau * self.w2_q2 + (1.0 - self.tau) * self.w2_q2_tgt
        self.b2_q2_tgt = self.tau * self.b2_q2 + (1.0 - self.tau) * self.b2_q2_tgt

        return float(np.mean((q1_vals - targets[:, None]) ** 2))

    def _adam_step(self, param: np.ndarray, grad: np.ndarray, m: np.ndarray, v: np.ndarray, lr: float):
        beta1, beta2, eps = 0.9, 0.999, 1e-8
        grad = np.clip(grad, -1.0, 1.0)
        m[:] = beta1 * m + (1.0 - beta1) * grad
        v[:] = beta2 * v + (1.0 - beta2) * (grad ** 2)
        m_hat = m / (1.0 - (beta1 ** self.t))
        v_hat = v / (1.0 - (beta2 ** self.t))
        param -= lr * m_hat / (np.sqrt(v_hat) + eps)

    def export_policy(self) -> Dict[str, Any]:
        return {
            "algorithm": "sac",
            "algorithm_name": "Soft Actor-Critic (SAC)",
            "alpha": self.alpha,
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
            self.w1_pi = np.array(w["w1_pi"], dtype=np.float32)
            self.b1_pi = np.array(w["b1_pi"], dtype=np.float32)
            self.w2_pi = np.array(w["w2_pi"], dtype=np.float32)
            self.b2_pi = np.array(w["b2_pi"], dtype=np.float32)
        if "alpha" in data:
            self.alpha = float(data["alpha"])
