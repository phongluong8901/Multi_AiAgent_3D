import math
import random
from typing import Dict, Any, List, Tuple
import numpy as np

class DreamerAgent:
    """
    Dreamer (World Models + Latent Imagination Planning).
    
    Inspired by Danijar Hafner's Dreamer (DeepMind):
    1. World Model (Transition & Reward Dynamics):
       - s_{t+1} = Trans(s_t, a_t)
       - r_t = RewardModel(s_t, a_t)
    2. Imagination Rollouts:
       - The agent "dreams" ahead H=5 steps into the future in latent space.
    3. Actor-Critic Optimization within Imagined Trajectories:
       - Policy is optimized entirely through backpropagation through imagined world dynamics.
    """
    def __init__(
        self,
        state_dim: int = 13,
        num_actions: int = 6,
        hidden_dim: int = 48,
        imagination_horizon: int = 5,
        lr_world: float = 0.005,
        lr_actor: float = 0.003,
        lr_critic: float = 0.005,
        gamma: float = 0.95
    ):
        self.state_dim = state_dim
        self.num_actions = num_actions
        self.hidden_dim = hidden_dim
        self.horizon = imagination_horizon
        self.gamma = gamma

        # 1. World Transition Model: [s (13), one_hot(a) (6)] -> s_next (13)
        in_dim = state_dim + num_actions
        self.w1_trans = np.random.randn(in_dim, hidden_dim) * np.sqrt(2.0 / (in_dim + hidden_dim))
        self.b1_trans = np.zeros(hidden_dim)
        self.w2_trans = np.random.randn(hidden_dim, state_dim) * np.sqrt(2.0 / (hidden_dim + state_dim))
        self.b2_trans = np.zeros(state_dim)

        # 2. Reward Predictor Model: [s (13), one_hot(a) (6)] -> scalar reward
        self.w1_rew = np.random.randn(in_dim, 24) * np.sqrt(2.0 / (in_dim + 24))
        self.b1_rew = np.zeros(24)
        self.w2_rew = np.random.randn(24, 1) * np.sqrt(2.0 / (24 + 1))
        self.b2_rew = np.zeros(1)

        # 3. Actor Network: s (13) -> logits (6)
        self.w1_pi = np.random.randn(state_dim, hidden_dim) * np.sqrt(2.0 / (state_dim + hidden_dim))
        self.b1_pi = np.zeros(hidden_dim)
        self.w2_pi = np.random.randn(hidden_dim, num_actions) * np.sqrt(2.0 / (hidden_dim + num_actions))
        self.b2_pi = np.zeros(num_actions)

        # 4. Critic Network: s (13) -> Value V(s)
        self.w1_v = np.random.randn(state_dim, hidden_dim) * np.sqrt(2.0 / (state_dim + hidden_dim))
        self.b1_v = np.zeros(hidden_dim)
        self.w2_v = np.random.randn(hidden_dim, 1) * np.sqrt(2.0 / (hidden_dim + 1))
        self.b2_v = np.zeros(1)

        self.lr_world = lr_world
        self.lr_actor = lr_actor
        self.lr_critic = lr_critic

        self.replay_buffer: List[Tuple[np.ndarray, int, float, np.ndarray, bool]] = []
        self.imagined_steps_count = 0
        self.training_steps = 0

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

    def _softmax(self, x: np.ndarray) -> np.ndarray:
        e_x = np.exp(x - np.max(x, axis=-1, keepdims=True))
        return e_x / np.sum(e_x, axis=-1, keepdims=True)

    def forward_actor(self, s: np.ndarray) -> np.ndarray:
        h1 = np.tanh(np.dot(s, self.w1_pi) + self.b1_pi)
        logits = np.dot(h1, self.w2_pi) + self.b2_pi
        return self._softmax(logits)

    def forward_critic(self, s: np.ndarray) -> float:
        h1 = np.tanh(np.dot(s, self.w1_v) + self.b1_v)
        return float(np.dot(h1, self.w2_v)[0] + self.b2_v[0])

    def predict_next(self, s: np.ndarray, a: int) -> Tuple[np.ndarray, float]:
        """World Model: Dự đoán trạng thái kế tiếp và phần thưởng tương lai"""
        one_hot = np.zeros(self.num_actions, dtype=np.float32)
        one_hot[a] = 1.0
        sa = np.concatenate([s, one_hot])

        # Next state
        h_trans = np.tanh(np.dot(sa, self.w1_trans) + self.b1_trans)
        delta_s = np.dot(h_trans, self.w2_trans) + self.b2_trans
        s_next = s + delta_s * 0.2  # Residual skip connection

        # Reward
        h_rew = np.tanh(np.dot(sa, self.w1_rew) + self.b1_rew)
        pred_r = float(np.dot(h_rew, self.w2_rew)[0] + self.b2_rew[0])

        return s_next, pred_r

    def choose_action(self, obs: Dict[str, Any], greedy: bool = False) -> int:
        s = self.extract_state_vector(obs)
        probs = self.forward_actor(s)
        if greedy:
            return int(np.argmax(probs))
        return int(np.random.choice(self.num_actions, p=probs))

    def record_step(self, obs: Dict[str, Any], action: int, reward: float, next_obs: Dict[str, Any], done: bool):
        s = self.extract_state_vector(obs)
        s_next = self.extract_state_vector(next_obs)
        self.replay_buffer.append((s, action, reward, s_next, done))
        if len(self.replay_buffer) > 4000:
            self.replay_buffer.pop(0)

    def learn_step(self) -> float:
        """Học World Model và tối ưu hoá Actor-Critic thông qua Imagination Rollouts"""
        if len(self.replay_buffer) < 32:
            return 0.0

        self.training_steps += 1
        batch = random.sample(self.replay_buffer, 24)

        # 1. Huấn luyện World Model từ dữ liệu thật
        for s, a, r, s_next, done in batch:
            one_hot = np.zeros(self.num_actions, dtype=np.float32)
            one_hot[a] = 1.0
            sa = np.concatenate([s, one_hot])

            # Transition model update
            h_trans = np.tanh(np.dot(sa, self.w1_trans) + self.b1_trans)
            pred_delta = np.dot(h_trans, self.w2_trans) + self.b2_trans
            true_delta = (s_next - s) * 5.0

            grad_delta = (pred_delta - true_delta) * self.lr_world
            self.w2_trans -= np.outer(h_trans, grad_delta)
            self.b2_trans -= grad_delta

            # Reward model update
            h_rew = np.tanh(np.dot(sa, self.w1_rew) + self.b1_rew)
            pred_r = float(np.dot(h_rew, self.w2_rew)[0] + self.b2_rew[0])
            grad_r = (pred_r - r) * self.lr_world
            self.w2_rew -= (h_rew[:, None] * grad_r)
            self.b2_rew -= grad_r

        # 2. Imagination Rollout: "Mơ" về tương lai H bước từ 4 trạng thái bất kỳ
        seed_states = [b[0] for b in random.sample(batch, min(4, len(batch)))]
        for s_0 in seed_states:
            s_curr = np.copy(s_0)
            imagined_rewards = []
            imagined_states = [s_curr]
            imagined_actions = []

            for step in range(self.horizon):
                self.imagined_steps_count += 1
                probs = self.forward_actor(s_curr)
                a = int(np.random.choice(self.num_actions, p=probs))
                s_next_img, r_img = self.predict_next(s_curr, a)

                imagined_actions.append(a)
                imagined_rewards.append(r_img)
                imagined_states.append(s_next_img)
                s_curr = s_next_img

            # 3. Tối ưu Actor & Critic từ chuỗi tưởng tượng (Dreamer Policy Gradient)
            final_v = self.forward_critic(imagined_states[-1])
            g = final_v
            returns = []
            for r_t in reversed(imagined_rewards):
                g = r_t + self.gamma * g
                returns.insert(0, g)

            for t in range(self.horizon):
                st = imagined_states[t]
                at = imagined_actions[t]
                target_v = returns[t]

                # Critic update
                h_v = np.tanh(np.dot(st, self.w1_v) + self.b1_v)
                curr_v = float(np.dot(h_v, self.w2_v)[0] + self.b2_v[0])
                grad_v = (curr_v - target_v) * self.lr_critic
                self.w2_v -= (h_v[:, None] * grad_v)
                self.b2_v -= grad_v

                # Actor update (policy gradient with advantage)
                advantage = target_v - curr_v
                probs = self.forward_actor(st)
                h_pi = np.tanh(np.dot(st, self.w1_pi) + self.b1_pi)

                grad_logits = -probs * advantage * self.lr_actor
                grad_logits[at] += advantage * (1.0 - probs[at]) * self.lr_actor

                self.w2_pi += np.outer(h_pi, grad_logits)
                self.b2_pi += grad_logits

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
            self.w1_pi = np.array(w["w1_pi"], dtype=np.float32)
            self.b1_pi = np.array(w["b1_pi"], dtype=np.float32)
            self.w2_pi = np.array(w["w2_pi"], dtype=np.float32)
            self.b2_pi = np.array(w["b2_pi"], dtype=np.float32)
