from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class ObstacleModel(BaseModel):
    x: float
    z: float
    radius: float = 1.0

class StartTrainRequest(BaseModel):
    agent_id: str = "agent_default"
    episodes: int = Field(default=300, ge=10, le=5000)
    learning_rate: float = Field(default=0.003, ge=0.0001, le=1.0)
    discount_factor: float = Field(default=0.98, ge=0.5, le=0.999)
    epsilon_decay: float = Field(default=0.992, ge=0.9, le=0.9999)
    epsilon_min: float = Field(default=0.04, ge=0.01, le=0.5)
    speed: float = Field(default=0.0, ge=0.0, le=0.1, description="Delay per step in seconds for live observation")
    map_name: str = Field(default="office", description="Tên map: 'office' (Văn phòng thật) hoặc 'grid' (Sa bàn cơ bản)")
    algorithm: str = Field(default="ppo", description="Thuật toán RL: 'ppo', 'sac', 'sac2', 'dreamer', 'muzero', 'dqn', 'q_learning'")
    obstacles: Optional[List[ObstacleModel]] = None

class StepRequest(BaseModel):
    action: Optional[int] = Field(default=None, description="Action index 0..5, or None to use policy inference")

class SavePolicyRequest(BaseModel):
    policy_name: str = Field(..., min_length=2)
    agent_id: Optional[str] = None

class LoadPolicyRequest(BaseModel):
    policy_name: str

class SetMapRequest(BaseModel):
    map_name: str = Field(default="office", description="Tên map: 'office', 'grid' hoặc Studio Map ID")
    obstacles: Optional[List[ObstacleModel]] = None
    arena_size: Optional[float] = None

class SetAlgorithmRequest(BaseModel):
    algorithm: str = Field(default="ppo", description="Thuật toán: 'ppo', 'sac', 'sac2', 'dreamer', 'muzero', 'dqn', 'q_learning'")
