"""
Module Base Trainer (Lop co so Huan Luyen Vien).
Dinh nghia giao dien chung cho cac trainer trong he thong:
- PPOTrainer: Huan luyen tang cuong tuong tac qua Stable-Baselines3.
- BCTrainer: Huan luyen bat chuoc tu du lieu thi pham (Behavioral Cloning).
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import numpy as np


class BaseTrainer(ABC):
    """
    Lop truu tuong BaseTrainer dinh nghia cac phuong thuc chuan:
    - train(): Huan luyen mo hinh.
    - load_model(): Nap mo hinh tu file checkpoint.
    - predict(): Du doan hanh dong tu quan sat.
    """

    @abstractmethod
    def train(self, *args, **kwargs) -> Dict[str, Any]:
        """Thuc thi tien trinh huan luyen."""
        pass

    @abstractmethod
    def load_model(self, *args, **kwargs) -> bool:
        """Nap mo hinh checkpoint."""
        pass

    @abstractmethod
    def predict(self, obs: np.ndarray) -> np.ndarray:
        """Du doan hanh dong tu vector quan sat obs."""
        pass

