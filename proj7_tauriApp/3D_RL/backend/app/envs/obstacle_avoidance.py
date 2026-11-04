import gymnasium as gym
from gymnasium import spaces
import numpy as np

class ObstacleAvoidanceEnv(gym.Env):
    """
    Simple continuous 2D obstacle avoidance environment.
    Designed to be easily replaceable / extended later.
    """
    metadata = {"render_modes": ["human"]}

    def __init__(self):
        super().__init__()
        self.world_size = 10.0
        self.robot_radius = 0.3
        self.goal_radius = 0.5
        self.max_speed = 1.2
        self.dt = 0.1
        self.num_obstacles = 4

        self.action_space = spaces.Box(
            low=-self.max_speed,
            high=self.max_speed,
            shape=(2,),
            dtype=np.float32
        )

        obs_dim = 4 + self.num_obstacles * 2
        self.observation_space = spaces.Box(
            low=-np.inf,
            high=np.inf,
            shape=(obs_dim,),
            dtype=np.float32
        )

        self.obstacles = np.array([
            [3.0, 3.5],
            [6.5, 2.5],
            [4.0, 7.0],
            [7.5, 6.5]
        ], dtype=np.float32)
        self.obstacle_radius = 0.7

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self.robot_pos = np.array([1.2, 1.2], dtype=np.float32)
        self.goal_pos = np.array([8.8, 8.8], dtype=np.float32)
        return self._get_obs(), {}

    def _get_obs(self):
        return np.concatenate([
            self.robot_pos,
            self.goal_pos,
            self.obstacles.flatten()
        ]).astype(np.float32)

    def step(self, action):
        action = np.clip(action, -self.max_speed, self.max_speed)
        self.robot_pos = self.robot_pos + action * self.dt
        self.robot_pos = np.clip(self.robot_pos, 0.3, self.world_size - 0.3)

        dist_to_goal = np.linalg.norm(self.robot_pos - self.goal_pos)
        collided = any(
            np.linalg.norm(self.robot_pos - obs) < (self.robot_radius + self.obstacle_radius)
            for obs in self.obstacles
        )

        reward = 0.0
        terminated = False

        if collided:
            reward = -40.0
            terminated = True
        elif dist_to_goal < self.goal_radius:
            reward = 100.0
            terminated = True
        else:
            reward = -0.15 - dist_to_goal * 0.08

        info = {
            "dist_to_goal": float(dist_to_goal),
            "collided": collided,
            "robot": self.robot_pos.tolist(),
            "goal": self.goal_pos.tolist(),
            "obstacles": self.obstacles.tolist()
        }

        return self._get_obs(), reward, terminated, False, info