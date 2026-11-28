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
    """
    Kiểm tra trạng thái sẵn sàng của dịch vụ huấn luyện Reinforcement Learning,
    trả về thuật toán đang chọn và trạng thái tiến trình huấn luyện nền.
    """
    return {
        "status": "healthy",
        "service": "rltrain-service",
        "algorithm": trainer.algorithm,
        "algorithm_name": trainer.get_algorithm_name(),
        "is_training": trainer.is_training
    }


@router.post("/algorithm")
def set_algorithm(req: SetAlgorithmRequest):
    """
    Chuyển đổi thuật toán huấn luyện học tăng cường:
    - PPO (Proximal Policy Optimization)
    - SAC / SAC v2 (Soft Actor-Critic)
    - Dreamer (World Models)
    - MuZero (Model-based MCTS Lookahead)
    - DQN (Double Deep Q-Network)
    - Q-Learning (Tabular Q-learning with Eligibility Traces)
    """
    return trainer.set_algorithm(req.algorithm)


@router.post("/train/start")
def start_training(req: StartTrainRequest):
    """
    Khởi động luồng huấn luyện di chuyển tự hành 3D trong không gian Three.js
    cho một Agent cụ thể với các tham số siêu dữ liệu (learning_rate, episodes, speed).
    """
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
    """
    Tạm dừng hoặc tiếp tục phiên huấn luyện đang chạy nền.
    """
    return trainer.pause_training()


@router.post("/train/reset")
def reset_training():
    """
    Đặt lại toàn bộ trạng thái môi trường và xóa lịch sử chỉ số huấn luyện.
    """
    return trainer.reset_training()


@router.get("/train/status")
def get_training_status():
    """
    Lấy thông tin tiến độ huấn luyện thời gian thực (episode hiện tại, tổng reward, tỷ lệ thành công, va chạm và quỹ đạo di chuyển).
    """
    return trainer.get_status()


@router.post("/env/step")
def env_step(req: StepRequest):
    """
    Thực thi một bước hành động đơn lẻ (manual step) trong môi trường 3D.
    """
    return trainer.step_manual(req.action)


@router.post("/policy/save")
def save_policy(req: SavePolicyRequest):
    """
    Lưu trữ trọng số mạng nơ-ron hoặc bảng chính sách (Policy/Q-table) của Agent vào đĩa.
    """
    return trainer.save_policy(req.agent_id, req.filename)


@router.post("/policy/load")
def load_policy(req: LoadPolicyRequest):
    """
    Tải chính sách (Policy) đã huấn luyện trước đó vào bộ nhớ của Agent.
    """
    return trainer.load_policy(req.agent_id, req.filename)


@router.get("/policies")
def list_policies():
    """
    Liệt kê tất cả các tệp chính sách đã lưu trữ trong thư mục `saved_policies`.
    """
    return {"policies": trainer.list_saved_policies()}


@router.post("/env/map")
def set_map(req: SetMapRequest):
    """
    Cập nhật bản đồ và cấu hình chướng ngại vật 3D mới cho môi trường huấn luyện.
    """
    obs_list = [o.dict() for o in req.obstacles] if req.obstacles else []
    return trainer.set_map(req.map_name, obs_list)
