"""
Module Dependency Injection cho FastAPI (API Dependencies).
Cung cap cac ham dependency phuc vu xac thuc hoac lay the hien dich vu can thiet cho cac router.
"""

from ..services.training_service import training_service, TrainingService
from ..core.websocket_manager import manager, ConnectionManager


def get_training_service() -> TrainingService:
    """Dependency cung cap the hien TrainingService duy nhat."""
    return training_service


def get_ws_manager() -> ConnectionManager:
    """Dependency cung cap the hien ConnectionManager WebSocket."""
    return manager

