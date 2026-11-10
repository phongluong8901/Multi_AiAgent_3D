"""
Module Moi Truong Co Ban (Base Environment).
Cung cap lop co so dinh nghia giao dien chuan cho cac moi truong mo phong the gioi tre em.
"""

import gymnasium as gym
from typing import Dict, Any, Tuple
import numpy as np


class BaseChildEnv(gym.Env):
    """
    Lop truu tuong co so cho tat ca cac moi truong mo phong tre em trong he thong.
    Ke thua tu gymnasium.Env, dinh nghia khung ham chuan:
    - reset(): Khoi tao lai moi truong.
    - step(action): Thuc hien buoc di chuyen 1 tac tu.
    - get_info(): Trich xuat telemetry day du.
    - export_state(): Xuat trang thai ra dictionary luu tru.
    - import_state(): Nap trang thai tu dictionary.
    """

    metadata = {"render_modes": ["human"]}

    def reset(self, *, seed=None, options=None) -> Tuple[np.ndarray, Dict[str, Any]]:
        raise NotImplementedError

    def step(self, action: np.ndarray) -> Tuple[np.ndarray, float, bool, bool, Dict[str, Any]]:
        raise NotImplementedError

    def get_info(self) -> Dict[str, Any]:
        raise NotImplementedError

    def export_state(self) -> Dict[str, Any]:
        raise NotImplementedError

    def import_state(self, state: Dict[str, Any]) -> None:
        raise NotImplementedError

