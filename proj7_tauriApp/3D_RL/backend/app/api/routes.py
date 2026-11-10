"""
Module Dieu Huong API & WebSocket Server (API Routes & Realtime Channels).
Cung cap toan bo cac REST API endpoints va WebSocket channel cho Frontend va Desktop:
1. PPO Training & Play:
   - POST /train/start: Bat dau huan luyen PPO offline.
   - GET /train/status: Lay tien do huan luyen PPO.
   - POST /model/load: Nap mo hinh checkpoint PPO.
   - POST /play/start & /play/stop: Bieu dien mo hinh PPO.
2. Sinh Ton Tu Hanh & Toc Do Mo Phong (Autonomous Life):
   - POST /autonomy/toggle: Bat/tat vong lap sinh ton tu hanh.
   - POST /autonomy/speed: Dieu chinh toc do thoi gian (0.0x - 5.0x).
3. Tuong Tac Nguoi Huong Dan (Teacher Console):
   - POST /teacher/feedback: Khen thuong (+) / Phat (-) cho be (Micro-RLHF).
   - POST /teacher/target: Chi dinh toa do click chuot tren san 3D.
4. Trạng Thai Sinh Hoc & Luu Tru:
   - POST /state/feed, /state/rest, /state/save, /state/load, /state/reset.
5. Huan Luyen Bat Chuoc (Behavioral Cloning):
   - POST /demos/clear, /demos/generate, /train/bc, /model/bc/load.
6. Chinh Sach Van Dong & Tri Nho:
   - POST /policy/mode: Chuyen che do ('online_rl', 'heuristic', 'bc', 'ppo').
   - POST /brain/tabula-rasa: Xoa sach ve con so 0.
   - POST /brain/dream: Kich hoat giac mong tai hien ban dem (Hippocampal Replay).
7. WebSocket (/ws):
   - Kenh truyen 2 chieu telemetries thoi gian thuc (22-25 Hz).
"""

import asyncio
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

    training_service.is_autonomous_life_active = False
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
    training_service.is_autonomous_life_active = False
    background_tasks.add_task(training_service.start_play, episodes)
    return {"status": "playing", "episodes": episodes}


@router.post("/play/stop")
async def stop_play():
    training_service.stop_play()
    return {"status": "stopped"}


@router.get("/state/snapshot")
async def get_snapshot():
    return training_service.get_current_snapshot()


@router.post("/autonomy/toggle")
async def toggle_autonomy(
    background_tasks: BackgroundTasks,
    active: bool = Query(True),
):
    """Bật / Tắt chế độ Tự Hành Sinh Tồn của bé."""
    is_active = training_service.toggle_autonomous_life(active)
    if is_active:
        background_tasks.add_task(training_service.run_autonomous_life_loop)
    snapshot = training_service.get_current_snapshot()
    await manager.broadcast(snapshot)
    return {"status": "success", "is_autonomous_life": is_active, "snapshot": snapshot}


@router.post("/autonomy/speed")
async def set_speed(speed: float = Query(1.0, ge=0.0, le=5.0)):
    """Chỉnh tốc độ mô phỏng cuộc sống (0.0: Tạm dừng, 1.0: Chuẩn, 2.0x, 5.0x)."""
    val = training_service.set_simulation_speed(speed)
    snapshot = training_service.get_current_snapshot()
    await manager.broadcast(snapshot)
    return {"status": "speed_set", "speed": val}


@router.post("/teacher/feedback")
async def give_feedback(praise: bool = Query(True), target: str = Query("both")):
    """Khen thưởng (+) hoặc Phạt răn đe (-) cho Bé Bo, Bé Bi hoặc cả hai."""
    msg = training_service.teacher_give_feedback(is_praise=praise, target=target)
    snapshot = training_service.get_current_snapshot()
    await manager.broadcast(snapshot)
    return {"status": "feedback_received", "message": msg, "snapshot": snapshot}


@router.post("/teacher/target")
async def set_target(
    x: float = Query(..., ge=0.5, le=19.5),
    z: float = Query(..., ge=0.5, le=19.5),
    label: str = Query("Điểm click chuột trên sàn 3D"),
    target: str = Query("both"),
):
    """Click chuột lên sàn 3D để chỉ định mục tiêu di chuyển cho Bé Bo, Bé Bi hoặc cả hai."""
    snapshot = training_service.teacher_set_target(x, z, label, target=target)
    await manager.broadcast(snapshot)
    return {"status": "target_set", "target": [x, z], "label": label, "snapshot": snapshot}


@router.post("/state/feed")
async def feed_agent(kcal: float = Query(250.0, ge=10.0, le=1000.0), target: str = Query("both")):
    snapshot = training_service.feed_agent(kcal=kcal, target=target)
    await manager.broadcast(snapshot)
    return {"status": "fed", "kcal": kcal, "snapshot": snapshot}


@router.post("/state/rest")
async def rest_agent(target: str = Query("both")):
    snapshot = training_service.rest_agent(target=target)
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


@router.post("/demos/generate")
async def generate_demos(count: int = Query(150, ge=10, le=1000)):
    """Tự động sinh mẫu thị phạm từ bộ điều khiển chuyên gia cho Behavioral Cloning."""
    total_count = training_service.generate_expert_demonstrations(count=count)
    snapshot = training_service.get_current_snapshot()
    await manager.broadcast(snapshot)
    return {
        "status": "generated",
        "added": count,
        "total_demos": total_count,
        "message": f"[THÀNH CÔNG] Đã sinh {count} mẫu thị phạm mẫu mực.",
    }


