import gymnasium as gym
from gymnasium import spaces
import numpy as np
from typing import Dict, Any, Optional, Tuple
import os

# ==============================================================================
# 1. BIOLOGICAL ENERGY SYSTEM (Kcal & Fatigue)
# ==============================================================================

class EnergySystem:
    def __init__(self, energy: float = 800.0, energy_max: float = 1000.0, basal_rate: float = 1.2):
        self.energy_max: float = float(energy_max)
        self.energy: float = float(np.clip(energy, 0.0, self.energy_max))
        self.digesting: float = 0.0
        self.fatigue: float = 0.0
        self.basal_rate: float = float(basal_rate)
        self.motor_cost_coeff: float = 3.5
        self.cognitive_cost_coeff: float = 1.0
        self.stress_cost_coeff: float = 1.5
        self.digestion_rate: float = 18.0

    @property
    def energy_ratio(self) -> float:
        return float(np.clip(self.energy / max(self.energy_max, 1.0), 0.0, 1.0))

    @property
    def alpha_motor(self) -> float:
        energy_factor = np.clip(self.energy / (0.3 * self.energy_max), 0.2, 1.0)
        fatigue_factor = 1.0 - 0.55 * self.fatigue
        return float(np.clip(energy_factor * fatigue_factor, 0.2, 1.0))

    def step(self, dt: float, motor_force_norm: float = 0.0, cognitive_load: float = 0.1,
             stress_level: float = 0.0, is_resting: bool = False) -> Dict[str, float]:
        if is_resting:
            self.energy = min(self.energy_max, self.energy - 0.3 * self.basal_rate * dt)
            self.fatigue = max(0.0, self.fatigue - 0.05 * dt)
        else:
            cost = (self.basal_rate
                    + self.motor_cost_coeff * motor_force_norm
                    + self.cognitive_cost_coeff * cognitive_load
                    + self.stress_cost_coeff * stress_level) * dt
            self.energy = max(0.0, self.energy - cost)
            self.fatigue = min(1.0, self.fatigue + 0.003 * dt * (1.0 + motor_force_norm))

        if self.digesting > 0.0:
            absorbed = min(self.digesting, self.digestion_rate * dt)
            self.digesting -= absorbed
            self.energy = min(self.energy_max, self.energy + absorbed)

        return {"energy": self.energy, "energy_ratio": self.energy_ratio, "fatigue": self.fatigue}

    def eat(self, kcal: float = 120.0):
        self.digesting = min(400.0, self.digesting + kcal)

    def rest(self, duration_sec: float = 2.0):
        self.fatigue = max(0.0, self.fatigue - 0.12 * duration_sec)


# ==============================================================================
# 2. INTERNAL DRIVE SYSTEM (Homeostasis)
# ==============================================================================

