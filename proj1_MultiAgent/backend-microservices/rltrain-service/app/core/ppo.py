import math
import random
from typing import Dict, Any, List, Tuple, Optional
import numpy as np


class PPOAgent:
    """
    Proximal Policy Optimization (PPO) with Generalized Advantage Estimation (GAE-Lambda),
    Vectorized Mini-Batch Updates, Entropy Regularization, Target-KL Early Stopping,
    and Full Bias-Corrected Adam Optimizer.

    Continuous 13-dim state observation:
    - [0] rel_dist: normalized distance to goal
    - [1] cos_angle: cos(angle_diff to goal)
    - [2] sin_angle: sin(angle_diff to goal)
    - [3] cos_heading: cos(agent_heading)
    - [4] sin_heading: sin(agent_heading)
    - [5..12] 8 normalized lidar beams (0=front, 1=front-left, 2=left, ..., 7=front-right)
    """
    def __init__(
        self,
        state_dim: int = 13,
        num_actions: int = 6,
        hidden_dim: int = 64,
        lr_actor: float = 0.0025,
        lr_critic: float = 0.004,
        gamma: float = 0.98,
        gae_lambda: float = 0.95,
        clip_ratio: float = 0.2,
        entropy_coef: float = 0.015,
        batch_size: int = 32,
        ppo_epochs: int = 4,
        target_kl: float = 0.035
    ):
        self.state_dim = state_dim
        self.num_actions = num_actions
        self.hidden_dim = hidden_dim
        self.gamma = gamma
        self.gae_lambda = gae_lambda
        self.clip_ratio = clip_ratio
        self.entropy_coef = entropy_coef
        self.batch_size = batch_size
        self.ppo_epochs = ppo_epochs
        self.target_kl = target_kl

        self.lr_actor = lr_actor
        self.lr_critic = lr_critic
        self.t = 0
        self.training_steps = 0

        self._init_networks(hidden_dim)

        # Rollout trajectory buffers
        self.states: List[np.ndarray] = []
        self.actions: List[int] = []
        self.rewards: List[float] = []
        self.old_log_probs: List[float] = []
        self.dones: List[bool] = []
        self.last_next_state: Optional[np.ndarray] = None

    def _init_networks(self, hidden_dim: int):
        self.hidden_dim = hidden_dim
        # Orthogonal-like / Xavier initialization
        self.w1_a = (np.random.randn(self.state_dim, hidden_dim) * np.sqrt(2.0 / (self.state_dim + hidden_dim))).astype(np.float32)
        self.b1_a = np.zeros(hidden_dim, dtype=np.float32)
        self.w2_a = (np.random.randn(hidden_dim, self.num_actions) * 0.1).astype(np.float32)
        self.b2_a = np.zeros(self.num_actions, dtype=np.float32)

        self.w1_c = (np.random.randn(self.state_dim, hidden_dim) * np.sqrt(2.0 / (self.state_dim + hidden_dim))).astype(np.float32)
        self.b1_c = np.zeros(hidden_dim, dtype=np.float32)
        self.w2_c = (np.random.randn(hidden_dim, 1) * np.sqrt(2.0 / (hidden_dim + 1))).astype(np.float32)
        self.b2_c = np.zeros(1, dtype=np.float32)

        self._init_adam_moments()

    def _init_adam_moments(self):
        for name in ["w1_a", "b1_a", "w2_a", "b2_a", "w1_c", "b1_c", "w2_c", "b2_c"]:
            p = getattr(self, name)
            setattr(self, f"m_{name}", np.zeros_like(p))
            setattr(self, f"v_{name}", np.zeros_like(p))

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
        """
        Tín hiệu dẫn đường cảm biến (Sensor Inductive Bias) giúp ổn định pha khám phá đầu tiên
        và tránh đâm tường mù quáng, giảm dần ảnh hưởng khi mạng Actor đã hội tụ.
        """
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
        # 0: FORWARD
        prior[:, 0] = 1.1 * cos_ang * (front_l > 0.24) - 1.8 * front_blocked
        # 1: BACKWARD (chỉ khuyến khích khi bị chặn sát phía trước)
        prior[:, 1] = -0.8 + 1.6 * (front_l < 0.16)
        # 2: TURN_LEFT, 3: TURN_RIGHT
        prior[:, 2] = 0.85 * np.maximum(0.0, sin_ang) + 0.7 * front_blocked * (left_clear >= right_clear)
        prior[:, 3] = 0.85 * np.maximum(0.0, -sin_ang) + 0.7 * front_blocked * (right_clear > left_clear)
        # 4: FORWARD_LEFT, 5: FORWARD_RIGHT
        prior[:, 4] = 0.75 * cos_ang + 0.75 * np.maximum(0.0, sin_ang) + 0.5 * (left_clear - right_clear) - front_blocked * 0.6
        prior[:, 5] = 0.75 * cos_ang + 0.75 * np.maximum(0.0, -sin_ang) + 0.5 * (right_clear - left_clear) - front_blocked * 0.6

        decay = max(0.25, 1.0 / (1.0 + 0.008 * self.training_steps))
        prior *= decay
        return prior[0] if single else prior

    def _softmax(self, x: np.ndarray) -> np.ndarray:
        e_x = np.exp(x - np.max(x, axis=-1, keepdims=True))
        return e_x / (np.sum(e_x, axis=-1, keepdims=True) + 1e-8)

    def forward_actor(self, s: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Forward pass Actor: s -> (probs, h1)"""
        h1 = np.tanh(np.dot(s, self.w1_a) + self.b1_a)
        logits = np.dot(h1, self.w2_a) + self.b2_a + self._navigation_prior(s)
        probs = self._softmax(logits)
        return probs, h1

    def forward_critic(self, s: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Forward pass Critic: s -> (V(s), h1)"""
        h1 = np.tanh(np.dot(s, self.w1_c) + self.b1_c)
        v = np.dot(h1, self.w2_c) + self.b2_c
        if s.ndim == 1:
            return float(v[0]), h1
        return v[:, 0], h1

    def choose_action(self, obs: Dict[str, Any], greedy: bool = False) -> Tuple[int, float]:
        """Lấy action theo phân phối xác suất Actor của PPO"""
        s = self.extract_state_vector(obs)
        probs, _ = self.forward_actor(s)

        if greedy:
            action = int(np.argmax(probs))
            log_prob = float(np.log(max(1e-7, probs[action])))
            return action, log_prob

        action = int(np.random.choice(self.num_actions, p=probs))
        log_prob = float(np.log(max(1e-7, probs[action])))
        return action, log_prob

    def record_step(
        self,
        obs: Dict[str, Any],
        action: int,
        reward: float,
        done: bool,
        log_prob: float,
        next_obs: Optional[Dict[str, Any]] = None
    ):
        """Lưu bước di chuyển vào buffer PPO"""
        s = self.extract_state_vector(obs)
        self.states.append(s)
        self.actions.append(action)
        self.rewards.append(reward)
        self.dones.append(done)
        self.old_log_probs.append(log_prob)
        if next_obs is not None:
            self.last_next_state = self.extract_state_vector(next_obs)

    def _adam_update(self, name: str, grad: np.ndarray, lr: float):
        beta1, beta2, eps = 0.9, 0.999, 1e-8
        grad = np.clip(grad, -2.0, 2.0)
        param = getattr(self, name)
        m = getattr(self, f"m_{name}")
        v = getattr(self, f"v_{name}")

        m[:] = beta1 * m + (1.0 - beta1) * grad
        v[:] = beta2 * v + (1.0 - beta2) * (grad ** 2)
        m_hat = m / (1.0 - (beta1 ** self.t))
        v_hat = v / (1.0 - (beta2 ** self.t))
        param -= lr * m_hat / (np.sqrt(v_hat) + eps)

    def learn_episode(self) -> float:
        """Cập nhật PPO với GAE-Lambda, Mini-Batch Vectorization, Entropy Bonus và Target-KL Early Stopping"""
        n = len(self.states)
        if n < 4:
            return 0.0

        s_arr = np.array(self.states, dtype=np.float32)
        a_arr = np.array(self.actions, dtype=np.int32)
        r_arr = np.array(self.rewards, dtype=np.float32)
        d_arr = np.array(self.dones, dtype=np.float32)
        old_logp_arr = np.array(self.old_log_probs, dtype=np.float32)

        # 1. Tính V(s_t) và GAE(gamma, lambda)
        values, _ = self.forward_critic(s_arr)
        if not self.dones[-1] and self.last_next_state is not None:
            next_val, _ = self.forward_critic(self.last_next_state)
        else:
            next_val = 0.0

        advantages = np.zeros(n, dtype=np.float32)
        last_gae = 0.0
        for t in reversed(range(n)):
            non_terminal = 1.0 - d_arr[t]
            v_next = next_val if t == n - 1 else values[t + 1]
            delta = r_arr[t] + self.gamma * v_next * non_terminal - values[t]
            last_gae = delta + self.gamma * self.gae_lambda * non_terminal * last_gae
            advantages[t] = last_gae

        returns = advantages + values

        # Chuẩn hóa Advantages trên toàn rollout
        adv_std = np.std(advantages)
        if adv_std > 1e-6:
            advantages = (advantages - np.mean(advantages)) / (adv_std + 1e-8)

        # 2. Mini-batch PPO Optimization
        total_loss = 0.0
        num_updates = 0
        adaptive_ent = max(0.003, self.entropy_coef * (0.996 ** self.training_steps))

        for _ in range(self.ppo_epochs):
            perm = np.random.permutation(n)
            approx_kl_epoch = 0.0
            batches_in_epoch = 0

            for start in range(0, n, self.batch_size):
                idx = perm[start:start + self.batch_size]
                bs = len(idx)
                if bs < 2:
                    continue

                self.t += 1
                sb = s_arr[idx]
                ab = a_arr[idx]
                adv_b = advantages[idx]
                ret_b = returns[idx]
                old_lp_b = old_logp_arr[idx]

                # --- Actor Forward & Gradient ---
                probs, h1_a = self.forward_actor(sb)
                chosen_probs = np.maximum(1e-7, probs[np.arange(bs), ab])
                new_lp_b = np.log(chosen_probs)
                ratio = np.exp(np.clip(new_lp_b - old_lp_b, -10.0, 10.0))

                approx_kl = float(np.mean(old_lp_b - new_lp_b))
                approx_kl_epoch += approx_kl
                batches_in_epoch += 1

                surr1 = ratio * adv_b
                surr2 = np.clip(ratio, 1.0 - self.clip_ratio, 1.0 + self.clip_ratio) * adv_b
                actor_loss = -float(np.mean(np.minimum(surr1, surr2)))

                # Mask những mẫu chưa bị clip
                unclipped = (surr1 <= surr2).astype(np.float32)
                weight = -(ratio * adv_b * unclipped)

                # Softmax gradient cho PPO surrogate: dL / d(logits)
                d_logits = -probs * weight[:, None]
                d_logits[np.arange(bs), ab] += weight

                # Cộng thêm Entropy Regularization gradient: d(-H)/d(logits)
                log_probs_all = np.log(np.maximum(1e-7, probs))
                entropy = -np.sum(probs * log_probs_all, axis=1, keepdims=True)
                d_entropy_logits = probs * (log_probs_all + entropy)
                d_logits = (d_logits + adaptive_ent * d_entropy_logits) / bs

                gw2_a = np.dot(h1_a.T, d_logits)
                gb2_a = np.sum(d_logits, axis=0)
                dh1_a = np.dot(d_logits, self.w2_a.T) * (1.0 - h1_a ** 2)
                gw1_a = np.dot(sb.T, dh1_a)
                gb1_a = np.sum(dh1_a, axis=0)

                self._adam_update("w1_a", gw1_a, self.lr_actor)
                self._adam_update("b1_a", gb1_a, self.lr_actor)
                self._adam_update("w2_a", gw2_a, self.lr_actor)
                self._adam_update("b2_a", gb2_a, self.lr_actor)

                # --- Critic Forward & Huber/Clipped MSE Gradient ---
                v_pred, h1_c = self.forward_critic(sb)
                v_err = v_pred - ret_b
                # Huber-like clipping để tránh nổ gradient khi nhận thưởng đích +150
                d_v = np.clip(v_err, -15.0, 15.0)[:, None] / bs

                gw2_c = np.dot(h1_c.T, d_v)
                gb2_c = np.sum(d_v, axis=0)
                dh1_c = np.dot(d_v, self.w2_c.T) * (1.0 - h1_c ** 2)
                gw1_c = np.dot(sb.T, dh1_c)
                gb1_c = np.sum(dh1_c, axis=0)

                self._adam_update("w1_c", gw1_c, self.lr_critic)
                self._adam_update("b1_c", gb1_c, self.lr_critic)
                self._adam_update("w2_c", gw2_c, self.lr_critic)
                self._adam_update("b2_c", gb2_c, self.lr_critic)

                total_loss += actor_loss + 0.5 * float(np.mean(v_err ** 2))
                num_updates += 1

            # Dừng sớm epoch nếu KL divergence vượt ngưỡng an toàn
            if batches_in_epoch > 0 and (approx_kl_epoch / batches_in_epoch) > self.target_kl:
                break

        # Xoá buffer sau khi update
        self.states.clear()
        self.actions.clear()
        self.rewards.clear()
        self.dones.clear()
        self.old_log_probs.clear()
        self.last_next_state = None
        self.training_steps += 1
        return float(total_loss / max(1, num_updates))

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
        """Nạp lại trọng số PPO (tương thích mọi kích thước hidden_dim)"""
        weights = data.get("weights", {})
        if "w1_a" in weights:
            self.w1_a = np.array(weights["w1_a"], dtype=np.float32)
            self.hidden_dim = int(self.w1_a.shape[1])
            self.b1_a = np.array(weights["b1_a"], dtype=np.float32)
            self.w2_a = np.array(weights["w2_a"], dtype=np.float32)
            self.b2_a = np.array(weights["b2_a"], dtype=np.float32)
            if "w1_c" in weights:
                self.w1_c = np.array(weights["w1_c"], dtype=np.float32)
                self.b1_c = np.array(weights["b1_c"], dtype=np.float32)
                self.w2_c = np.array(weights["w2_c"], dtype=np.float32)
                self.b2_c = np.array(weights["b2_c"], dtype=np.float32)
            self.training_steps = data.get("training_steps", 0)
            self._init_adam_moments()
