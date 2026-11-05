from stable_baselines3 import PPO
from stable_baselines3.common.env_util import make_vec_env
from stable_baselines3.common.callbacks import BaseCallback
from ..envs.obstacle_avoidance import ObstacleAvoidanceEnv
from ..core.websocket_manager import manager
from ..core.config import settings
import time


class WSCallback(BaseCallback):
    def __init__(self):
        super().__init__()

    def _on_step(self) -> bool:
        infos = self.locals.get("infos", [{}])
        rewards = self.locals.get("rewards", [0])

        if len(infos) > 0 and "robot" in infos[0]:
            info = infos[0]
            data = {
                "type": "state",
                "mode": "train",
                "step": int(self.num_timesteps),
                "reward": float(rewards[0]),
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
    def __init__(self):
        self.model = None
        self.is_training = False
        self.is_playing = False

    def train(self, total_timesteps: int = None, n_envs: int = 1):
        if total_timesteps is None:
            total_timesteps = settings.DEFAULT_TIMESTEPS

        self.is_training = True
        env = make_vec_env(ObstacleAvoidanceEnv, n_envs=n_envs)

        self.model = PPO(
            "MlpPolicy",
            env,
            learning_rate=3e-4,
            n_steps=1024,
            batch_size=64,
            n_epochs=10,
            gamma=0.99,
            verbose=1,
            device=settings.DEVICE,
        )

        callback = WSCallback()
        self.model.learn(total_timesteps=total_timesteps, callback=callback)

        save_path = settings.MODELS_DIR / "obstacle_ppo_latest"
        self.model.save(str(save_path))
        self.is_training = False

        manager.broadcast_sync(
            {
                "type": "train_done",
                "message": "[THÀNH CÔNG] Huấn luyện PPO hoàn tất",
                "model_path": str(save_path),
            }
        )

    def load_model(self, model_name: str = "obstacle_ppo_latest"):
        path = settings.MODELS_DIR / model_name
        self.model = PPO.load(str(path), device=settings.DEVICE)
        return True

    def play(self, episodes: int = 3, speed: float = 0.05):
        if self.model is None:
            raise ValueError("No model loaded")

        self.is_playing = True
        env = ObstacleAvoidanceEnv(persist_internal=True)
        step_counter = 0

        for _ in range(episodes):
            if not self.is_playing:
                break
            obs, _ = env.reset()
            done = False

            while not done and self.is_playing:
                step_counter += 1
                action, _ = self.model.predict(obs, deterministic=True)
                obs, reward, terminated, truncated, info = env.step(action)
                done = terminated or truncated

                data = {
                    "type": "state",
                    "mode": "play",
                    "step": step_counter,
                    "reward": float(reward),
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

                time.sleep(speed)

        self.is_playing = False
        manager.broadcast_sync({"type": "play_done"})
