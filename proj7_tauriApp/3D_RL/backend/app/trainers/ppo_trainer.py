import collections
import time
from typing import Optional, Deque
from stable_baselines3 import PPO
from stable_baselines3.common.env_util import make_vec_env
from stable_baselines3.common.callbacks import BaseCallback
from ..envs.child_world_env import ChildWorldEnv
from ..envs.obstacle_avoidance import ObstacleAvoidanceEnv
from ..core.websocket_manager import manager
from ..core.config import settings


class WSCallback(BaseCallback):
    """
    Callback gui du lieu huan luyen PPO truc tiep qua WebSocket ve frontend:
    - Cap nhat tien do % va diem thuong trung binh (moving average 30 buoc).
    - Phat song luong toa do robot va the gioi moi 4 buoc de nguoi dung theo doi be hoc truc tiep.
    """

    def __init__(self, total_timesteps: int):
        """
        Khoi tao callback PPO.

        Args:
            total_timesteps (int): Tong so buoc timesteps cua khoa huan luyen.
        """
        super().__init__()
        self.total_timesteps = max(1, total_timesteps)
        self.last_broadcast_step = 0
        self.reward_window: Deque[float] = collections.deque(maxlen=30)

    def _on_step(self) -> bool:
        """
        Ham callback duoc Stable-Baselines3 goi tai moi buoc tuong tac moi truong.

        Returns:
            bool: Luon tra ve True de tiep tuc huan luyen.
        """
        infos = self.locals.get("infos", [{}])
        rewards = self.locals.get("rewards", [0.0])

        current_reward = float(rewards[0]) if len(rewards) > 0 else 0.0
        self.reward_window.append(current_reward)

        # Phat telemetry tien do % moi 50 buoc
        if self.num_timesteps - self.last_broadcast_step >= 50:
            self.last_broadcast_step = self.num_timesteps
            pct = min(100.0, (self.num_timesteps / self.total_timesteps) * 100.0)
            avg_reward = (
                sum(self.reward_window) / len(self.reward_window)
                if len(self.reward_window) > 0
                else 0.0
            )

            try:
                manager.broadcast_sync(
                    {
                        "type": "train_progress",
                        "step": int(self.num_timesteps),
                        "total_steps": int(self.total_timesteps),
                        "pct": round(pct, 1),
                        "reward": round(avg_reward, 2),
                    }
                )
            except Exception:
                pass

        # Cap nhat hinh anh khong gian 3D moi 4 buoc
        if self.num_timesteps % 4 == 0 and len(infos) > 0 and "robot" in infos[0]:
            info = infos[0]
            data = {
                "type": "state",
                "mode": "train",
                "step": int(self.num_timesteps),
                "reward": float(current_reward),
                "robot": info["robot"],
                "goal": info["goal"],
                "food": info.get("food", [3.0, 17.0]),
                "water": info.get("water", [17.0, 3.0]),
                "bed": info.get("bed", [2.5, 2.5]),
                "obstacles": info["obstacles"],
                "dist": info.get("dist_to_goal", 0.0),
                "collided": info.get("collided", False),
                "ate_food": info.get("ate_food", False),
                "drank_water": info.get("drank_water", False),
                "is_resting": info.get("is_resting", False),
                "energy_state": info.get("energy_state"),
                "drives_state": info.get("drives_state"),
            }
            try:
                manager.broadcast_sync(data)
            except Exception:
                pass

        return True