@router.post("/train/bc")
async def train_behavioral_cloning(
    background_tasks: BackgroundTasks,
    epochs: int = Query(35, ge=5, le=200),
):
    """Bắt đầu huấn luyện Bắt Chước (Behavioral Cloning) từ kho dữ liệu thị phạm."""
    if training_service.is_training:
        return {"status": "already_training"}

    training_service.is_autonomous_life_active = False
    background_tasks.add_task(training_service.train_behavioral_cloning, epochs)
    return {
        "status": "started",
        "epochs": epochs,
        "message": f"[BẮT ĐẦU] Đang huấn luyện Behavioral Cloning {epochs} epochs...",
    }


@router.post("/model/bc/load")
async def load_bc_model():
    """Nạp mạng nơ-ron Behavioral Cloning đã huấn luyện."""
    ok = training_service.load_bc_model()
    snapshot = training_service.get_current_snapshot()
    await manager.broadcast(snapshot)
    return {
        "status": "loaded" if ok else "error",
        "policy_mode": training_service.policy_mode,
        "snapshot": snapshot,
    }


@router.post("/policy/mode")
async def set_policy_mode(mode: str = Query("online_rl", regex="^(online_rl|heuristic|bc|ppo)$")):
    """Chuyển đổi chế độ não bộ vận động: 'online_rl' (tự học trực tuyến), 'heuristic' (tiềm năng), 'bc' (bắt chước), 'ppo' (mô hình RL)."""
    current_mode = training_service.set_policy_mode(mode)
    snapshot = training_service.get_current_snapshot()
    await manager.broadcast(snapshot)
    return {"status": "mode_set", "policy_mode": current_mode, "snapshot": snapshot}


@router.post("/brain/tabula-rasa")
async def reset_tabula_rasa():
    """Đặt lại trí nhớ bản đồ, sương mù và nơ-ron về con số 0 (Tabula Rasa)."""
    snapshot = training_service.reset_brains_to_tabula_rasa()
    await manager.broadcast(snapshot)
    return {
        "status": "reset",
        "message": "[THÀNH CÔNG] Đã xóa toàn bộ trí nhớ và trọng số nơ-ron về con số 0 ban đầu.",
        "snapshot": snapshot,
    }


@router.post("/brain/dream")
async def trigger_hippocampal_dream(target: str = Query("both")):
    """Kích hoạt cưỡng bức một chu kỳ Giấc Mộng Tái Hiện Ban Đêm (Hippocampal Sleep Dream Replay)."""
    res = training_service.trigger_dream_replay(target=target)
    await manager.broadcast(res["snapshot"])
    return {
        "status": "success",
        "message": "[THÀNH CÔNG] Đã kích hoạt giấc mộng củng cố nơ-ron (Hippocampal Dream Replay).",
        "bo_dream": res.get("bo_dream"),
        "bi_dream": res.get("bi_dream"),
        "snapshot": res["snapshot"],
    }


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Gửi ngay snapshot ban đầu khi vừa kết nối
        await websocket.send_text(json.dumps(training_service.get_current_snapshot()))

        # Nếu chế độ tự hành chưa bật, tự động kích hoạt nền để thế giới bắt đầu chuyển động
        if not training_service.is_autonomous_life_active and not training_service.is_training:
            training_service.is_autonomous_life_active = True
            asyncio.create_task(training_service.run_autonomous_life_loop())

        while True:
            raw_msg = await websocket.receive_text()
            try:
                payload = json.loads(raw_msg)
                msg_type = payload.get("type")

                if msg_type == "teacher_action":
                    # Lái trực tiếp bằng phím WASD
                    action = payload.get("action", [0.0, 0.0])
                    record = bool(payload.get("record", True))
                    snapshot = training_service.teacher_step(action=action, record=record)
                    await manager.broadcast(snapshot)

                elif msg_type == "set_target":
                    # Click chuột lên sàn 3D
                    x = float(payload.get("x", 10.0))
                    z = float(payload.get("z", 10.0))
                    label = str(payload.get("label", "Điểm click chuột trên sàn"))
                    target = str(payload.get("target", "both"))
                    snapshot = training_service.teacher_set_target(x, z, label, target=target)
                    await manager.broadcast(snapshot)

                elif msg_type == "teacher_feedback":
                    # Khen thưởng / Phạt
                    is_praise = bool(payload.get("praise", True))
                    target = str(payload.get("target", "both"))
                    msg = training_service.teacher_give_feedback(is_praise, target=target)
                    snapshot = training_service.get_current_snapshot()
                    await manager.broadcast(snapshot)

                elif msg_type == "toggle_autonomy":
                    active = payload.get("active")
                    is_act = training_service.toggle_autonomous_life(active)
                    if is_act:
                        asyncio.create_task(training_service.run_autonomous_life_loop())
                    snapshot = training_service.get_current_snapshot()
                    await manager.broadcast(snapshot)

                elif msg_type == "set_speed":
                    speed = float(payload.get("speed", 1.0))
                    training_service.set_simulation_speed(speed)
                    snapshot = training_service.get_current_snapshot()
                    await manager.broadcast(snapshot)

            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
