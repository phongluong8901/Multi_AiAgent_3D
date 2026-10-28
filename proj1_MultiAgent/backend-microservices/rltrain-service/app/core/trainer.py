import os
import json
import time
import threading
from typing import Dict, Any, List, Optional
from .environment import Navigation3DEnv
from .q_learning import QLearningAgent
from .ppo import PPOAgent
from .dqn import DQNAgent
from .sac import SACAgent
from .sac2 import SACAgent as SAC2Agent
from .dreamer import DreamerAgent
from .muzero import MuZeroAgent


class RLTrainer:
    """
    Manages RL Training lifecycle, background threads, and metric streaming
    for 3D navigation agents with support for 7 Modern RL Algorithms:
    - PPO (Proximal Policy Optimization - GAE Actor-Critic) [Recommended]
    - SAC (Soft Actor-Critic - Maximum Entropy RL)
    - SAC v2 (SAC with Auto-Alpha & Twin Critics)
    - Dreamer (World Models + Latent Imagination Planning)
    - MuZero (DeepMind's Model-based MCTS Lookahead Planning)
    - DQN (Double Deep Q-Network with Prioritized Replay)
    - Q-Learning (Tabular Q(lambda) with Eligibility Traces)
    """
    def __init__(self, saved_dir: str = "./saved_policies"):
        self.saved_dir = saved_dir
        os.makedirs(self.saved_dir, exist_ok=True)

        self.env = Navigation3DEnv()

        self.algorithm: str = "ppo"
        self.ppo_agent = PPOAgent()
        self.sac_agent = SACAgent()
        self.sac2_agent = SAC2Agent()
        self.dreamer_agent = DreamerAgent()
        self.muzero_agent = MuZeroAgent()
        self.dqn_agent = DQNAgent()
        self.q_agent = QLearningAgent()

        self.is_training: bool = False
        self.should_stop: bool = False
        self.training_thread: Optional[threading.Thread] = None

        self.current_episode: int = 0
        self.total_episodes: int = 500
        self.selected_agent_id: str = "agent_default"
        self.training_speed: float = 0.0  # 0.0 = max speed

        # Lưu trữ lịch sử chỉ số huấn luyện
        self.history: List[Dict[str, Any]] = []
        self.latest_trajectory: List[Dict[str, Any]] = []
        self.live_state: Dict[str, Any] = self.env.get_observation()

        # Thống kê rolling metrics
        self.best_reward: float = -9999.0
        self.success_count: int = 0
        self.collision_count: int = 0

    def get_algorithm_name(self, algo: Optional[str] = None) -> str:
        a = (algo or self.algorithm).lower()
        names = {
            "ppo": "PPO (Proximal Policy Optimization + GAE)",
            "sac": "SAC (Soft Actor-Critic - Max Entropy)",
            "sac2": "SAC v2 (Auto-Alpha + Twin Critics)",
            "dreamer": "Dreamer (World Model - Imagination)",
            "muzero": "MuZero (DeepMind MCTS Planning)",
            "dqn": "Double DQN (Prioritized Replay)",
            "q_learning": "Q-Learning (Q-Lambda Eligibility Traces)"
        }
        return names.get(a, "PPO (Proximal Policy Optimization + GAE)")

    def set_algorithm(self, algo: str) -> Dict[str, Any]:
        """Chuyển đổi thuật toán huấn luyện"""
        a = algo.lower()
        valid = ["ppo", "sac", "sac2", "dreamer", "muzero", "dqn", "q_learning"]
        if a not in valid:
            return {"success": False, "message": f"Thuật toán '{algo}' không hỗ trợ. Hãy chọn: {', '.join(valid)}."}

        self.pause_training()
        self.algorithm = a
        return {
            "success": True,
            "message": f"Đã chuyển sang thuật toán: {self.get_algorithm_name(a)}",
            "algorithm": self.algorithm,
            "algorithm_name": self.get_algorithm_name(a)
        }

    def start_training(
        self,
        agent_id: str = "agent_default",
        episodes: int = 500,
        learning_rate: float = 0.003,
        discount_factor: float = 0.98,
        epsilon_decay: float = 0.992,
        epsilon_min: float = 0.04,
        obstacles: Optional[List[Dict[str, float]]] = None,
        speed: float = 0.0,
        map_name: str = "office",
        algorithm: str = "ppo"
    ) -> Dict[str, Any]:
        """Bắt đầu phiên huấn luyện trong Background Thread"""
        if self.is_training:
            return {"success": False, "message": "Phiên huấn luyện đang chạy!"}

        if algorithm.lower() in ["ppo", "sac", "sac2", "dreamer", "muzero", "dqn", "q_learning"]:
            self.algorithm = algorithm.lower()

        self.selected_agent_id = agent_id
        # Huấn luyện liên tục (Incremental Learning): tiếp tục cộng thêm episode
        if self.current_episode >= self.total_episodes:
            self.total_episodes = self.current_episode + episodes
        else:
            self.total_episodes = max(self.total_episodes, self.current_episode + episodes)

        self.training_speed = speed
        self.should_stop = False

        self.env.set_map(map_name)
        if obstacles is not None:
            self.env.set_custom_obstacles(obstacles)

        # Cập nhật siêu tham số tương ứng cho thuật toán đang chạy (kèm bảo vệ ngưỡng an toàn)
        eff_gamma = max(0.95, min(0.995, discount_factor))
        if self.algorithm == "ppo":
            self.ppo_agent.lr_actor = learning_rate if learning_rate <= 0.01 else 0.0025
            self.ppo_agent.lr_critic = self.ppo_agent.lr_actor * 1.6
            self.ppo_agent.gamma = eff_gamma
        elif self.algorithm == "sac":
            self.sac_agent.lr_actor = learning_rate if learning_rate <= 0.01 else 0.002
            self.sac_agent.lr_critic = self.sac_agent.lr_actor * 1.5
            self.sac_agent.gamma = eff_gamma
        elif self.algorithm == "sac2":
            self.sac2_agent.lr_actor = learning_rate if learning_rate <= 0.01 else 0.0015
            self.sac2_agent.lr_critic = self.sac2_agent.lr_actor * 1.7
            self.sac2_agent.gamma = eff_gamma
        elif self.algorithm == "dreamer":
            self.dreamer_agent.lr_world = learning_rate if learning_rate <= 0.01 else 0.003
            self.dreamer_agent.lr_actor = self.dreamer_agent.lr_world * 0.65
            self.dreamer_agent.lr_critic = self.dreamer_agent.lr_world
            self.dreamer_agent.gamma = eff_gamma
        elif self.algorithm == "muzero":
            self.muzero_agent.lr = learning_rate if learning_rate <= 0.01 else 0.0025
            self.muzero_agent.gamma = eff_gamma
        elif self.algorithm == "dqn":
            self.dqn_agent.lr = learning_rate if learning_rate <= 0.01 else 0.003
            self.dqn_agent.gamma = eff_gamma
            self.dqn_agent.epsilon_decay = min(0.995, epsilon_decay)
            self.dqn_agent.epsilon_min = epsilon_min
        else:
            self.q_agent.alpha = learning_rate if learning_rate >= 0.05 else 0.22
            self.q_agent.gamma = eff_gamma
            self.q_agent.epsilon_decay = min(0.992, epsilon_decay)
            self.q_agent.epsilon_min = epsilon_min

        self.training_thread = threading.Thread(target=self._run_training_loop, daemon=True)
        self.training_thread.start()

        is_continuing = self.current_episode > 0
        mode_text = f"tiếp tục từ episode {self.current_episode} lên {self.total_episodes}" if is_continuing else f"{episodes} episodes"
        return {
            "success": True,
            "message": f"Bắt đầu huấn luyện {mode_text} với [{self.get_algorithm_name()}] cho Agent '{agent_id}'",
            "agent_id": agent_id,
            "algorithm": self.algorithm
        }

    def pause_training(self) -> Dict[str, Any]:
        """Tạm dừng huấn luyện"""
        self.should_stop = True
        self.is_training = False
        return {"success": True, "message": "Đã gửi lệnh tạm dừng huấn luyện."}

    def reset_training(self) -> Dict[str, Any]:
        """Reset toàn bộ chỉ số và môi trường"""
        self.pause_training()
        if self.training_thread and self.training_thread.is_alive():
            self.training_thread.join(timeout=1.0)

        self.current_episode = 0
        self.total_episodes = 300
        self.ppo_agent = PPOAgent()
        self.sac_agent = SACAgent()
        self.sac2_agent = SAC2Agent()
        self.dreamer_agent = DreamerAgent()
        self.muzero_agent = MuZeroAgent()
        self.dqn_agent = DQNAgent()
        self.q_agent = QLearningAgent()
        self.history = []
        self.latest_trajectory = []
        self.best_reward = -9999.0
        self.success_count = 0
        self.collision_count = 0
        self.live_state = self.env.reset()

        return {
            "success": True,
            "message": f"Đã reset toàn bộ thông số huấn luyện (Thuật toán hiện tại: {self.get_algorithm_name()})!"
        }

    def set_map(self, map_name: str) -> Dict[str, Any]:
        """Chuyển đổi bản đồ tức thì và cập nhật lại live_state"""
        self.pause_training()
        self.env.set_map(map_name)
        obs = self.env.reset()
        self.live_state = obs
        self.latest_trajectory = []
        return {
            "success": True,
            "message": f"Đã chuyển sang bản đồ '{map_name}'",
            "map_name": map_name,
            "live_state": obs
        }

    def _run_training_loop(self):
        self.is_training = True

        while self.current_episode < self.total_episodes and not self.should_stop:
            self.current_episode += 1
            obs = self.env.reset(episode_num=self.current_episode)
            episode_reward = 0.0
            steps = 0
            trajectory = []

            done = False
            while not done and not self.should_stop:
                steps += 1

                # 1. Chọn hành động và học theo thuật toán được chọn
                if self.algorithm == "ppo":
                    action, log_prob = self.ppo_agent.choose_action(obs, greedy=False)
                    next_obs, reward, done, info = self.env.step(action)
                    self.ppo_agent.record_step(obs, action, reward, done, log_prob, next_obs=next_obs)
                elif self.algorithm == "sac":
                    action = self.sac_agent.choose_action(obs, greedy=False)
                    next_obs, reward, done, info = self.env.step(action)
                    self.sac_agent.record_step(obs, action, reward, next_obs, done)
                    if steps % 2 == 0 or done:
                        self.sac_agent.learn_step()
                elif self.algorithm == "sac2":
                    action = self.sac2_agent.choose_action(obs, greedy=False)
                    next_obs, reward, done, info = self.env.step(action)
                    self.sac2_agent.record_step(obs, action, reward, next_obs, done)
                    if steps % 2 == 0 or done:
                        self.sac2_agent.learn_step()
                elif self.algorithm == "dreamer":
                    action = self.dreamer_agent.choose_action(obs, greedy=False)
                    next_obs, reward, done, info = self.env.step(action)
                    self.dreamer_agent.record_step(obs, action, reward, next_obs, done)
                    if steps % 2 == 0 or done:
                        self.dreamer_agent.learn_step()
                elif self.algorithm == "muzero":
                    action = self.muzero_agent.choose_action(obs, greedy=False)
                    next_obs, reward, done, info = self.env.step(action)
                    self.muzero_agent.record_step(obs, action, reward, next_obs, done)
                    if steps % 2 == 0 or done:
                        self.muzero_agent.learn_step()
                elif self.algorithm == "dqn":
                    action = self.dqn_agent.choose_action(obs, greedy=False)
                    next_obs, reward, done, info = self.env.step(action)
                    self.dqn_agent.record_step(obs, action, reward, next_obs, done)
                    if steps % 2 == 0 or done:
                        self.dqn_agent.learn_step()
                else:  # q_learning
                    state_key = self.q_agent.get_state_key(obs)
                    action = self.q_agent.choose_action(state_key, greedy=False)
                    next_obs, reward, done, info = self.env.step(action)
                    next_state_key = self.q_agent.get_state_key(next_obs)
                    self.q_agent.learn(state_key, action, reward, next_state_key, done)

                episode_reward += reward
                obs = next_obs

                # Ghi lại bước di chuyển để Three.js xem diễn hoạt
                trajectory.append({
                    "step": steps,
                    "agent": obs["agent"],
                    "goal": obs["goal"],
                    "action": action,
                    "action_name": info["action_name"],
                    "reward": round(reward, 2),
                    "done": done,
                    "lidar": obs["lidar"]
                })

                if self.training_speed > 0:
                    self.live_state = obs
                    time.sleep(self.training_speed)
                elif steps % 4 == 0:
                    self.live_state = obs
                    time.sleep(0.002)

            # Cập nhật cuối mỗi episode
            if self.algorithm == "ppo":
                self.ppo_agent.learn_episode()
                epsilon_val = round(max(0.003, self.ppo_agent.entropy_coef * (0.996 ** self.ppo_agent.training_steps)), 4)
                states_val = self.ppo_agent.training_steps
            elif self.algorithm == "sac":
                epsilon_val = round(float(self.sac_agent.alpha), 4)
                states_val = len(self.sac_agent.replay_buffer)
            elif self.algorithm == "sac2":
                epsilon_val = round(float(self.sac2_agent.alpha), 4)
                states_val = len(self.sac2_agent.replay_buffer)
            elif self.algorithm == "dreamer":
                epsilon_val = float(self.dreamer_agent.horizon)
                states_val = self.dreamer_agent.imagined_steps_count
            elif self.algorithm == "muzero":
                epsilon_val = float(self.muzero_agent.num_simulations)
                states_val = self.muzero_agent.total_simulations_run
            elif self.algorithm == "dqn":
                self.dqn_agent.decay_epsilon()
                epsilon_val = round(self.dqn_agent.epsilon, 4)
                states_val = len(self.dqn_agent.replay_buffer)
            else:
                self.q_agent.decay_epsilon()
                epsilon_val = round(self.q_agent.epsilon, 4)
                states_val = len(self.q_agent.q_table)

            # Cập nhật thống kê
            if info.get("goal_reached"):
                self.success_count += 1
            if info.get("collision"):
                self.collision_count += 1

            self.best_reward = max(self.best_reward, episode_reward)
            self.latest_trajectory = trajectory
            self.live_state = obs

            ep_metric = {
                "episode": self.current_episode,
                "reward": round(episode_reward, 2),
                "steps": steps,
                "success": bool(info.get("goal_reached", False)),
                "reason": info.get("reason", "unknown"),
                "epsilon": epsilon_val,
                "states_learned": states_val,
                "algorithm": self.algorithm
            }
            self.history.append(ep_metric)
            if len(self.history) > 500:
                self.history.pop(0)

        self.is_training = False

    def get_status(self) -> Dict[str, Any]:
        """Trả về trạng thái và metrics thời gian thực để Frontend cập nhật"""
        recent_history = self.history[-30:] if self.history else []
        recent_success = sum(1 for h in recent_history if h.get("success"))
        recent_success_rate = (recent_success / len(recent_history) * 100.0) if recent_history else 0.0
        avg_reward = (sum(h["reward"] for h in recent_history) / len(recent_history)) if recent_history else 0.0

        if self.algorithm == "ppo":
            states_learned = self.ppo_agent.training_steps
            eps = round(max(0.003, self.ppo_agent.entropy_coef * (0.996 ** self.ppo_agent.training_steps)), 4)
        elif self.algorithm == "sac":
            states_learned = len(self.sac_agent.replay_buffer)
            eps = round(float(self.sac_agent.alpha), 4)
        elif self.algorithm == "sac2":
            states_learned = len(self.sac2_agent.replay_buffer)
            eps = round(float(self.sac2_agent.alpha), 4)
        elif self.algorithm == "dreamer":
            states_learned = self.dreamer_agent.imagined_steps_count
            eps = float(self.dreamer_agent.horizon)
        elif self.algorithm == "muzero":
            states_learned = self.muzero_agent.total_simulations_run
            eps = float(self.muzero_agent.num_simulations)
        elif self.algorithm == "dqn":
            states_learned = len(self.dqn_agent.replay_buffer)
            eps = round(self.dqn_agent.epsilon, 4)
        else:
            states_learned = len(self.q_agent.q_table)
            eps = round(self.q_agent.epsilon, 4)

        return {
            "is_training": self.is_training,
            "agent_id": self.selected_agent_id,
            "algorithm": self.algorithm,
            "algorithm_name": self.get_algorithm_name(),
            "current_episode": self.current_episode,
            "total_episodes": self.total_episodes,
            "progress_percent": round((self.current_episode / max(1, self.total_episodes)) * 100, 1),
            "epsilon": eps,
            "best_reward": round(self.best_reward if self.best_reward != -9999.0 else 0.0, 2),
            "avg_reward_30": round(avg_reward, 2),
            "success_rate_30": round(recent_success_rate, 1),
            "total_success": self.success_count,
            "total_collision": self.collision_count,
            "states_learned": states_learned,
            "live_state": self.live_state,
            "latest_trajectory": self.latest_trajectory[-60:],
            "metrics_history": self.history[-100:]
        }

    def step_manual(self, action: Optional[int] = None) -> Dict[str, Any]:
        """Thực thi 1 bước đơn lẻ trong chế độ mô phỏng tương tác Three.js"""
        obs = self.live_state

        if action is None:
            if self.algorithm == "ppo":
                action, _ = self.ppo_agent.choose_action(obs, greedy=True)
            elif self.algorithm == "sac":
                action = self.sac_agent.choose_action(obs, greedy=True)
            elif self.algorithm == "sac2":
                action = self.sac2_agent.choose_action(obs, greedy=True)
            elif self.algorithm == "dreamer":
                action = self.dreamer_agent.choose_action(obs, greedy=True)
            elif self.algorithm == "muzero":
                action = self.muzero_agent.choose_action(obs, greedy=True)
            elif self.algorithm == "dqn":
                action = self.dqn_agent.choose_action(obs, greedy=True)
            else:
                state_key = self.q_agent.get_state_key(obs)
                action = self.q_agent.choose_action(state_key, greedy=True)

        next_obs, reward, done, info = self.env.step(action)
        self.live_state = next_obs

        if done:
            self.live_state = self.env.reset(episode_num=max(1, self.current_episode))

        return {
            "observation": next_obs,
            "action": action,
            "action_name": info["action_name"],
            "reward": round(reward, 2),
            "done": done,
            "info": info
        }

    def save_policy(self, policy_name: str) -> Dict[str, Any]:
        """Lưu file chính sách điều hướng đã train xuống ổ đĩa"""
        filename = f"{policy_name}.json"
        filepath = os.path.join(self.saved_dir, filename)

        if self.algorithm == "ppo":
            policy_data = self.ppo_agent.export_policy()
        elif self.algorithm == "sac":
            policy_data = self.sac_agent.export_policy()
        elif self.algorithm == "sac2":
            policy_data = self.sac2_agent.export_policy()
        elif self.algorithm == "dreamer":
            policy_data = self.dreamer_agent.export_policy()
        elif self.algorithm == "muzero":
            policy_data = self.muzero_agent.export_policy()
        elif self.algorithm == "dqn":
            policy_data = self.dqn_agent.export_policy()
        else:
            policy_data = self.q_agent.export_policy()

        data = {
            "policy_name": policy_name,
            "algorithm": self.algorithm,
            "algorithm_name": self.get_algorithm_name(),
            "agent_id": self.selected_agent_id,
            "episodes_trained": self.current_episode,
            "policy": policy_data,
            "timestamp": time.time()
        }
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return {"success": True, "filename": filename, "path": filepath, "algorithm": self.algorithm}

    def load_policy(self, policy_name: str) -> Dict[str, Any]:
        """Nạp lại chính sách từ file và tự động nhận diện thuật toán đã lưu"""
        filename = f"{policy_name}.json" if not policy_name.endswith(".json") else policy_name
        filepath = os.path.join(self.saved_dir, filename)
        if not os.path.exists(filepath):
            return {"success": False, "message": f"Không tìm thấy file policy '{filename}'"}

        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        pol = data.get("policy", {})
        raw_algo = (data.get("algorithm") or pol.get("algorithm") or "q_learning").lower().replace("-", "_")
        if raw_algo not in ["ppo", "sac", "sac2", "dreamer", "muzero", "dqn", "q_learning"]:
            raw_algo = "q_learning"

        self.algorithm = raw_algo

        if raw_algo == "ppo":
            self.ppo_agent.import_policy(pol)
        elif raw_algo == "sac":
            self.sac_agent.load_policy(pol)
        elif raw_algo == "sac2":
            self.sac2_agent.load_policy(pol)
        elif raw_algo == "dreamer":
            self.dreamer_agent.load_policy(pol)
        elif raw_algo == "muzero":
            self.muzero_agent.load_policy(pol)
        elif raw_algo == "dqn":
            self.dqn_agent.load_policy(pol)
        else:
            self.q_agent.load_policy(pol)

        self.selected_agent_id = data.get("agent_id", self.selected_agent_id)
        return {
            "success": True,
            "message": f"Nạp thành công policy '{policy_name}' với thuật toán [{self.get_algorithm_name()}]",
            "algorithm": self.algorithm,
            "data": data
        }

    def list_saved_policies(self) -> List[Dict[str, Any]]:
        """Lấy danh sách các policy đã lưu"""
        policies = []
        if os.path.exists(self.saved_dir):
            for fname in os.listdir(self.saved_dir):
                if fname.endswith(".json"):
                    fpath = os.path.join(self.saved_dir, fname)
                    try:
                        with open(fpath, "r", encoding="utf-8") as f:
                            d = json.load(f)
                            pol = d.get("policy", {})
                            states_count = (
                                pol.get("states_learned")
                                or pol.get("training_steps")
                                or len(pol.get("q_table", {}))
                                or d.get("episodes_trained", 0)
                            )
                            policies.append({
                                "name": fname[:-5],
                                "algorithm": d.get("algorithm") or pol.get("algorithm", "q_learning"),
                                "algorithm_name": d.get("algorithm_name") or pol.get("algorithm_name", "Q-Learning"),
                                "agent_id": d.get("agent_id", "unknown"),
                                "episodes": d.get("episodes_trained", 0),
                                "states": states_count
                            })
                    except Exception:
                        pass
        return policies


# Singleton instance
trainer = RLTrainer()
