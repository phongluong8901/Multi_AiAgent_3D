import json
from fastapi import APIRouter, BackgroundTasks, WebSocket, WebSocketDisconnect, Query
from ..services.training_service import training_service
from ..core.websocket_manager import manager

router = APIRouter()


@router.post("/train/start")
async def start_training(
    background_tasks: BackgroundTasks,
    timesteps: int = Query(80000, ge=1000, le=2_000_000),
    n_envs: int = Query(1, ge=1, le=8),
):
    if training_service.is_training:
        return {"status": "already_training"}

    background_tasks.add_task(training_service.start_training, timesteps, n_envs)
    return {
        "status": "started",
        "timesteps": timesteps,
        "n_envs": n_envs,
    }


@router.get("/train/status")
async def train_status():
    return {
        "is_training": training_service.is_training,
        "is_playing": training_service.is_playing,
        "snapshot": training_service.get_current_snapshot(),
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
    episodes: int = Query(3, ge=1, le=20),
):
    if training_service.trainer.model is None:
        return {"status": "no_model"}
    background_tasks.add_task(training_service.start_play, episodes)
    return {"status": "playing", "episodes": episodes}


@router.post("/play/stop")
async def stop_play():
    training_service.stop_play()
    return {"status": "stopped"}


@router.get("/state/snapshot")
async def get_snapshot():
    return training_service.get_current_snapshot()


@router.post("/state/feed")
async def feed_agent(kcal: float = Query(250.0, ge=10.0, le=1000.0)):
    snapshot = training_service.feed_agent(kcal=kcal)
    await manager.broadcast(snapshot)
    return {"status": "fed", "kcal": kcal, "snapshot": snapshot}


@router.post("/state/rest")
async def rest_agent():
    snapshot = training_service.rest_agent()
    await manager.broadcast(snapshot)
    return {"status": "rested", "snapshot": snapshot}


@router.post("/state/save")
async def save_state():
    res = training_service.save_state()
    await manager.broadcast(res["state"])
    return res


@router.post("/state/load")
async def load_state():
    res = training_service.load_state()
    await manager.broadcast(res["state"])
    return res


@router.post("/state/reset")
async def reset_state(full_reset: bool = Query(True)):
    snapshot = training_service.reset_world(full_reset=full_reset)
    await manager.broadcast(snapshot)
    return {"status": "reset", "snapshot": snapshot}


@router.post("/demos/clear")
async def clear_demos():
    count = training_service.clear_demos()
    snapshot = training_service.get_current_snapshot()
    await manager.broadcast(snapshot)
    return {"status": "cleared", "demo_count": count}


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Immediately send initial world & internal state snapshot on connect
        await websocket.send_text(json.dumps(training_service.get_current_snapshot()))
        while True:
            raw_msg = await websocket.receive_text()
            try:
                payload = json.loads(raw_msg)
                msg_type = payload.get("type")
                if msg_type == "teacher_action":
                    action = payload.get("action", [0.0, 0.0])
                    record = bool(payload.get("record", True))
                    snapshot = training_service.teacher_step(action=action, record=record)
                    await manager.broadcast(snapshot)
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
