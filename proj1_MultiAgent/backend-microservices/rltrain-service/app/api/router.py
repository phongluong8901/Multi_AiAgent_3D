from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
from app.core.trainer import trainer
from app.api.schemas import (
    StartTrainRequest,
    StepRequest,
    SavePolicyRequest,
    LoadPolicyRequest,
    SetMapRequest,
    SetAlgorithmRequest
)

router = APIRouter(prefix="/api/v1/rl", tags=["Reinforcement Learning Training"])

@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "rltrain-service",
        "algorithm": trainer.algorithm,
        "algorithm_name": trainer.get_algorithm_name(),
        "is_training": trainer.is_training
    }

@router.post("/algorithm")
def set_algorithm(req: SetAlgorithmRequest):
    return trainer.set_algorithm(req.algorithm)

@router.post("/train/start")
def start_training(req: StartTrainRequest):
    obs_list = [o.dict() for o in req.obstacles] if req.obstacles else None
    result = trainer.start_training(
        agent_id=req.agent_id,
        episodes=req.episodes,
        learning_rate=req.learning_rate,
        discount_factor=req.discount_factor,
        epsilon_decay=req.epsilon_decay,
        epsilon_min=req.epsilon_min,
        obstacles=obs_list,
        speed=req.speed,
        map_name=req.map_name,
        algorithm=req.algorithm
    )
    return result

@router.post("/train/pause")
def pause_training():
    return trainer.pause_training()

@router.post("/train/reset")
def reset_training():
    return trainer.reset_training()

@router.get("/train/status")
def get_training_status():
    return trainer.get_status()

@router.post("/env/step")
def env_step(req: StepRequest):
    return trainer.step_manual(req.action)

@router.post("/env/reset")
def env_reset():
    obs = trainer.env.reset()
    trainer.live_state = obs
    return {"success": True, "observation": obs}

@router.post("/env/map")
def set_env_map(req: SetMapRequest):
    return trainer.set_map(req.map_name)

@router.get("/policies")
def list_policies():
    return trainer.list_saved_policies()

@router.post("/policies/save")
def save_policy(req: SavePolicyRequest):
    return trainer.save_policy(req.policy_name)

@router.post("/policies/load")
def load_policy(req: LoadPolicyRequest):
    res = trainer.load_policy(req.policy_name)
    if not res.get("success"):
        raise HTTPException(status_code=404, detail=res.get("message"))
    return res
