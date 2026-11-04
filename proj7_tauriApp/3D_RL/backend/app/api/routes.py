from fastapi import APIRouter, BackgroundTasks, WebSocket, WebSocketDisconnect, Query
from ..services.training_service import training_service
from ..core.websocket_manager import manager

router = APIRouter()

@router.post("/train/start")
async def start_training(
    background_tasks: BackgroundTasks,
    timesteps: int = Query(80000, ge=1000, le=2_000_000),
    n_envs: int = Query(1, ge=1, le=8)
):
    if training_service.is_training:
        return {"status": "already_training"}
    
    background_tasks.add_task(training_service.start_training, timesteps, n_envs)
    return {
        "status": "started",
        "timesteps": timesteps,
        "n_envs": n_envs
    }

@router.get("/train/status")
async def train_status():
    return {
        "is_training": training_service.is_training,
        "is_playing": training_service.is_playing
    }

@router.post("/model/load")
async def load_model(model_name: str = "obstacle_ppo_latest"):
    try:
        training_service.load_model(model_name)
        return {"status": "loaded", "model": model_name}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

@router.post("/play/start")
async def start_play(
    background_tasks: BackgroundTasks,
    episodes: int = Query(3, ge=1, le=20)
):
    if training_service.trainer.model is None:
        return {"status": "no_model"}
    background_tasks.add_task(training_service.start_play, episodes)
    return {"status": "playing", "episodes": episodes}

@router.post("/play/stop")
async def stop_play():
    training_service.stop_play()
    return {"status": "stopped"}

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
