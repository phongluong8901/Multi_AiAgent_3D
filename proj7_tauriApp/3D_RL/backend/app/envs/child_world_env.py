import gymnasium as gym
from gymnasium import spaces
import numpy as np
from typing import Dict, Any, Optional, Tuple
from ..internal.energy import EnergySystem
from ..internal.drives import DriveSystem


class ChildWorldEnv(gym.Env):
    """
    AI Child Simulation 2D/3D World Environment (Bản đồ mở rộng 20x20).
    Mô phỏng không gian sống phong phú: Phòng ngủ, Bếp ăn, Vòi nước, Khu chơi, Chướng ngại vật.
    Tích hợp hệ thống Năng lượng Kcal sinh học và 7 nhu cầu nội tại (Drives).
    """

    metadata = {"render_modes": ["human"]}

    def __init__(self, persist_internal: bool = False):
        super().__init__()
        self.world_size: float = 20.0
        self.robot_radius: float = 0.35
        self.goal_radius: float = 0.85
        self.zone_radius: float = 1.15
        self.obstacle_radius: float = 0.85
        self.max_speed: float = 1.4
        self.dt: float = 0.1
        self.persist_internal: bool = persist_internal

        # Các khu vực chính trong thế giới 20x20
        self.bed_pos = np.array([2.5, 2.5], dtype=np.float32)       # Giường ngủ & Nghỉ ngơi
        self.food_pos = np.array([3.0, 17.0], dtype=np.float32)     # Bếp & Thức ăn
        self.water_pos = np.array([17.0, 3.0], dtype=np.float32)    # Vòi nước uống
        self.goal_pos = np.array([17.0, 17.0], dtype=np.float32)    # Điểm mục tiêu khám phá
        self.robot_pos = np.array([2.5, 2.5], dtype=np.float32)     # Vị trí xuất phát

        # 6 Chướng ngại vật / Khu vực nguy hiểm trong không gian
        self.obstacles = np.array(
            [
                [6.5, 6.5],    # Lò lửa sưởi ấm (nguy hiểm nếu chạm)
                [13.5, 6.5],   # Khu vực cọc cản / góc nhọn
                [6.5, 13.5],   # Thùng gỗ cồng kềnh
                [13.5, 13.5],  # Bàn ghế cao dễ va đụng
                [10.0, 4.5],   # Tủ đồ lớn chắn lối
                [10.0, 15.5],  # Vách ngăn hành lang
            ],
            dtype=np.float32,
        )
        self.num_obstacles = len(self.obstacles)

        # Điều khiển vận tốc liên tục [vx, vz]
        self.action_space = spaces.Box(
            low=-self.max_speed,
            high=self.max_speed,
            shape=(2,),
            dtype=np.float32,
        )

        # Vector quan sát: robot(2) + goal(2) + food(2) + water(2) + bed(2) + obstacles(12) + internal(6) = 28
        obs_dim = 2 + 2 + 2 + 2 + 2 + (self.num_obstacles * 2) + 6
        self.observation_space = spaces.Box(
            low=-np.inf,
            high=np.inf,
            shape=(obs_dim,),
            dtype=np.float32,
        )

        # Hệ thống nội tại
        self.energy_sys = EnergySystem(energy=800.0, energy_max=1000.0)
        self.drive_sys = DriveSystem()
        self.episode_steps: int = 0
        self.max_episode_steps: int = 1000

    def reset(
        self,
        seed: Optional[int] = None,
        options: Optional[Dict[str, Any]] = None,
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        super().reset(seed=seed)
        self.robot_pos = np.array([2.5, 2.5], dtype=np.float32)
        self.goal_pos = np.array([17.0, 17.0], dtype=np.float32)
        self.episode_steps = 0

        if not self.persist_internal:
            self.energy_sys = EnergySystem(energy=800.0, energy_max=1000.0)
            self.drive_sys = DriveSystem()

        return self._get_obs(), self.get_info()

    def _get_obs(self) -> np.ndarray:
        internal_vec = np.array(
            [
                self.energy_sys.energy_ratio,
                self.drive_sys.drives["hunger"],
                self.drive_sys.drives["thirst"],
                self.drive_sys.drives["fatigue"],
                self.drive_sys.drives["pain"],
                self.drive_sys.drives["curiosity"],
            ],
            dtype=np.float32,
        )
        return np.concatenate(
            [
                self.robot_pos,
                self.goal_pos,
                self.food_pos,
                self.water_pos,
                self.bed_pos,
                self.obstacles.flatten(),
                internal_vec,
            ]
        ).astype(np.float32)

    def step(
        self, action: np.ndarray
    ) -> Tuple[np.ndarray, float, bool, bool, Dict[str, Any]]:
        self.episode_steps += 1
        raw_action = np.clip(np.asarray(action, dtype=np.float32), -self.max_speed, self.max_speed)

        # Năng lượng & Mệt mỏi chi phối thể lực di chuyển thực tế (alpha_motor)
        alpha_m = self.energy_sys.alpha_motor
        effective_action = raw_action * alpha_m
        motor_force_norm = float(np.linalg.norm(effective_action) / self.max_speed)

        self.robot_pos = self.robot_pos + effective_action * self.dt
        self.robot_pos = np.clip(self.robot_pos, 0.5, self.world_size - 0.5)

        # Tính khoảng cách tới các khu vực
        dist_to_goal = float(np.linalg.norm(self.robot_pos - self.goal_pos))
        dist_to_food = float(np.linalg.norm(self.robot_pos - self.food_pos))
        dist_to_water = float(np.linalg.norm(self.robot_pos - self.water_pos))
        dist_to_bed = float(np.linalg.norm(self.robot_pos - self.bed_pos))

        obs_dists = [float(np.linalg.norm(self.robot_pos - obs)) for obs in self.obstacles]
        min_obs_dist = min(obs_dists) if obs_dists else 99.0
        collision_threshold = self.robot_radius + self.obstacle_radius
        collided = min_obs_dist < collision_threshold

        hazard_proximity = max(0.0, (2.0 - min_obs_dist) / 2.0) if min_obs_dist < 2.0 else 0.0

        # Kiểm tra tương tác với các khu vực
        ate_food = False
        if dist_to_food < self.zone_radius and (
            self.drive_sys.drives["hunger"] > 0.1 or self.energy_sys.energy_ratio < 0.95
        ):
            self.energy_sys.eat(kcal=25.0)
            ate_food = True

        drank_water = False
        if dist_to_water < self.zone_radius and self.drive_sys.drives["thirst"] > 0.05:
            drank_water = True

        is_resting = dist_to_bed < (self.zone_radius + 0.15) and motor_force_norm < 0.25

        # Cập nhật Năng lượng Kcal & Drives
        self.energy_sys.step(
            dt=self.dt,
            motor_force_norm=motor_force_norm,
            cognitive_load=0.15,
            stress_level=self.drive_sys.drives["fear"],
            is_resting=is_resting,
        )
        events = {
            "collided": collided,
            "hazard_proximity": hazard_proximity,
            "ate_food": ate_food,
            "drank_water": drank_water,
            "is_resting": is_resting,
        }
        self.drive_sys.step(dt=self.dt, energy_sys=self.energy_sys, events=events)

        # Hàm thưởng định hướng hành vi
        reward = -0.05 - (dist_to_goal / self.world_size) * 0.1 - 0.02 * motor_force_norm
        terminated = False

        if ate_food and self.drive_sys.drives["hunger"] > 0.25:
            reward += 4.5
        if drank_water and self.drive_sys.drives["thirst"] > 0.25:
            reward += 3.5
        if is_resting and self.drive_sys.drives["fatigue"] > 0.4:
            reward += 2.0

        if collided:
            reward -= 45.0
            terminated = True
        elif dist_to_goal < self.goal_radius:
            reward += 100.0
            terminated = True

        truncated = self.episode_steps >= self.max_episode_steps
        info = self.get_info(
            dist_to_goal=dist_to_goal,
            collided=collided,
            ate_food=ate_food,
            drank_water=drank_water,
            is_resting=is_resting,
        )

        return self._get_obs(), float(reward), terminated, truncated, info

    def get_info(
        self,
        dist_to_goal: Optional[float] = None,
        collided: bool = False,
        ate_food: bool = False,
        drank_water: bool = False,
        is_resting: bool = False,
    ) -> Dict[str, Any]:
        if dist_to_goal is None:
            dist_to_goal = float(np.linalg.norm(self.robot_pos - self.goal_pos))
        return {
            "dist_to_goal": float(dist_to_goal),
            "collided": bool(collided),
            "ate_food": bool(ate_food),
            "drank_water": bool(drank_water),
            "is_resting": bool(is_resting),
            "robot": self.robot_pos.tolist(),
            "goal": self.goal_pos.tolist(),
            "food": self.food_pos.tolist(),
            "water": self.water_pos.tolist(),
            "bed": self.bed_pos.tolist(),
            "obstacles": self.obstacles.tolist(),
            "world_size": self.world_size,
            "energy_state": self.energy_sys.to_dict(),
            "drives_state": self.drive_sys.to_dict(),
        }

    def export_state(self) -> Dict[str, Any]:
        return {
            "robot": self.robot_pos.tolist(),
            "goal": self.goal_pos.tolist(),
            "food": self.food_pos.tolist(),
            "water": self.water_pos.tolist(),
            "bed": self.bed_pos.tolist(),
            "obstacles": self.obstacles.tolist(),
            "world_size": self.world_size,
            "energy_state": self.energy_sys.to_dict(),
            "drives_state": self.drive_sys.to_dict(),
        }

    def import_state(self, state: Dict[str, Any]) -> None:
        if not state:
            return
        if "robot" in state and len(state["robot"]) == 2:
            self.robot_pos = np.array(state["robot"], dtype=np.float32)
        if "goal" in state and len(state["goal"]) == 2:
            self.goal_pos = np.array(state["goal"], dtype=np.float32)
        if "energy_state" in state:
            self.energy_sys.load_dict(state["energy_state"])
        if "drives_state" in state:
            self.drive_sys.load_dict(state["drives_state"])
