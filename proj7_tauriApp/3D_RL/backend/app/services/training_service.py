from typing import Dict, Any, List
import numpy as np
from ..trainers.ppo_trainer import PPOTrainer
from ..envs.child_world_env import ChildWorldEnv
from ..core.persistence import persistence_manager


class TrainingService:
    def __init__(self):
        self.trainer = PPOTrainer()
        self.world_env = ChildWorldEnv(persist_internal=True)
        self.interactive_step: int = 0

        # Auto-load persisted state on startup if available
        saved = persistence_manager.load_agent_state()
        if saved:
            self.world_env.import_state(saved)
            self.interactive_step = int(saved.get("step", 0))

    @property
    def is_training(self) -> bool:
        return self.trainer.is_training

    @property
    def is_playing(self) -> bool:
        return self.trainer.is_playing

    def get_current_snapshot(self, mode: str = "idle", reward: float = 0.0) -> Dict[str, Any]:
        info = self.world_env.get_info()
        return {
            "type": "state",
            "mode": mode,
            "step": self.interactive_step,
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
            "demo_count": persistence_manager.get_demo_count(),
        }

    def teacher_step(self, action: List[float], record: bool = True) -> Dict[str, Any]:
        """
        Execute one environment step controlled directly by the Teacher (WASD/Arrows).
        Optionally records (obs, action, drives, energy, reward) to SQLite for Imitation Learning.
        """
        obs_before = self.world_env._get_obs().tolist()
        act_arr = np.array(action[:2], dtype=np.float32)

        self.interactive_step += 1
        _, reward, terminated, _, info = self.world_env.step(act_arr)

        # Record non-zero teacher action as demonstration
        demo_count = persistence_manager.get_demo_count()
        if record and float(np.linalg.norm(act_arr)) > 0.01:
            demo_count = persistence_manager.record_demonstration(
                obs=obs_before,
                action=act_arr.tolist(),
                drives=info["drives_state"]["drives"],
                energy=info["energy_state"]["energy"],
                reward=float(reward),
            )

        if terminated:
            # Respawn at bed while preserving internal Energy & Drives
            self.world_env.reset()

        return {
            "type": "state",
            "mode": "teacher",
            "step": self.interactive_step,
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
            "demo_count": demo_count,
        }

    def feed_agent(self, kcal: float = 250.0) -> Dict[str, Any]:
        self.world_env.energy_sys.eat(kcal=kcal)
        self.world_env.drive_sys.drives["hunger"] = float(
            max(0.0, self.world_env.drive_sys.drives["hunger"] - 0.35)
        )
        return self.get_current_snapshot(mode="idle")

    def rest_agent(self) -> Dict[str, Any]:
        self.world_env.energy_sys.rest(duration_sec=3.0)
        self.world_env.drive_sys.drives["fatigue"] = self.world_env.energy_sys.fatigue
        self.world_env.drive_sys.drives["pain"] = float(
            max(0.0, self.world_env.drive_sys.drives["pain"] - 0.3)
        )
        self.world_env.drive_sys.drives["fear"] = float(
            max(0.0, self.world_env.drive_sys.drives["fear"] - 0.3)
        )
        return self.get_current_snapshot(mode="idle")

    def save_state(self) -> Dict[str, Any]:
        state = self.world_env.export_state()
        state["step"] = self.interactive_step
        ok = persistence_manager.save_agent_state(state)
        return {
            "status": "saved" if ok else "error",
            "demo_count": persistence_manager.get_demo_count(),
            "state": self.get_current_snapshot(),
        }

    def load_state(self) -> Dict[str, Any]:
        saved = persistence_manager.load_agent_state()
        if not saved:
            return {"status": "not_found", "state": self.get_current_snapshot()}
        self.world_env.import_state(saved)
        self.interactive_step = int(saved.get("step", self.interactive_step))
        return {
            "status": "loaded",
            "demo_count": persistence_manager.get_demo_count(),
            "state": self.get_current_snapshot(),
        }

    def reset_world(self, full_reset: bool = True) -> Dict[str, Any]:
        if full_reset:
            self.world_env.persist_internal = False
            self.world_env.reset()
            self.world_env.persist_internal = True
            self.interactive_step = 0
        else:
            self.world_env.reset()
        return self.get_current_snapshot(mode="idle")

    def clear_demos(self) -> int:
        return persistence_manager.clear_demonstrations()

    def start_training(self, timesteps: int = 80000, n_envs: int = 1):
        if self.is_training:
            return False
        self.trainer.train(total_timesteps=timesteps, n_envs=n_envs)
        return True

    def load_model(self, model_name: str):
        return self.trainer.load_model(model_name)

    def start_play(self, episodes: int = 3):
        if self.trainer.model is None:
            raise ValueError("No model loaded")
        self.trainer.play(episodes=episodes)
        return True

    def stop_play(self):
        self.trainer.is_playing = False


training_service = TrainingService()