class PPOTrainer:
    """
    Huan luyen vien Hoc Tang Cuong PPO (Proximal Policy Optimization):
    - Su dung thu vien Stable-Baselines3 voi kien truc MlpPolicy.
    - Ho tro chay song song n_envs moi truong de tang toc do thu thap mau.
    - Tu dong luu checkpoint vao models/obstacle_ppo_latest.zip.
    - Cung cap ham play() de bieu dien hanh vi theo mo hinh da huan luyen.
    """

    def __init__(self):
        """Khoi tao the hien PPOTrainer."""
        self.model = None
        self.is_training: bool = False
        self.is_playing: bool = False

    def train(self, total_timesteps: Optional[int] = None, n_envs: int = 1):
        """
        Bat dau tien trinh huan luyen PPO.

        Args:
            total_timesteps (Optional[int]): Tong so buoc timesteps (mac dinh 80_000).
            n_envs (int): So luong moi truong vector chay dong thoi (1 - 8).
        """
        if total_timesteps is None or total_timesteps <= 0:
            total_timesteps = settings.DEFAULT_TIMESTEPS

        self.is_training = True
        try:
            env = make_vec_env(ObstacleAvoidanceEnv, n_envs=n_envs)

            self.model = PPO(
                "MlpPolicy",
                env,
                learning_rate=3e-4,
                n_steps=min(1024, total_timesteps),
                batch_size=64,
                n_epochs=10,
                gamma=0.99,
                verbose=0,
                device=settings.DEVICE,
            )

            callback = WSCallback(total_timesteps=total_timesteps)
            self.model.learn(total_timesteps=total_timesteps, callback=callback)

            save_path = settings.MODELS_DIR / "obstacle_ppo_latest"
            self.model.save(str(save_path))

            manager.broadcast_sync(
                {
                    "type": "train_done",
                    "message": f"[THÀNH CÔNG] Huấn luyện PPO hoàn tất ({total_timesteps} bước)",
                    "model_path": str(save_path),
                }
            )
        finally:
            self.is_training = False

    def load_model(self, model_name: str = "obstacle_ppo_latest") -> bool:
        """
        Nap mo hinh PPO da huan luyen tu thu muc models/.

        Args:
            model_name (str): Ten file mo hinh (khong can duoi .zip).

        Returns:
            bool: True neu nap thanh cong, False neu that bai.
        """
        path = settings.MODELS_DIR / model_name
        if not path.with_suffix(".zip").exists() and not path.exists():
            return False
        try:
            self.model = PPO.load(str(path), device=settings.DEVICE)
            return True
        except Exception:
            return False

    def play(self, episodes: int = 3, speed: float = 0.05):
        """
        Bieu dien be tu chay theo chinh sach cua mo hinh PPO da hoc.

        Args:
            episodes (int): So tap bieu dien.
            speed (float): Thoi gian tam dung giua cac buoc (giay).
        """
        if self.model is None:
            if not self.load_model():
                raise ValueError("Chưa có mô hình nào được nạp")

        self.is_playing = True
        env = ObstacleAvoidanceEnv(persist_internal=True)
        step_counter = 0

        try:
            for _ in range(episodes):
                if not self.is_playing:
                    break

                obs, info = env.reset()
                done = False

                while not done and self.is_playing:
                    action, _ = self.model.predict(obs, deterministic=True)
                    obs, reward, terminated, truncated, info = env.step(action)
                    done = terminated or truncated
                    step_counter += 1

                    data = {
                        "type": "state",
                        "mode": "play",
                        "step": step_counter,
                        "reward": float(reward),
                        "robot": info["robot"],
                        "goal": info["goal"],
                        "food": info["food"],
                        "water": info["water"],
                        "bed": info["bed"],
                        "obstacles": info["obstacles"],
                        "dist": info["dist_to_goal"],
                        "collided": info["collided"],
                        "ate_food": info["ate_food"],
                        "drank_water": info["drank_water"],
                        "is_resting": info["is_resting"],
                        "energy_state": info["energy_state"],
                        "drives_state": info["drives_state"],
                        "current_thought": "Mình đang tự điều khiển bước đi theo mô hình đã học...",
                        "current_goal_name": "Mục tiêu PPO",
                        "current_goal_pos": info["goal"],
                    }

                    manager.broadcast_sync(data)
                    time.sleep(speed)
        finally:
            self.is_playing = False


# The hien singleton toan cuc
ppo_trainer = PPOTrainer()
