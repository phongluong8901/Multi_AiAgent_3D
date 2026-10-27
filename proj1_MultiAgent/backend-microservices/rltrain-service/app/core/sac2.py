import math
import random
from typing import Dict, Any, List, Tuple
import numpy as np


class SACAgent:
    """
    Discrete Soft Actor-Critic (SAC) - Improved Version
    
    Cải tiến chính:
    - Learnable temperature α (tự động điều chỉnh entropy)
    - Target entropy tự động theo số action
    - Twin Critics + Soft Polyak update (τ = 0.005)
    - Network size tăng nhẹ (64)
    - Gradient clipping mạnh hơn
    - Buffer lớn hơn (8000)
    
    Input: Continuous 13-dim state
    Output: 6 discrete actions
    """
    def __init__(
        self,
        state_dim: int = 13,
        num_actions: int = 6,
        hidden_dim: int = 64,
        lr_actor: float = 0.001,
        lr_critic: float = 0.002,
        lr_alpha: float = 0.001,
        gamma: float = 0.99,
        tau: float = 0.005,
        alpha: float = 0.2,          # initial alpha
        auto_alpha: bool = True,    # bật học α
        buffer_size: int = 8000,
        batch_size: int = 64
    ):
        self.state_dim = state_dim
        self.num_actions = num_actions
        self.hidden_dim = hidden_dim
        self.gamma = gamma
        self.tau = tau
        self.lr_actor = lr_actor
        self.lr_critic = lr_critic
        self.lr_alpha = lr_alpha
        self.batch_size = batch_size
        self.buffer_size = buffer_size
        self.auto_alpha = auto_alpha

        # Target entropy cho Discrete SAC (khuyến nghị)
        # target_entropy ≈ -0.98 * log(1 / num_actions)
        self.target_entropy = -0.98 * np.log(1.0 / num_actions)

        # Log-alpha (học ở log-space để alpha luôn > 0)
        self.log_alpha = np.array([np.log(alpha)], dtype=np.float32)
        self.alpha = float(alpha)

        # ==================== Networks ====================
        # Actor (Policy)
        self.w1_pi = self._xavier(state_dim, hidden_dim)
        self.b1_pi = np.zeros(hidden_dim, dtype=np.float32)
        self.w2_pi = self._xavier(hidden_dim, num_actions)
        self.b2_pi = np.zeros(num_actions, dtype=np.float32)

        # Critic 1
        self.w1_q1 = self._he(state_dim, hidden_dim)
        self.b1_q1 = np.zeros(hidden_dim, dtype=np.float32)
        self.w2_q1 = self._xavier(hidden_dim, num_actions)
        self.b2_q1 = np.zeros(num_actions, dtype=np.float32)

        # Critic 2
        self.w1_q2 = self._he(state_dim, hidden_dim)
        self.b1_q2 = np.zeros(hidden_dim, dtype=np.float32)
        self.w2_q2 = self._xavier(hidden_dim, num_actions)
        self.b2_q2 = np.zeros(num_actions, dtype=np.float32)

        # Target Critics
        self.w1_q1_tgt = np.copy(self.w1_q1)
        self.b1_q1_tgt = np.copy(self.b1_q1)
        self.w2_q1_tgt = np.copy(self.w2_q1)
        self.b2_q1_tgt = np.copy(self.b2_q1)

        self.w1_q2_tgt = np.copy(self.w1_q2)
        self.b1_q2_tgt = np.copy(self.b1_q2)
        self.w2_q2_tgt = np.copy(self.w2_q2)
        self.b2_q2_tgt = np.copy(self.b2_q2)

        # Adam moments
        self._init_adam_moments()

        self.t = 0
        self.replay_buffer: List[Tuple[np.ndarray, int, float, np.ndarray, bool]] = []
        self.training_steps = 0

    # ==================== Helpers ====================
    def _xavier(self, fan_in: int, fan_out: int) -> np.ndarray:
        limit = np.sqrt(6.0 / (fan_in + fan_out))
        return np.random.uniform(-limit, limit, (fan_in, fan_out)).astype(np.float32)

    def _he(self, fan_in: int, fan_out: int) -> np.ndarray:
        std = np.sqrt(2.0 / fan_in)
        return (np.random.randn(fan_in, fan_out) * std).astype(np.float32)

    def _init_adam_moments(self):
        params = [
            "w1_pi", "b1_pi", "w2_pi", "b2_pi",
            "w1_q1", "b1_q1", "w2_q1", "b2_q1",
            "w1_q2", "b1_q2", "w2_q2", "b2_q2",
            "log_alpha"
        ]
        for name in params:
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

    def _softmax(self, x: np.ndarray) -> np.ndarray:
        e_x = np.exp(x - np.max(x, axis=-1, keepdims=True))
        return e_x / (np.sum(e_x, axis=-1, keepdims=True) + 1e-8)

    # ==================== Forward ====================
    def forward_actor(self, s: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        h1 = np.tanh(np.dot(s, self.w1_pi) + self.b1_pi)
        logits = np.dot(h1, self.w2_pi) + self.b2_pi
        probs = self._softmax(logits)
        return probs, h1

    def forward_critic(self, s: np.ndarray, target: bool = False) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        if target:
            w1_1, b1_1, w2_1, b2_1 = self.w1_q1_tgt, self.b1_q1_tgt, self.w2_q1_tgt, self.b2_q1_tgt
            w1_2, b1_2, w2_2, b2_2 = self.w1_q2_tgt, self.b1_q2_tgt, self.w2_q2_tgt, self.b2_q2_tgt
        else:
            w1_1, b1_1, w2_1, b2_1 = self.w1_q1, self.b1_q1, self.w2_q1, self.b2_q1
            w1_2, b1_2, w2_2, b2_2 = self.w1_q2, self.b1_q2, self.w2_q2, self.b2_q2

        h1_q1 = np.maximum(0.0, np.dot(s, w1_1) + b1_1)  # ReLU
        q1 = np.dot(h1_q1, w2_1) + b2_1

        h1_q2 = np.maximum(0.0, np.dot(s, w1_2) + b1_2)
        q2 = np.dot(h1_q2, w2_2) + b2_2

        return q1, h1_q1, q2, h1_q2

    # ==================== Action Selection ====================
    def choose_action(self, obs: Dict[str, Any], greedy: bool = False) -> int:
        s = self.extract_state_vector(obs)
        probs, _ = self.forward_actor(s)

        if greedy:
            return int(np.argmax(probs))
        return int(np.random.choice(self.num_actions, p=probs))

    def record_step(self, obs: Dict[str, Any], action: int, reward: float, next_obs: Dict[str, Any], done: bool):
        s = self.extract_state_vector(obs)
        s_next = self.extract_state_vector(next_obs)
        self.replay_buffer.append((s, action, reward, s_next, done))
        if len(self.replay_buffer) > self.buffer_size:
            self.replay_buffer.pop(0)

    # ==================== Learn ====================
    def learn_step(self) -> float:
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

        # ---------- 1. Target Value với Entropy ----------
        next_probs, _ = self.forward_actor(s_next_batch)
        next_q1, _, next_q2, _ = self.forward_critic(s_next_batch, target=True)
        next_min_q = np.minimum(next_q1, next_q2)

        next_log_probs = np.log(np.maximum(next_probs, 1e-8))
        next_v = np.sum(next_probs * (next_min_q - self.alpha * next_log_probs), axis=1)
        targets = r_batch + (1.0 - done_batch) * self.gamma * next_v

        # ---------- 2. Update Critics ----------
        q1, h1_q1, q2, h1_q2 = self.forward_critic(s_batch, target=False)

        grad_out_q1 = np.zeros_like(q1)
        grad_out_q2 = np.zeros_like(q2)
        for i in range(self.batch_size):
            a = a_batch[i]
            grad_out_q1[i, a] = (q1[i, a] - targets[i]) / self.batch_size
            grad_out_q2[i, a] = (q2[i, a] - targets[i]) / self.batch_size

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

        # ---------- 3. Update Actor ----------
        probs, h1_pi = self.forward_actor(s_batch)
        min_q = np.minimum(q1, q2)          # dùng current Q
        log_probs = np.log(np.maximum(probs, 1e-8))

        # Actor loss: E[ α * logπ - Q ]
        actor_obj = self.alpha * log_probs - min_q
        # Gradient của softmax
        grad_logits = probs * (actor_obj - np.sum(probs * actor_obj, axis=1, keepdims=True))
        grad_logits /= self.batch_size

        dw2_pi = np.dot(h1_pi.T, grad_logits)
        db2_pi = np.sum(grad_logits, axis=0)
        dh1_pi = np.dot(grad_logits, self.w2_pi.T) * (1.0 - h1_pi ** 2)  # tanh'
        dw1_pi = np.dot(s_batch.T, dh1_pi)
        db1_pi = np.sum(dh1_pi, axis=0)

        # ---------- 4. Update Alpha (nếu bật) ----------
        if self.auto_alpha:
            # Loss_alpha = -α * (logπ + target_entropy)
            # Gradient w.r.t log_alpha
            entropy = -np.sum(probs * log_probs, axis=1)
            alpha_loss_grad = np.mean(self.log_alpha * (entropy - self.target_entropy))
            # Thực tế ta minimize: E[-α * (logπ + H_target)] → grad = -(entropy - target)
            d_log_alpha = -np.mean(entropy - self.target_entropy)
            self._adam_step(self.log_alpha, np.array([d_log_alpha]), 
                            self.m_log_alpha, self.v_log_alpha, self.lr_alpha)
            self.alpha = float(np.exp(self.log_alpha[0]))

        # ---------- 5. Adam updates ----------
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

        # ---------- 6. Soft update targets ----------
        self._soft_update()

        # Trả về MSE loss của Q1 để monitor
        return float(np.mean((q1[np.arange(self.batch_size), a_batch] - targets) ** 2))

    def _soft_update(self):
        tau = self.tau
        self.w1_q1_tgt = tau * self.w1_q1 + (1 - tau) * self.w1_q1_tgt
        self.b1_q1_tgt = tau * self.b1_q1 + (1 - tau) * self.b1_q1_tgt
        self.w2_q1_tgt = tau * self.w2_q1 + (1 - tau) * self.w2_q1_tgt
        self.b2_q1_tgt = tau * self.b2_q1 + (1 - tau) * self.b2_q1_tgt

        self.w1_q2_tgt = tau * self.w1_q2 + (1 - tau) * self.w1_q2_tgt
        self.b1_q2_tgt = tau * self.b1_q2 + (1 - tau) * self.b1_q2_tgt
        self.w2_q2_tgt = tau * self.w2_q2 + (1 - tau) * self.w2_q2_tgt
        self.b2_q2_tgt = tau * self.b2_q2 + (1 - tau) * self.b2_q2_tgt

    def _adam_step(self, param: np.ndarray, grad: np.ndarray, m: np.ndarray, v: np.ndarray, lr: float):
        beta1, beta2, eps = 0.9, 0.999, 1e-8
        # Gradient clipping
        grad = np.clip(grad, -5.0, 5.0)
        m[:] = beta1 * m + (1 - beta1) * grad
        v[:] = beta2 * v + (1 - beta2) * (grad ** 2)
        m_hat = m / (1 - beta1 ** self.t)
        v_hat = v / (1 - beta2 ** self.t)
        param -= lr * m_hat / (np.sqrt(v_hat) + eps)

    # ==================== Save / Load ====================
    def export_policy(self) -> Dict[str, Any]:
        return {
            "algorithm": "sac",
            "algorithm_name": "Soft Actor-Critic (SAC) - Improved",
            "alpha": float(self.alpha),
            "log_alpha": float(self.log_alpha[0]),
            "target_entropy": float(self.target_entropy),
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
            self.log_alpha = np.array([np.log(self.alpha)], dtype=np.float32)
        if "log_alpha" in data:
            self.log_alpha = np.array([float(data["log_alpha"])], dtype=np.float32)
            self.alpha = float(np.exp(self.log_alpha[0]))