import math
import random
from typing import Dict, Any, List, Tuple
import numpy as np


class DreamerAgent:
    """
    Dreamer (World Models + Latent Imagination Planning + Hybrid Real/Imagined Actor-Critic).

    1. World Model (Transition & Reward Dynamics with 2-layer MLP + Adam):
       - s_{t+1} = project(s_t + 0.2 * Trans(s_t, a_t))
       - r_t = RewardModel(s_t, a_t)
    2. Imagination Rollouts (H=5 steps):
       - Dreams ahead in state space with unit-circle manifold projection.
    3. Hybrid Dyna-Dreamer Optimization:
       - Updates Actor & Critic on both real replay batches and imagined trajectories.
    """
    def __init__(
        self,
        state_dim: int = 13,
        num_actions: int = 6,
        hidden_dim: int = 64,
        imagination_horizon: int = 5,
        lr_world: float = 0.003,
        lr_actor: float = 0.002,
        lr_critic: float = 0.003,
        gamma: float = 0.98
    ):
        self.state_dim = state_dim
        self.num_actions = num_actions
        self.hidden_dim = hidden_dim
        self.horizon = imagination_horizon
        self.gamma = gamma

        self.lr_world = lr_world
        self.lr_actor = lr_actor
        self.lr_critic = lr_critic

        self.t = 0
        self.imagined_steps_count = 0
        self.training_steps = 0
        self.replay_buffer: List[Tuple[np.ndarray, int, float, np.ndarray, bool]] = []
        self.priority_buffer: List[Tuple[np.ndarray, int, float, np.ndarray, bool]] = []

        self._init_networks(hidden_dim)

    def _init_networks(self, hidden_dim: int):
        self.hidden_dim = hidden_dim
        in_dim = self.state_dim + self.num_actions

        # 1. World Transition Model: [s (13), one_hot(a) (6)] -> delta_s (13)
        self.w1_trans = (np.random.randn(in_dim, hidden_dim) * np.sqrt(2.0 / (in_dim + hidden_dim))).astype(np.float32)
        self.b1_trans = np.zeros(hidden_dim, dtype=np.float32)
        self.w2_trans = (np.random.randn(hidden_dim, self.state_dim) * 0.1).astype(np.float32)
        self.b2_trans = np.zeros(self.state_dim, dtype=np.float32)

        # 2. Reward Predictor Model: [s (13), one_hot(a) (6)] -> scalar reward
        self.w1_rew = (np.random.randn(in_dim, 32) * np.sqrt(2.0 / (in_dim + 32))).astype(np.float32)
        self.b1_rew = np.zeros(32, dtype=np.float32)
        self.w2_rew = (np.random.randn(32, 1) * 0.1).astype(np.float32)
        self.b2_rew = np.zeros(1, dtype=np.float32)

        # 3. Actor Network: s (13) -> logits (6)
        self.w1_pi = (np.random.randn(self.state_dim, hidden_dim) * np.sqrt(2.0 / (self.state_dim + hidden_dim))).astype(np.float32)
        self.b1_pi = np.zeros(hidden_dim, dtype=np.float32)
        self.w2_pi = (np.random.randn(hidden_dim, self.num_actions) * 0.1).astype(np.float32)
        self.b2_pi = np.zeros(self.num_actions, dtype=np.float32)

        # 4. Critic Network: s (13) -> Value V(s)
        self.w1_v = (np.random.randn(self.state_dim, hidden_dim) * np.sqrt(2.0 / (self.state_dim + hidden_dim))).astype(np.float32)
        self.b1_v = np.zeros(hidden_dim, dtype=np.float32)
        self.w2_v = (np.random.randn(hidden_dim, 1) * 0.1).astype(np.float32)
        self.b2_v = np.zeros(1, dtype=np.float32)

        self._init_adam_moments()

    def _init_adam_moments(self):
        for name in [
            "w1_trans", "b1_trans", "w2_trans", "b2_trans",
            "w1_rew", "b1_rew", "w2_rew", "b2_rew",
            "w1_pi", "b1_pi", "w2_pi", "b2_pi",
            "w1_v", "b1_v", "w2_v", "b2_v",
        ]:
            p = getattr(self, name)
            setattr(self, f"m_{name}", np.zeros_like(p))
            setattr(self, f"v_{name}", np.zeros_like(p))

    def _adam_update(self, name: str, grad: np.ndarray, lr: float):
        beta1, beta2, eps = 0.9, 0.999, 1e-8
        grad = np.clip(grad, -2.5, 2.5)
        param = getattr(self, name)
        m = getattr(self, f"m_{name}")
        v = getattr(self, f"v_{name}")

        m[:] = beta1 * m + (1.0 - beta1) * grad
        v[:] = beta2 * v + (1.0 - beta2) * (grad ** 2)
        m_hat = m / (1.0 - (beta1 ** self.t))
        v_hat = v / (1.0 - (beta2 ** self.t))
        param -= lr * m_hat / (np.sqrt(v_hat) + eps)

    def extract_state_vector(self, obs: Dict[str, Any]) -> np.ndarray:
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

    def _project_valid_state(self, s: np.ndarray) -> np.ndarray:
        """Đảm bảo trạng thái tưởng tượng luôn nằm trên đa tạp vật lý hợp lệ"""
        s_proj = np.copy(s)
        s_proj[0] = np.clip(s_proj[0], 0.0, 1.0)
        # Chuẩn hóa vector góc (cos, sin) trên đường tròn đơn vị
        ang_norm = math.hypot(float(s_proj[1]), float(s_proj[2]))
        if ang_norm > 1e-5:
            s_proj[1] /= ang_norm
            s_proj[2] /= ang_norm
        hd_norm = math.hypot(float(s_proj[3]), float(s_proj[4]))
        if hd_norm > 1e-5:
            s_proj[3] /= hd_norm
            s_proj[4] /= hd_norm
        s_proj[5:] = np.clip(s_proj[5:], 0.0, 1.0)
        return s_proj

    def _softmax(self, x: np.ndarray) -> np.ndarray:
        e_x = np.exp(x - np.max(x, axis=-1, keepdims=True))
        return e_x / (np.sum(e_x, axis=-1, keepdims=True) + 1e-8)

    def forward_actor(self, s: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        h1 = np.tanh(np.dot(s, self.w1_pi) + self.b1_pi)
        logits = np.dot(h1, self.w2_pi) + self.b2_pi + self._navigation_prior(s)
        return self._softmax(logits), h1

    def forward_critic(self, s: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        h1 = np.tanh(np.dot(s, self.w1_v) + self.b1_v)
        v = np.dot(h1, self.w2_v) + self.b2_v
        if s.ndim == 1:
            return float(v[0]), h1
        return v[:, 0], h1

    def predict_next(self, s: np.ndarray, a: int) -> Tuple[np.ndarray, float]:
        """World Model: Dự đoán trạng thái kế tiếp và phần thưởng tương lai"""
        one_hot = np.zeros(self.num_actions, dtype=np.float32)
        one_hot[a] = 1.0
        sa = np.concatenate([s, one_hot])

        h_trans = np.tanh(np.dot(sa, self.w1_trans) + self.b1_trans)
        delta_s = np.dot(h_trans, self.w2_trans) + self.b2_trans
        s_next = self._project_valid_state(s + delta_s * 0.2)

        h_rew = np.tanh(np.dot(sa, self.w1_rew) + self.b1_rew)
        pred_r = float(np.dot(h_rew, self.w2_rew)[0] + self.b2_rew[0])

        return s_next, pred_r

    def choose_action(self, obs: Dict[str, Any], greedy: bool = False) -> int:
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
        if len(self.replay_buffer) > 6000:
            self.replay_buffer.pop(0)

        if done or abs(reward) >= 4.0:
            self.priority_buffer.append(transition)
            if len(self.priority_buffer) > 2000:
                self.priority_buffer.pop(0)

    def _sample_batch(self, batch_size: int = 32) -> List[Tuple[np.ndarray, int, float, np.ndarray, bool]]:
        if len(self.priority_buffer) >= 8:
            n_prio = min(len(self.priority_buffer), batch_size // 4)
            n_reg = batch_size - n_prio
            return random.sample(self.priority_buffer, n_prio) + random.sample(self.replay_buffer, n_reg)
        return random.sample(self.replay_buffer, batch_size)

    def learn_step(self) -> float:
        """Học World Model (2 tầng đầy đủ) và tối ưu hoá Actor-Critic qua cả dữ liệu thật lẫn Imagination Rollouts"""
        if len(self.replay_buffer) < 32:
            return 0.0

        self.t += 1
        self.training_steps += 1
        batch = self._sample_batch(32)
        bs = len(batch)

        s_batch = np.array([b[0] for b in batch], dtype=np.float32)
        a_batch = np.array([b[1] for b in batch], dtype=np.int32)
        r_batch = np.array([b[2] for b in batch], dtype=np.float32)
        s_next_batch = np.array([b[3] for b in batch], dtype=np.float32)
        done_batch = np.array([b[4] for b in batch], dtype=np.float32)

        # ==================== 1. Huấn luyện World Model (Vectorized 2-layer Backprop) ====================
        one_hot_a = np.zeros((bs, self.num_actions), dtype=np.float32)
        one_hot_a[np.arange(bs), a_batch] = 1.0
        sa_batch = np.concatenate([s_batch, one_hot_a], axis=1)

        # Transition Dynamics Update
        h_trans = np.tanh(np.dot(sa_batch, self.w1_trans) + self.b1_trans)
        pred_delta = np.dot(h_trans, self.w2_trans) + self.b2_trans
        true_delta = (s_next_batch - s_batch) * 5.0
        d_delta = np.clip(pred_delta - true_delta, -5.0, 5.0) / bs

        gw2_trans = np.dot(h_trans.T, d_delta)
        gb2_trans = np.sum(d_delta, axis=0)
        dh_trans = np.dot(d_delta, self.w2_trans.T) * (1.0 - h_trans ** 2)
        gw1_trans = np.dot(sa_batch.T, dh_trans)
        gb1_trans = np.sum(dh_trans, axis=0)

        self._adam_update("w1_trans", gw1_trans, self.lr_world)
        self._adam_update("b1_trans", gb1_trans, self.lr_world)
        self._adam_update("w2_trans", gw2_trans, self.lr_world)
        self._adam_update("b2_trans", gb2_trans, self.lr_world)

        # Reward Predictor Update
        h_rew = np.tanh(np.dot(sa_batch, self.w1_rew) + self.b1_rew)
        pred_r = (np.dot(h_rew, self.w2_rew) + self.b2_rew)[:, 0]
        d_rew = np.clip(pred_r - r_batch, -15.0, 15.0)[:, None] / bs

        gw2_rew = np.dot(h_rew.T, d_rew)
        gb2_rew = np.sum(d_rew, axis=0)
        dh_rew = np.dot(d_rew, self.w2_rew.T) * (1.0 - h_rew ** 2)
        gw1_rew = np.dot(sa_batch.T, dh_rew)
        gb1_rew = np.sum(dh_rew, axis=0)

        self._adam_update("w1_rew", gw1_rew, self.lr_world)
        self._adam_update("b1_rew", gb1_rew, self.lr_world)
        self._adam_update("w2_rew", gw2_rew, self.lr_world)
        self._adam_update("b2_rew", gb2_rew, self.lr_world)

        # ==================== 2. Cập nhật Actor-Critic trên dữ liệu thật (Real Transitions) ====================
        v_next, _ = self.forward_critic(s_next_batch)
        target_v_real = r_batch + (1.0 - done_batch) * self.gamma * v_next
        v_curr, h_v_real = self.forward_critic(s_batch)
        td_err_real = v_curr - target_v_real

        d_v_real = np.clip(td_err_real, -15.0, 15.0)[:, None] / bs
        gw2_v = np.dot(h_v_real.T, d_v_real)
        gb2_v = np.sum(d_v_real, axis=0)
        dh_v = np.dot(d_v_real, self.w2_v.T) * (1.0 - h_v_real ** 2)
        gw1_v = np.dot(s_batch.T, dh_v)
        gb1_v = np.sum(dh_v, axis=0)

        self._adam_update("w1_v", gw1_v, self.lr_critic)
        self._adam_update("b1_v", gb1_v, self.lr_critic)
        self._adam_update("w2_v", gw2_v, self.lr_critic)
        self._adam_update("b2_v", gb2_v, self.lr_critic)

        # Actor update từ advantage thực
        adv_real = target_v_real - v_curr
        adv_std = np.std(adv_real)
        if adv_std > 1e-5:
            adv_real = (adv_real - np.mean(adv_real)) / (adv_std + 1e-8)

        probs_real, h_pi_real = self.forward_actor(s_batch)
        d_logits_real = probs_real.copy()
        d_logits_real[np.arange(bs), a_batch] -= 1.0
        d_logits_real *= (adv_real[:, None] / bs)

        gw2_pi = np.dot(h_pi_real.T, d_logits_real)
        gb2_pi = np.sum(d_logits_real, axis=0)
        dh_pi = np.dot(d_logits_real, self.w2_pi.T) * (1.0 - h_pi_real ** 2)
        gw1_pi = np.dot(s_batch.T, dh_pi)
        gb1_pi = np.sum(dh_pi, axis=0)

        self._adam_update("w1_pi", gw1_pi, self.lr_actor)
        self._adam_update("b1_pi", gb1_pi, self.lr_actor)
        self._adam_update("w2_pi", gw2_pi, self.lr_actor)
        self._adam_update("b2_pi", gb2_pi, self.lr_actor)

        # ==================== 3. Imagination Rollouts (Dreaming H steps ahead) ====================
        non_term_states = [b[0] for b in batch if not b[4]]
        seed_states = random.sample(non_term_states, min(4, len(non_term_states))) if non_term_states else [batch[0][0]]

        img_s_list = []
        img_a_list = []
        img_ret_list = []

        for s_0 in seed_states:
            s_curr = np.copy(s_0)
            traj_s = []
            traj_a = []
            traj_r = []

            for _ in range(self.horizon):
                self.imagined_steps_count += 1
                probs, _ = self.forward_actor(s_curr)
                a = int(np.random.choice(self.num_actions, p=probs))
                s_next_img, r_img = self.predict_next(s_curr, a)

                traj_s.append(s_curr)
                traj_a.append(a)
                traj_r.append(np.clip(r_img, -15.0, 30.0))
                s_curr = s_next_img

            g, _ = self.forward_critic(s_curr)
            returns = []
            for r_t in reversed(traj_r):
                g = r_t + self.gamma * g
                returns.insert(0, g)

            img_s_list.extend(traj_s)
            img_a_list.extend(traj_a)
            img_ret_list.extend(returns)

        if len(img_s_list) >= 4:
            self.t += 1
            im_s = np.array(img_s_list, dtype=np.float32)
            im_a = np.array(img_a_list, dtype=np.int32)
            im_ret = np.array(img_ret_list, dtype=np.float32)
            im_bs = len(im_s)

            im_v, im_h_v = self.forward_critic(im_s)
            im_adv = im_ret - im_v
            im_std = np.std(im_adv)
            if im_std > 1e-5:
                im_adv_norm = (im_adv - np.mean(im_adv)) / (im_std + 1e-8)
            else:
                im_adv_norm = im_adv

            im_probs, im_h_pi = self.forward_actor(im_s)
            d_logits_im = im_probs.copy()
            d_logits_im[np.arange(im_bs), im_a] -= 1.0
            d_logits_im *= (im_adv_norm[:, None] / im_bs)

            gw2_pi_im = np.dot(im_h_pi.T, d_logits_im)
            gb2_pi_im = np.sum(d_logits_im, axis=0)
            dh_pi_im = np.dot(d_logits_im, self.w2_pi.T) * (1.0 - im_h_pi ** 2)
            gw1_pi_im = np.dot(im_s.T, dh_pi_im)
            gb1_pi_im = np.sum(dh_pi_im, axis=0)

            self._adam_update("w1_pi", gw1_pi_im, self.lr_actor * 0.5)
            self._adam_update("b1_pi", gb1_pi_im, self.lr_actor * 0.5)
            self._adam_update("w2_pi", gw2_pi_im, self.lr_actor * 0.5)
            self._adam_update("b2_pi", gb2_pi_im, self.lr_actor * 0.5)

        return float(self.imagined_steps_count)

    def export_policy(self) -> Dict[str, Any]:
        return {
            "algorithm": "dreamer",
            "algorithm_name": "Dreamer (World Model)",
            "horizon": self.horizon,
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
