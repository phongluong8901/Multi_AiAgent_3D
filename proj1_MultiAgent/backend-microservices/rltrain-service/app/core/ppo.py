import math
import json
import random
from typing import Dict, Any, List, Tuple
import numpy as np

class PPOAgent:
    """
    Proximal Policy Optimization (PPO) with Actor-Critic Architecture
    using NumPy vectorization and Adam Optimizer.
    
    Continuous 13-dim state observation:
    - rel_dist: normalized distance to goal
    - cos_angle, sin_angle: relative angle to goal
    - cos_heading, sin_heading: agent heading
    - 8 normalized lidar beams
    
    Actor outputs categorical distribution over 6 navigation actions.
    Critic outputs baseline state value V(s).
    """
    def __init__(
        self,
        state_dim: int = 13,
        num_actions: int = 6,
        hidden_dim: int = 48,
        lr_actor: float = 0.003,
        lr_critic: float = 0.005,
        gamma: float = 0.95,
        clip_ratio: float = 0.2,
        entropy_coef: float = 0.01
    ):
        self.state_dim = state_dim
        self.num_actions = num_actions
        self.hidden_dim = hidden_dim
        self.gamma = gamma
        self.clip_ratio = clip_ratio
        self.entropy_coef = entropy_coef

        # 1. Khởi tạo trọng số Actor Network (Policy: s -> action probabilities)
        # Xavier / Glorot Initialization
        self.w1_a = np.random.randn(state_dim, hidden_dim) * np.sqrt(2.0 / (state_dim + hidden_dim))
        self.b1_a = np.zeros(hidden_dim)
        self.w2_a = np.random.randn(hidden_dim, num_actions) * np.sqrt(2.0 / (hidden_dim + num_actions))
        self.b2_a = np.zeros(num_actions)

        # 2. Khởi tạo trọng số Critic Network (Value: s -> scalar V)
        self.w1_c = np.random.randn(state_dim, hidden_dim) * np.sqrt(2.0 / (state_dim + hidden_dim))
        self.b1_c = np.zeros(hidden_dim)
        self.w2_c = np.random.randn(hidden_dim, 1) * np.sqrt(2.0 / (hidden_dim + 1))
        self.b2_c = np.zeros(1)

        # Adam Optimizer moments (m, v)
        self.m_w1_a, self.v_w1_a = np.zeros_like(self.w1_a), np.zeros_like(self.w1_a)
        self.m_b1_a, self.v_b1_a = np.zeros_like(self.b1_a), np.zeros_like(self.b1_a)
        self.m_w2_a, self.v_w2_a = np.zeros_like(self.w2_a), np.zeros_like(self.w2_a)
        self.m_b2_a, self.v_b2_a = np.zeros_like(self.b2_a), np.zeros_like(self.b2_a)

        self.m_w1_c, self.v_w1_c = np.zeros_like(self.w1_c), np.zeros_like(self.w1_c)
        self.m_b1_c, self.v_b1_c = np.zeros_like(self.b1_c), np.zeros_like(self.b1_c)
        self.m_w2_c, self.v_w2_c = np.zeros_like(self.w2_c), np.zeros_like(self.w2_c)
        self.m_b2_c, self.v_b2_c = np.zeros_like(self.b2_c), np.zeros_like(self.b2_c)

        self.lr_actor = lr_actor
        self.lr_critic = lr_critic
        self.t = 0  # Adam step counter

        # Trajectory buffer cho batch update
        self.states: List[np.ndarray] = []
        self.actions: List[int] = []
        self.rewards: List[float] = []
        self.old_log_probs: List[float] = []
        self.dones: List[bool] = []
        self.training_steps = 0

    def extract_state_vector(self, obs: Dict[str, Any]) -> np.ndarray:
        """Chuyển đổi quan sát liên tục thành vector 13 chiều chuẩn hóa"""
        agent = obs.get("agent", {})
        goal = obs.get("goal", {})
        lidar = obs.get("lidar", [8.0] * 8)

        heading = agent.get("heading", 0.0)
        dist = goal.get("distance", 10.0)
        angle_diff = goal.get("angle_diff", 0.0)

        # 5 đặc trưng mục tiêu & thân xe
        norm_dist = min(1.0, dist / 20.0)
        cos_ang = math.cos(angle_diff)
        sin_ang = math.sin(angle_diff)
        cos_hd = math.cos(heading)
        sin_hd = math.sin(heading)

        # 8 tia lidar chuẩn hóa [0, 1] (0 = sát nút va chạm, 1 = thoáng đãng)
        norm_lidar = [min(1.0, max(0.0, l / 8.0)) for l in lidar[:8]]
        while len(norm_lidar) < 8:
            norm_lidar.append(1.0)

        vec = np.array([norm_dist, cos_ang, sin_ang, cos_hd, sin_hd] + norm_lidar, dtype=np.float32)
        return vec

    def _softmax(self, x: np.ndarray) -> np.ndarray:
        e_x = np.exp(x - np.max(x))
        return e_x / np.sum(e_x)

    def forward_actor(self, s: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Forward pass Actor: s -> pi(a|s)"""
        h1 = np.tanh(np.dot(s, self.w1_a) + self.b1_a)
        logits = np.dot(h1, self.w2_a) + self.b2_a
        probs = self._softmax(logits)
        return probs, h1

    def forward_critic(self, s: np.ndarray) -> Tuple[float, np.ndarray]:
        """Forward pass Critic: s -> V(s)"""
        h1 = np.tanh(np.dot(s, self.w1_c) + self.b1_c)
        v = float(np.dot(h1, self.w2_c)[0] + self.b2_c[0])
        return v, h1

    def choose_action(self, obs: Dict[str, Any], greedy: bool = False) -> Tuple[int, float]:
        """Lấy action theo phân phối xác suất Actor của PPO"""
        s = self.extract_state_vector(obs)
        probs, _ = self.forward_actor(s)

        if greedy:
            action = int(np.argmax(probs))
            log_prob = float(np.log(max(1e-7, probs[action])))
            return action, log_prob

        # Lấy mẫu ngẫu nhiên theo xác suất phân phối
        action = int(np.random.choice(self.num_actions, p=probs))
        log_prob = float(np.log(max(1e-7, probs[action])))
        return action, log_prob

    def record_step(self, obs: Dict[str, Any], action: int, reward: float, done: bool, log_prob: float):
        """Lưu bước di chuyển vào buffer PPO"""
        s = self.extract_state_vector(obs)
        self.states.append(s)
        self.actions.append(action)
        self.rewards.append(reward)
        self.dones.append(done)
        self.old_log_probs.append(log_prob)

    def learn_episode(self) -> float:
        """Cập nhật PPO sau khi hoàn thành 1 hoặc nhiều episode"""
        if len(self.states) < 4:
            return 0.0

        n = len(self.states)
        # 1. Tính toán Discounted Returns G_t
        returns = np.zeros(n, dtype=np.float32)
        running_g = 0.0
        for t in reversed(range(n)):
            if self.dones[t]:
                running_g = 0.0
            running_g = self.rewards[t] + self.gamma * running_g
            returns[t] = running_g

        # 2. Tính toán Giá trị Baseline V(s) và Advantages A_t
        values = np.zeros(n, dtype=np.float32)
        for t in range(n):
            values[t], _ = self.forward_critic(self.states[t])

        advantages = returns - values
        # Chuẩn hóa Advantages để ổn định gradient
        std_adv = np.std(advantages)
        if std_adv > 1e-5:
            advantages = (advantages - np.mean(advantages)) / (std_adv + 1e-8)

        # 3. PPO Update qua 3 epochs
        self.t += 1
        beta1, beta2, eps = 0.9, 0.999, 1e-8
        total_loss = 0.0

        for _ in range(3):
            indices = list(range(n))
            random.shuffle(indices)

            for i in indices:
                s = self.states[i]
                a = self.actions[i]
                adv = advantages[i]
                ret = returns[i]
                old_log_p = self.old_log_probs[i]

                # Actor Forward
                probs, h1_a = self.forward_actor(s)
                new_log_p = np.log(max(1e-7, probs[a]))
                ratio = np.exp(new_log_p - old_log_p)

                # PPO Clipped Surrogate Loss
                surr1 = ratio * adv
                surr2 = np.clip(ratio, 1.0 - self.clip_ratio, 1.0 + self.clip_ratio) * adv
                actor_loss = -min(surr1, surr2)

                # Actor Gradient
                # dL/d(logits)
                d_logits = probs.copy()
                d_logits[a] -= 1.0  # Softmax cross entropy gradient
                # Trọng số bởi advantage clip
                d_logits *= (-adv if abs(ratio - 1.0) < self.clip_ratio else 0.0)

                # Gradient Actor layers
                gw2_a = np.outer(h1_a, d_logits)
                gb2_a = d_logits
                dh1_a = np.dot(d_logits, self.w2_a.T) * (1.0 - h1_a ** 2)
                gw1_a = np.outer(s, dh1_a)
                gb1_a = dh1_a

                # Adam Actor
                self.m_w1_a = beta1 * self.m_w1_a + (1 - beta1) * gw1_a
                self.v_w1_a = beta2 * self.v_w1_a + (1 - beta2) * (gw1_a ** 2)
                self.w1_a -= (self.lr_actor / (np.sqrt(self.v_w1_a) + eps)) * self.m_w1_a

                self.m_w2_a = beta1 * self.m_w2_a + (1 - beta1) * gw2_a
                self.v_w2_a = beta2 * self.v_w2_a + (1 - beta2) * (gw2_a ** 2)
                self.w2_a -= (self.lr_actor / (np.sqrt(self.v_w2_a) + eps)) * self.m_w2_a

                # Critic Forward & Loss
                v_pred, h1_c = self.forward_critic(s)
                critic_err = (v_pred - ret)

                # Critic Gradient
                d_v = critic_err
                gw2_c = np.outer(h1_c, [d_v])
                gb2_c = np.array([d_v])
                dh1_c = np.dot([d_v], self.w2_c.T)[0] * (1.0 - h1_c ** 2)
                gw1_c = np.outer(s, dh1_c)
                gb1_c = dh1_c

                # Adam Critic
                self.m_w1_c = beta1 * self.m_w1_c + (1 - beta1) * gw1_c
                self.v_w1_c = beta2 * self.v_w1_c + (1 - beta2) * (gw1_c ** 2)
                self.w1_c -= (self.lr_critic / (np.sqrt(self.v_w1_c) + eps)) * self.m_w1_c

                self.m_w2_c = beta1 * self.m_w2_c + (1 - beta1) * gw2_c
                self.v_w2_c = beta2 * self.v_w2_c + (1 - beta2) * (gw2_c ** 2)
                self.w2_c -= (self.lr_critic / (np.sqrt(self.v_w2_c) + eps)) * self.m_w2_c

                total_loss += actor_loss + 0.5 * (critic_err ** 2)

        # Xoá buffer sau khi update
        self.states.clear()
        self.actions.clear()
        self.rewards.clear()
        self.dones.clear()
        self.old_log_probs.clear()
        self.training_steps += 1
        return float(total_loss / max(1, n * 3))

    def export_policy(self) -> Dict[str, Any]:
        """Xuất mô hình PPO neural weights sang JSON để lưu trữ hoặc nạp lại"""
        return {
            "algorithm": "PPO",
            "state_dim": self.state_dim,
            "num_actions": self.num_actions,
            "hidden_dim": self.hidden_dim,
            "training_steps": self.training_steps,
            "weights": {
                "w1_a": self.w1_a.tolist(),
                "b1_a": self.b1_a.tolist(),
                "w2_a": self.w2_a.tolist(),
                "b2_a": self.b2_a.tolist(),
                "w1_c": self.w1_c.tolist(),
                "b1_c": self.b1_c.tolist(),
                "w2_c": self.w2_c.tolist(),
                "b2_c": self.b2_c.tolist()
            }
        }

    def import_policy(self, data: Dict[str, Any]):
        """Nạp lại trọng số PPO"""
        weights = data.get("weights", {})
        if "w1_a" in weights:
            self.w1_a = np.array(weights["w1_a"], dtype=np.float32)
            self.b1_a = np.array(weights["b1_a"], dtype=np.float32)
            self.w2_a = np.array(weights["w2_a"], dtype=np.float32)
            self.b2_a = np.array(weights["b2_a"], dtype=np.float32)
            self.w1_c = np.array(weights["w1_c"], dtype=np.float32)
            self.b1_c = np.array(weights["b1_c"], dtype=np.float32)
            self.w2_c = np.array(weights["w2_c"], dtype=np.float32)
            self.b2_c = np.array(weights["b2_c"], dtype=np.float32)
            self.training_steps = data.get("training_steps", 0)
