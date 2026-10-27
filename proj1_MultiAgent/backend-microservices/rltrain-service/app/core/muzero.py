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
    MuZero: Mastering Atari, Go, Chess and Shogi by Planning with a Learned Model.
    (DeepMind / Julian Schrittwieser et al., Nature 2020)
    
    Components:
    1. Representation Network h: o_t -> s_0
    2. Dynamics Network g: (s_{k-1}, a_k) -> (r_k, s_k)
    3. Prediction Network f: s_k -> (p_k, v_k)
    4. Monte Carlo Tree Search (MCTS) with PUCT planning.
    """
    def __init__(
        self,
        state_dim: int = 13,
        num_actions: int = 6,
        hidden_dim: int = 36,
        num_simulations: int = 25,
        c_puct: float = 1.25,
        gamma: float = 0.95,
        lr: float = 0.003
    ):
        self.state_dim = state_dim
        self.num_actions = num_actions
        self.hidden_dim = hidden_dim
        self.num_simulations = num_simulations
        self.c_puct = c_puct
        self.gamma = gamma
        self.lr = lr

        # 1. Representation Network h: o (13) -> s (hidden_dim)
        self.w_rep = np.random.randn(state_dim, hidden_dim) * np.sqrt(2.0 / (state_dim + hidden_dim))
        self.b_rep = np.zeros(hidden_dim)

        # 2. Dynamics Network g: [s (hidden_dim), a_one_hot (6)] -> [s_next (hidden_dim), reward (1)]
        in_dyn = hidden_dim + num_actions
        self.w_dyn = np.random.randn(in_dyn, hidden_dim + 1) * np.sqrt(2.0 / (in_dyn + hidden_dim + 1))
        self.b_dyn = np.zeros(hidden_dim + 1)

        # 3. Prediction Network f: s (hidden_dim) -> [policy_logits (6), value (1)]
        self.w_pred = np.random.randn(hidden_dim, num_actions + 1) * np.sqrt(2.0 / (hidden_dim + num_actions + 1))
        self.b_pred = np.zeros(num_actions + 1)

        self.replay_buffer: List[Tuple[np.ndarray, np.ndarray, float, np.ndarray, bool]] = []
        self.total_simulations_run = 0
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
        e_x = np.exp(x - np.max(x))
        return e_x / np.sum(e_x)

    # 1. Representation: o -> s
    def representation(self, obs_vec: np.ndarray) -> np.ndarray:
        return np.tanh(np.dot(obs_vec, self.w_rep) + self.b_rep)

    # 2. Dynamics: (s, a) -> (s_next, r)
    def dynamics(self, s: np.ndarray, a: int) -> Tuple[np.ndarray, float]:
        one_hot = np.zeros(self.num_actions, dtype=np.float32)
        one_hot[a] = 1.0
        sa = np.concatenate([s, one_hot])
        out = np.dot(sa, self.w_dyn) + self.b_dyn
        s_next = np.tanh(out[:self.hidden_dim])
        reward = float(out[-1])
        return s_next, reward

    # 3. Prediction: s -> (pi, v)
    def prediction(self, s: np.ndarray) -> Tuple[np.ndarray, float]:
        out = np.dot(s, self.w_pred) + self.b_pred
        policy_logits = out[:self.num_actions]
        value = float(out[-1])
        probs = self._softmax(policy_logits)
        return probs, value

    def run_mcts(self, root_state: np.ndarray) -> Tuple[int, np.ndarray]:
        """Thực thi Monte Carlo Tree Search với công thức PUCT"""
        root = MCTSNode(prior=1.0)
        root.hidden_state = root_state
        init_policy, init_val = self.prediction(root_state)

        for a in range(self.num_actions):
            root.children[a] = MCTSNode(prior=float(init_policy[a]))

        for _ in range(self.num_simulations):
            self.total_simulations_run += 1
            node = root
            search_path = [node]
            action_path = []

            # 1. Selection (theo PUCT)
            while node.children and all(c.hidden_state is not None for c in node.children.values()):
                best_score = -float('inf')
                best_action = 0
                best_child = None
                total_visits = sum(c.visit_count for c in node.children.values())

                for a, child in node.children.items():
                    u = child.value + self.c_puct * child.prior * (math.sqrt(total_visits + 1) / (1 + child.visit_count))
                    if u > best_score:
                        best_score = u
                        best_action = a
                        best_child = child

                node = best_child
                search_path.append(node)
                action_path.append(best_action)

            # Chọn action mở rộng
            unexpanded_actions = [a for a, c in node.children.items() if c.hidden_state is None]
            if unexpanded_actions:
                act = random.choice(unexpanded_actions)
                child_node = node.children[act]
                action_path.append(act)
                search_path.append(child_node)

                # 2. Expansion qua Dynamics Model
                s_next, rew = self.dynamics(node.hidden_state, act)
                child_node.hidden_state = s_next
                child_node.reward = rew

                # 3. Evaluation qua Prediction Model
                probs, val = self.prediction(s_next)
                for a in range(self.num_actions):
                    child_node.children[a] = MCTSNode(prior=float(probs[a]))
            else:
                val = node.value

            # 4. Backpropagation
            g = val
            for idx in reversed(range(len(search_path))):
                curr = search_path[idx]
                curr.visit_count += 1
                curr.value_sum += g
                g = curr.reward + self.gamma * g

        # Tính policy mục tiêu từ số lần viếng thăm cây (visit counts)
        visits = np.array([root.children[a].visit_count for a in range(self.num_actions)], dtype=np.float32)
        sum_v = np.sum(visits)
        mcts_policy = visits / sum_v if sum_v > 0 else np.ones(self.num_actions) / self.num_actions

        best_action = int(np.argmax(visits))
        return best_action, mcts_policy

    def choose_action(self, obs: Dict[str, Any], greedy: bool = False) -> int:
        obs_vec = self.extract_state_vector(obs)
        root_state = self.representation(obs_vec)

        if greedy:
            # Chọn nhanh theo prediction
            probs, _ = self.prediction(root_state)
            return int(np.argmax(probs))

        # Thực thi cây tìm kiếm MCTS lookahead
        best_action, _ = self.run_mcts(root_state)
        return best_action

    def record_step(self, obs: Dict[str, Any], action: int, reward: float, next_obs: Dict[str, Any], done: bool):
        s = self.extract_state_vector(obs)
        s_next = self.extract_state_vector(next_obs)
        self.replay_buffer.append((s, action, reward, s_next, done))
        if len(self.replay_buffer) > 4000:
            self.replay_buffer.pop(0)

    def learn_step(self) -> float:
        """Cập nhật 3 mạng Representation, Dynamics, Prediction từ dữ liệu tương tác"""
        if len(self.replay_buffer) < 24:
            return 0.0

        self.training_steps += 1
        batch = random.sample(self.replay_buffer, 16)

        for s_curr, a, r, s_next, done in batch:
            # Representation
            h_s = self.representation(s_curr)
            probs, val = self.prediction(h_s)

            # Target Value
            target_v = r if done else (r + self.gamma * val)

            # Gradient prediction value
            err_v = (val - target_v) * self.lr
            self.w_pred[:, -1] -= (h_s * err_v)

            # Gradient policy toward chosen action
            target_pi = np.zeros(self.num_actions, dtype=np.float32)
            target_pi[a] = 1.0
            grad_pi = (probs - target_pi) * self.lr
            self.w_pred[:, :self.num_actions] -= np.outer(h_s, grad_pi)

            # Dynamics gradient
            one_hot = np.zeros(self.num_actions, dtype=np.float32)
            one_hot[a] = 1.0
            sa = np.concatenate([h_s, one_hot])
            h_next_true = self.representation(s_next)

            pred_dyn = np.dot(sa, self.w_dyn) + self.b_dyn
            err_dyn_s = (pred_dyn[:self.hidden_dim] - h_next_true) * self.lr * 0.5
            err_dyn_r = (pred_dyn[-1] - r) * self.lr * 0.5

            err_dyn = np.append(err_dyn_s, err_dyn_r)
            self.w_dyn -= np.outer(sa, err_dyn)
            self.b_dyn -= err_dyn

        return float(self.total_simulations_run)

    def export_policy(self) -> Dict[str, Any]:
        return {
            "algorithm": "muzero",
            "algorithm_name": "MuZero (DeepMind MCTS Planning)",
            "simulations": self.num_simulations,
            "weights": {
                "w_rep": self.w_rep.tolist(),
                "b_rep": self.b_rep.tolist(),
                "w_pred": self.w_pred.tolist(),
                "b_pred": self.b_pred.tolist()
            }
        }

    def load_policy(self, data: Dict[str, Any]):
        w = data.get("weights", {})
        if "w_rep" in w:
            self.w_rep = np.array(w["w_rep"], dtype=np.float32)
            self.b_rep = np.array(w["b_rep"], dtype=np.float32)
            self.w_pred = np.array(w["w_pred"], dtype=np.float32)
            self.b_pred = np.array(w["b_pred"], dtype=np.float32)