class DriveSystem:
    DRIVE_NAMES = ("hunger", "thirst", "fatigue", "pain", "fear", "curiosity", "comfort", "social")

    def __init__(self):
        self.drives: Dict[str, float] = {
            "hunger": 0.20,
            "thirst": 0.15,
            "fatigue": 0.10,
            "pain": 0.00,
            "fear": 0.00,
            "curiosity": 0.55,
            "comfort": 0.85,
            "social": 0.30,
        }

    def step(self, dt: float, energy_sys: EnergySystem, events: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        events = events or {}

        # Hunger
        hunger_drift = 0.0035 * dt
        if energy_sys.energy_ratio < 0.4:
            hunger_drift += (0.4 - energy_sys.energy_ratio) * 0.02 * dt
        self.drives["hunger"] = float(np.clip(self.drives["hunger"] + hunger_drift, 0.0, 1.0))
        if events.get("ate_food", False):
            self.drives["hunger"] = max(0.0, self.drives["hunger"] - 0.40)

        # Thirst
        self.drives["thirst"] = float(np.clip(self.drives["thirst"] + 0.0045 * dt, 0.0, 1.0))
        if events.get("drank_water", False):
            self.drives["thirst"] = max(0.0, self.drives["thirst"] - 0.50)

        # Fatigue
        self.drives["fatigue"] = energy_sys.fatigue
        if events.get("is_resting", False):
            self.drives["fatigue"] = max(0.0, self.drives["fatigue"] - 0.08 * dt)

        # Pain & Hazard
        if events.get("collided", False):
            self.drives["pain"] = min(1.0, self.drives["pain"] + 0.60)
            self.drives["fear"] = min(1.0, self.drives["fear"] + 0.45)
        else:
            self.drives["pain"] = max(0.0, self.drives["pain"] - 0.15 * dt)
            self.drives["fear"] = max(0.0, self.drives["fear"] - 0.10 * dt)

        # Curiosity
        self.drives["curiosity"] = float(np.clip(self.drives["curiosity"] + 0.002 * dt, 0.0, 1.0))

        return {"drives": dict(self.drives)}


# ==============================================================================
# 3. 60x60 CITY ENVIRONMENT (Gymnasium Compatible for PPO)
# ==============================================================================

class ChildWorldEnv(gym.Env):
    """
    City Map 60x60 Environment compatible with local ChildWorldEnv & ObstacleAvoidanceEnv.
    - Observation Space: 28 dimensions
    - Action Space: 2 dimensions continuous velocity [vx, vz] in range [-2.4, 2.4]
    - 14 physical city obstacles with distinct collision radii
    """
    metadata = {"render_modes": ["human"]}

    def __init__(self, is_gym_training: bool = True):
        super().__init__()
        self.world_size: float = 60.0
        self.robot_radius: float = 0.45
        self.goal_radius: float = 1.20
        self.zone_radius: float = 1.60
        self.max_speed: float = 2.4
        self.dt: float = 0.05
        self.is_gym_training: bool = is_gym_training

        # Urban zones
        self.bed_pos = np.array([8.0, 8.0], dtype=np.float32)
        self.pool_pos = np.array([45.0, 14.0], dtype=np.float32)
        self.park_pos = np.array([14.0, 44.0], dtype=np.float32)
        self.water_pos = np.array([39.0, 8.0], dtype=np.float32)
        self.food_pos = np.array([46.0, 44.0], dtype=np.float32)
        self.goal_pos = np.array([10.0, 52.0], dtype=np.float32)
        self.robot_pos = np.array([8.0, 14.0], dtype=np.float32)

        # 14 physical obstacles
        self.city_obstacles = np.array([
            [12.0, 12.0],  # Villa
            [24.0, 10.0],  # Mini Mart
            [10.0, 24.0],  # Apartment Tower
            [24.0, 24.0],  # Commercial Row
            [30.0, 16.0],  # Sedan
            [46.0, 36.0],  # SUV
            [52.0, 44.0],  # Van
            [16.0, 32.0],  # Taxi
            [45.0, 14.0],  # Pool Fence
            [53.0, 8.0],   # Lifeguard Post
            [14.0, 44.0],  # Playground Slide
            [14.0, 52.0],  # Stone Flowerbed
            [30.0, 30.0],  # Intersection Booth
            [48.0, 50.0],  # Clock Tower
        ], dtype=np.float32)

        self.city_obstacle_radii = np.array([
            3.4, 2.8, 3.2, 2.6, 1.8, 1.9, 2.2, 1.8, 3.8, 1.6, 2.4, 2.0, 1.6, 2.2
        ], dtype=np.float32)

        self.num_obstacles = 6
        self.obstacles = self.city_obstacles[:6]

        self.action_space = spaces.Box(
            low=-self.max_speed,
            high=self.max_speed,
            shape=(2,),
            dtype=np.float32,
        )

        obs_dim = 2 + 2 + 2 + 2 + 2 + (self.num_obstacles * 2) + 6  # 28 dims
        self.observation_space = spaces.Box(
            low=-np.inf,
            high=np.inf,
            shape=(obs_dim,),
            dtype=np.float32,
        )

        self.energy_sys = EnergySystem(energy=800.0, energy_max=1000.0)
        self.drive_sys = DriveSystem()

        self.episode_steps: int = 0
        self.max_episode_steps: int = 600

    def get_safe_random_pos(self, min_wall_dist: float = 3.5, min_obs_dist: float = 2.0,
                            avoid_points: Optional[list] = None, min_avoid_dist: float = 5.0) -> np.ndarray:
        avoid_points = avoid_points or []
        for _ in range(300):
            rx = float(np.random.uniform(min_wall_dist, self.world_size - min_wall_dist))
            rz = float(np.random.uniform(min_wall_dist, self.world_size - min_wall_dist))
            candidate = np.array([rx, rz], dtype=np.float32)

            obs_safe = True
            for obs, rad in zip(self.city_obstacles, self.city_obstacle_radii):
                if float(np.linalg.norm(candidate - obs)) < (rad + min_obs_dist):
                    obs_safe = False
                    break
            if not obs_safe:
                continue

            avoid_safe = True
            for pt in avoid_points:
                if pt is not None and float(np.linalg.norm(candidate - np.asarray(pt, dtype=np.float32))) < min_avoid_dist:
                    avoid_safe = False
                    break
            if not avoid_safe:
                continue

            return np.array([round(rx, 2), round(rz, 2)], dtype=np.float32)

        return np.array([float(np.random.uniform(5.0, 55.0)), float(np.random.uniform(5.0, 55.0))], dtype=np.float32)

    def reset(self, seed: Optional[int] = None, options: Optional[Dict[str, Any]] = None) -> Tuple[np.ndarray, Dict[str, Any]]:
        super().reset(seed=seed)
        self.robot_pos = self.get_safe_random_pos(min_wall_dist=4.0, min_obs_dist=2.2)
        self.goal_pos = self.get_safe_random_pos(
            min_wall_dist=4.0, min_obs_dist=2.5,
            avoid_points=[self.robot_pos], min_avoid_dist=8.0
        )
        self.episode_steps = 0
        self.energy_sys = EnergySystem(energy=800.0, energy_max=1000.0)
        self.drive_sys = DriveSystem()

        return self._get_obs(), {}

    def _get_obs(self) -> np.ndarray:
        internal_vec = np.array([
            self.energy_sys.energy_ratio,
            self.drive_sys.drives["hunger"],
            self.drive_sys.drives["thirst"],
            self.drive_sys.drives["fatigue"],
            self.drive_sys.drives["pain"],
            self.drive_sys.drives["curiosity"],
        ], dtype=np.float32)

        dists = np.linalg.norm(self.city_obstacles - self.robot_pos, axis=1)
        closest_indices = np.argsort(dists)[:6]
        self.obstacles = self.city_obstacles[closest_indices]

        return np.concatenate([
            self.robot_pos,
            self.goal_pos,
            self.food_pos,
            self.water_pos,
            self.bed_pos,
            self.obstacles.flatten(),
            internal_vec,
        ]).astype(np.float32)

    def step(self, action: np.ndarray) -> Tuple[np.ndarray, float, bool, bool, Dict[str, Any]]:
        self.episode_steps += 1
        act = np.clip(np.asarray(action, dtype=np.float32), -self.max_speed, self.max_speed)

        old_dist = float(np.linalg.norm(self.robot_pos - self.goal_pos))
        alpha_m = self.energy_sys.alpha_motor
        eff_act = act * alpha_m
        force_norm = float(np.linalg.norm(eff_act) / self.max_speed)

        self.robot_pos = self.robot_pos + eff_act * self.dt
        self.robot_pos = np.clip(self.robot_pos, 0.5, self.world_size - 0.5)

        dist_to_goal = float(np.linalg.norm(self.robot_pos - self.goal_pos))
        dist_to_food = float(np.linalg.norm(self.robot_pos - self.food_pos))
        dist_to_water = float(np.linalg.norm(self.robot_pos - self.water_pos))
        dist_to_bed = float(np.linalg.norm(self.robot_pos - self.bed_pos))

        collided = False
        hazard_prox = 0.0
        for obs, rad in zip(self.city_obstacles, self.city_obstacle_radii):
            diff = self.robot_pos - obs
            dist = float(np.linalg.norm(diff))
            thresh = self.robot_radius + rad
            if dist < thresh:
                collided = True
                if dist > 0.001:
                    normal = diff / dist
                    self.robot_pos = obs + normal * (thresh + 0.12)
                    self.robot_pos = np.clip(self.robot_pos, 1.2, self.world_size - 1.2)
            if dist < (thresh + 2.5):
                hazard_prox = max(hazard_prox, (thresh + 2.5 - dist) / 2.5)

        # Wall collisions
        wall_thresh = 0.9
        if self.robot_pos[0] < wall_thresh:
            collided = True
            self.robot_pos[0] = 1.25
        elif self.robot_pos[0] > (self.world_size - wall_thresh):
            collided = True
            self.robot_pos[0] = self.world_size - 1.25

        if self.robot_pos[1] < wall_thresh:
            collided = True
            self.robot_pos[1] = 1.25
        elif self.robot_pos[1] > (self.world_size - wall_thresh):
            collided = True
            self.robot_pos[1] = self.world_size - 1.25

        ate_food = dist_to_food < self.zone_radius
        drank_water = dist_to_water < self.zone_radius
        is_resting = dist_to_bed < self.zone_radius and force_norm < 0.25

        if ate_food:
            self.energy_sys.eat(kcal=35.0)
        self.energy_sys.step(dt=self.dt, motor_force_norm=force_norm, cognitive_load=0.15,
                             stress_level=self.drive_sys.drives["fear"], is_resting=is_resting)

        events = {
            "collided": collided,
            "hazard_proximity": hazard_prox,
            "ate_food": ate_food,
            "drank_water": drank_water,
            "is_resting": is_resting,
        }
        self.drive_sys.step(dt=self.dt, energy_sys=self.energy_sys, events=events)

        # Reward shaping (Progress + Survival + Goal Navigation)
        progress = old_dist - dist_to_goal
        reward = (progress * 18.0) - 0.08 - (dist_to_goal / self.world_size) * 0.10 - 0.02 * force_norm

        terminated = False
        if ate_food and self.drive_sys.drives["hunger"] > 0.25:
            reward += 6.0
        if drank_water and self.drive_sys.drives["thirst"] > 0.25:
            reward += 5.0
        if is_resting and self.drive_sys.drives["fatigue"] > 0.4:
            reward += 3.5

        if collided:
            reward -= 50.0
            if self.is_gym_training:
                terminated = True
        elif dist_to_goal < self.goal_radius:
            reward += 150.0
            terminated = True

        truncated = self.episode_steps >= self.max_episode_steps

        info = {
            "dist_to_goal": dist_to_goal,
            "collided": collided,
            "robot": self.robot_pos.tolist(),
            "goal": self.goal_pos.tolist(),
            "obstacles": self.obstacles.tolist(),
        }

        return self._get_obs(), float(reward), terminated, truncated, info


# ==============================================================================
# 4. HUẤN LUYỆN PPO VỚI STABLE-BASELINES3
# ==============================================================================

def train_city_ppo(total_timesteps: int = 150_000, n_envs: int = 8, model_name: str = "obstacle_ppo_latest", progress_bar: bool = False):
    from stable_baselines3 import PPO
    from stable_baselines3.common.env_util import make_vec_env

    print(f"[INFO] Khoi tao moi truong Thanh Pho 60x60 voi {n_envs} moi truong song song...")
    vec_env = make_vec_env(ChildWorldEnv, n_envs=n_envs)

    print(f"[INFO] Khoi tao mang no-ron PPO (MlpPolicy: [64, 64])...")
    model = PPO(
        "MlpPolicy",
        vec_env,
        learning_rate=3e-4,
        n_steps=1024,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,
        ent_coef=0.005,
        verbose=1,
        device="auto",
    )

    print(f"[INFO] Bat dau huan luyen PPO ({total_timesteps:,} steps)...")
    try:
        model.learn(total_timesteps=total_timesteps, progress_bar=progress_bar)
    except Exception:
        # Fallback neu thieu rich/tqdm tren moi truong toi gian
        model.learn(total_timesteps=total_timesteps, progress_bar=False)

    save_path = f"{model_name}.zip"
    model.save(model_name)
    print(f"[THANH CONG] Da luu mo hinh thanh cong: {save_path}")

    return model, save_path


if __name__ == "__main__":
    trained_model, output_file = train_city_ppo(total_timesteps=150_000, n_envs=4)
    print(f"[HOAN TAT] File model da duoc tao: {output_file}")
