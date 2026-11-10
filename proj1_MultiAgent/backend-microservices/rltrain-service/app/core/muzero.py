import math
import random
from typing import Dict, Any, List, Tuple, Optional
import numpy as np


class MCTSNode:
    """Nút trên cây tìm kiếm Monte Carlo Tree Search của MuZero"""
    def __init__(self, prior: float = 0.0):
        self.prior: float = prior
        self.visit_count: int = 0
        self.value_sum: float = 0.0
        self.children: Dict[int, MCTSNode] = {}
        self.hidden_state: Optional[np.ndarray] = None
        self.reward: float = 0.0

    @property
    def value(self) -> float:
        if self.visit_count == 0:
            return 0.0
        return self.value_sum / self.visit_count


class MuZeroAgent:
    """
    MuZero: Mastering Planning with a Learned Model (DeepMind):
    1. Representation Network h: o_t -> s_0
    2. Dynamics Network g: (s_{k-1}, a_k) -> (r_k, s_k)
    3. Prediction Network f: s_k -> (p_k, v_k)
    4. Monte Carlo Tree Search (MCTS) with Min-Max Normalized Q-values & Root Dirichlet Noise.
    5. Full End-to-End Backpropagation into Representation, Dynamics & Prediction with Adam.
    """
    def __init__(
        self,
        state_dim: int = 13,
        num_actions: int = 6,
        hidden_dim: int = 48,
        num_simulations: int = 18,
        c_puct: float = 1.25,
        gamma: float = 0.98,
        lr: float = 0.0025
    ):
        self.state_dim = state_dim
        self.num_actions = num_actions
        self.hidden_dim = hidden_dim
        self.num_simulations = num_simulations
        self.c_puct = c_puct
        self.gamma = gamma
        self.lr = lr

        self.t = 0
        self.total_simulations_run = 0
        self.training_steps = 0
        self.last_mcts_policy: Optional[np.ndarray] = None

        self.replay_buffer: List[Tuple[np.ndarray, int, float, np.ndarray, bool, np.ndarray]] = []
        self.priority_buffer: List[Tuple[np.ndarray, int, float, np.ndarray, bool, np.ndarray]] = []

        self._init_networks(hidden_dim)

    def _init_networks(self, hidden_dim: int):
        self.hidden_dim = hidden_dim
        # 1. Representation Network h: o (13) -> s (hidden_dim)
        self.w_rep = (np.random.randn(self.state_dim, hidden_dim) * np.sqrt(2.0 / (self.state_dim + hidden_dim))).astype(np.float32)
        self.b_rep = np.zeros(hidden_dim, dtype=np.float32)

        # 2. Dynamics Network g: [s (hidden_dim), a_one_hot (6)] -> [s_next (hidden_dim), reward (1)]
        in_dyn = hidden_dim + self.num_actions
        self.w_dyn = (np.random.randn(in_dyn, hidden_dim + 1) * np.sqrt(2.0 / (in_dyn + hidden_dim + 1))).astype(np.float32)
        self.b_dyn = np.zeros(hidden_dim + 1, dtype=np.float32)

        # 3. Prediction Network f: s (hidden_dim) -> [policy_logits (6), value (1)]
        self.w_pred = (np.random.randn(hidden_dim, self.num_actions + 1) * 0.12).astype(np.float32)
        self.b_pred = np.zeros(self.num_actions + 1, dtype=np.float32)

        self._init_adam_moments()

    def _init_adam_moments(self):
        for name in ["w_rep", "b_rep", "w_dyn", "b_dyn", "w_pred", "b_pred"]:
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
        front_min = np.minimum(front_l, np.minimum(fl_l * 1.15, fr_l * 1.15))
        front_blocked = np.maximum(0.0, 0.22 - front_min) * 8.0

        prior = np.zeros((s.shape[0], self.num_actions), dtype=np.float32)
        prior[:, 0] = 2.4 * cos_ang * (front_min > 0.15) - 4.5 * (front_min <= 0.15) - front_blocked
        prior[:, 1] = -2.2 + 3.5 * (front_l < 0.10)
        prior[:, 2] = 1.8 * np.maximum(0.0, sin_ang) + 2.2 * (front_min <= 0.18) * (left_clear >= right_clear)
        prior[:, 3] = 1.8 * np.maximum(0.0, -sin_ang) + 2.2 * (front_min <= 0.18) * (right_clear > left_clear)
        prior[:, 4] = 1.9 * cos_ang + 1.9 * np.maximum(0.0, sin_ang) + 1.4 * (left_clear - right_clear) - 2.0 * (fl_l < 0.12)
        prior[:, 5] = 1.9 * cos_ang + 1.9 * np.maximum(0.0, -sin_ang) + 1.4 * (right_clear - left_clear) - 2.0 * (fr_l < 0.12)

        decay = max(0.45, 1.0 / (1.0 + 0.0003 * self.training_steps))
        prior *= decay
        return prior[0] if single else prior

    def _softmax(self, x: np.ndarray) -> np.ndarray:
        e_x = np.exp(x - np.max(x, axis=-1, keepdims=True))
        return e_x / (np.sum(e_x, axis=-1, keepdims=True) + 1e-8)

    # 1. Representation: o -> s
    def representation(self, obs_vec: np.ndarray) -> np.ndarray:
        return np.tanh(np.dot(obs_vec, self.w_rep) + self.b_rep)

    # 2. Dynamics: (s, a) -> (s_next, r)
    def dynamics(self, s: np.ndarray, a: int) -> Tuple[np.ndarray, float]:
        one_hot = np.zeros(self.num_actions, dtype=np.float32)
        one_hot[a] = 1.0
        sa = np.concatenate([s, one_hot])
        out = np.dot(sa, self.w_dyn) + self.b_dyn
        s_next = np.tanh(s + 0.35 * out[:self.hidden_dim])
        reward = float(out[-1])
        return s_next, reward

    # 3. Prediction: s -> (pi, v)
    def prediction(self, s: np.ndarray, obs_vec: Optional[np.ndarray] = None) -> Tuple[np.ndarray, float]:
        out = np.dot(s, self.w_pred) + self.b_pred
        policy_logits = out[:self.num_actions].copy()
        if obs_vec is not None:
            policy_logits += self._navigation_prior(obs_vec)
        value = float(out[-1])
        probs = self._softmax(policy_logits)
        return probs, value

    def run_mcts(self, root_state: np.ndarray, obs_vec: Optional[np.ndarray] = None) -> Tuple[int, np.ndarray]:
        """Thực thi MCTS với Min-Max Normalized Q-Values và Root Exploration Noise"""
        root = MCTSNode(prior=1.0)
        root.hidden_state = root_state
        init_policy, _ = self.prediction(root_state, obs_vec=obs_vec)

        # Thêm nhiễu Dirichlet nhẹ tại nút gốc để tăng tính khám phá
        noise = np.random.dirichlet([0.3] * self.num_actions)
        root_priors = 0.8 * init_policy + 0.2 * noise

        for a in range(self.num_actions):
            root.children[a] = MCTSNode(prior=float(root_priors[a]))

        min_q = float("inf")
        max_q = -float("inf")

        for _ in range(self.num_simulations):
            self.total_simulations_run += 1
            node = root
            search_path = [node]

            # 1. Selection (PUCT với Q-value chuẩn hóa [0, 1])
            while node.children and all(c.hidden_state is not None for c in node.children.values()):
                best_score = -float("inf")
                best_child = None
                total_visits = sum(c.visit_count for c in node.children.values())

                for _, child in node.children.items():
                    if child.visit_count > 0:
                        q_val = child.reward + self.gamma * child.value
                        norm_q = (q_val - min_q) / (max_q - min_q) if max_q > min_q + 1e-5 else q_val
                    else:
                        norm_q = 0.0
                    u = norm_q + self.c_puct * child.prior * (math.sqrt(total_visits + 1) / (1 + child.visit_count))
                    if u > best_score:
                        best_score = u
                        best_child = child

                node = best_child
                search_path.append(node)

            # 2. Expansion & Evaluation
            unexpanded_actions = [a for a, c in node.children.items() if c.hidden_state is None]
            if unexpanded_actions:
                # Ưu tiên mở rộng theo prior cao hơn
                unexpanded_actions.sort(key=lambda act_idx: node.children[act_idx].prior, reverse=True)
                act = unexpanded_actions[0]
                child_node = node.children[act]
                search_path.append(child_node)

                s_next, rew = self.dynamics(node.hidden_state, act)
                child_node.hidden_state = s_next
                child_node.reward = rew

                probs, val = self.prediction(s_next)
                for a in range(self.num_actions):
                    child_node.children[a] = MCTSNode(prior=float(probs[a]))
            else:
                val = node.value

            # 3. Backpropagation
            g = val
            for idx in reversed(range(len(search_path))):
                curr = search_path[idx]
                curr.visit_count += 1
                curr.value_sum += g
                if idx > 0:
                    q_est = curr.reward + self.gamma * curr.value
                    min_q = min(min_q, q_est)
                    max_q = max(max_q, q_est)
                g = curr.reward + self.gamma * g

        visits = np.array([root.children[a].visit_count for a in range(self.num_actions)], dtype=np.float32)
        sum_v = np.sum(visits)
        mcts_policy = visits / sum_v if sum_v > 0 else init_policy

        # Lấy mẫu theo phân phối MCTS kết hợp prediction policy
        blended_policy = 0.65 * mcts_policy + 0.35 * init_policy
        blended_policy /= np.sum(blended_policy)
        chosen_action = int(np.random.choice(self.num_actions, p=blended_policy))
        self.last_mcts_policy = blended_policy
        return chosen_action, blended_policy

    def choose_action(self, obs: Dict[str, Any], greedy: bool = False) -> int:
        obs_vec = self.extract_state_vector(obs)
        root_state = self.representation(obs_vec)

        if greedy:
            probs, _ = self.prediction(root_state, obs_vec=obs_vec)
            return int(np.argmax(probs))

        best_action, _ = self.run_mcts(root_state, obs_vec=obs_vec)
        return best_action

    def record_step(self, obs: Dict[str, Any], action: int, reward: float, next_obs: Dict[str, Any], done: bool):
        s = self.extract_state_vector(obs)
        s_next = self.extract_state_vector(next_obs)
        pi = self.last_mcts_policy if self.last_mcts_policy is not None else (np.ones(self.num_actions, dtype=np.float32) / self.num_actions)
        transition = (s, action, reward, s_next, done, pi.copy())

        self.replay_buffer.append(transition)
        if len(self.replay_buffer) > 6000:
            self.replay_buffer.pop(0)

        if done or abs(reward) >= 4.0:
            self.priority_buffer.append(transition)
            if len(self.priority_buffer) > 2000:
                self.priority_buffer.pop(0)

    def _sample_batch(self, batch_size: int = 32):
        if len(self.priority_buffer) >= 8:
            n_prio = min(len(self.priority_buffer), batch_size // 4)
            n_reg = batch_size - n_prio
            return random.sample(self.priority_buffer, n_prio) + random.sample(self.replay_buffer, n_reg)
        return random.sample(self.replay_buffer, batch_size)

    def learn_step(self) -> float:
        """Cập nhật cả 3 mạng Representation, Dynamics, Prediction qua Vectorized Backprop & Adam"""
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
        mcts_pi_batch = np.array([b[5] for b in batch], dtype=np.float32)

        # 1. Representation & Next-state Value Target
        h_s = self.representation(s_batch)
        h_next = self.representation(s_next_batch)

        pred_out = np.dot(h_s, self.w_pred) + self.b_pred
        logits = pred_out[:, :self.num_actions] + self._navigation_prior(s_batch)
        probs = self._softmax(logits)
        vals = pred_out[:, -1]

        next_pred_out = np.dot(h_next, self.w_pred) + self.b_pred
        next_vals = next_pred_out[:, -1]
        target_v = r_batch + (1.0 - done_batch) * self.gamma * next_vals

        # 2. Advantage & Policy Target
        td_err = vals - target_v
        adv = target_v - vals
        adv_std = np.std(adv)
        norm_adv = (adv - np.mean(adv)) / (adv_std + 1e-8) if adv_std > 1e-5 else adv

        # Kết hợp MCTS policy distillation và Advantage Policy Gradient
        d_logits_pg = probs.copy()
        d_logits_pg[np.arange(bs), a_batch] -= 1.0
        d_logits_pg *= norm_adv[:, None]

        d_logits_mcts = (probs - mcts_pi_batch) * 0.35
        d_logits = (d_logits_pg + d_logits_mcts) / bs
        d_val = np.clip(td_err, -15.0, 15.0)[:, None] / bs

        d_pred_out = np.concatenate([d_logits, d_val], axis=1)
        gw_pred = np.dot(h_s.T, d_pred_out)
        gb_pred = np.sum(d_pred_out, axis=0)
        dh_s_pred = np.dot(d_pred_out, self.w_pred.T)

        # 3. Dynamics Model Update: [h_s, one_hot(a)] -> [h_next, r]
        one_hot_a = np.zeros((bs, self.num_actions), dtype=np.float32)
        one_hot_a[np.arange(bs), a_batch] = 1.0
        sa_batch = np.concatenate([h_s, one_hot_a], axis=1)

        dyn_out = np.dot(sa_batch, self.w_dyn) + self.b_dyn
        pred_h_next = np.tanh(h_s + 0.35 * dyn_out[:, :self.hidden_dim])
        pred_r = dyn_out[:, -1]

        err_h = (pred_h_next - h_next) * (1.0 - pred_h_next ** 2) * 0.35 / bs
        err_r = np.clip(pred_r - r_batch, -15.0, 15.0)[:, None] / bs
        d_dyn_out = np.concatenate([err_h, err_r], axis=1)

        gw_dyn = np.dot(sa_batch.T, d_dyn_out)
        gb_dyn = np.sum(d_dyn_out, axis=0)
        dh_s_dyn = np.dot(d_dyn_out, self.w_dyn[:self.hidden_dim, :].T)

        # 4. Representation Network Update
        dh_s_total = (dh_s_pred + 0.4 * dh_s_dyn) * (1.0 - h_s ** 2)
        gw_rep = np.dot(s_batch.T, dh_s_total)
        gb_rep = np.sum(dh_s_total, axis=0)

        self._adam_update("w_pred", gw_pred, self.lr)
        self._adam_update("b_pred", gb_pred, self.lr)
        self._adam_update("w_dyn", gw_dyn, self.lr)
        self._adam_update("b_dyn", gb_dyn, self.lr)
        self._adam_update("w_rep", gw_rep, self.lr)
        self._adam_update("b_rep", gb_rep, self.lr)

        return float(self.total_simulations_run)

    def export_policy(self) -> Dict[str, Any]:
        return {
            "algorithm": "muzero",
            "algorithm_name": "MuZero (DeepMind MCTS Planning)",
            "simulations": self.num_simulations,
            "weights": {
                "w_rep": self.w_rep.tolist(),
                "b_rep": self.b_rep.tolist(),
                "w_dyn": self.w_dyn.tolist(),
                "b_dyn": self.b_dyn.tolist(),
                "w_pred": self.w_pred.tolist(),
                "b_pred": self.b_pred.tolist()
            }
        }

    def load_policy(self, data: Dict[str, Any]):
        w = data.get("weights", {})
        if "w_rep" in w:
            w_rep_arr = np.array(w["w_rep"], dtype=np.float32)
            if w_rep_arr.shape[1] != self.hidden_dim:
                self._init_networks(int(w_rep_arr.shape[1]))
            self.w_rep = w_rep_arr
            self.b_rep = np.array(w["b_rep"], dtype=np.float32)
            self.w_pred = np.array(w["w_pred"], dtype=np.float32)
            self.b_pred = np.array(w["b_pred"], dtype=np.float32)
            if "w_dyn" in w:
                self.w_dyn = np.array(w["w_dyn"], dtype=np.float32)
                self.b_dyn = np.array(w["b_dyn"], dtype=np.float32)
