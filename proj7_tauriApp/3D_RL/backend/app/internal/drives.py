from typing import Dict, Any, Optional
import numpy as np
from .energy import EnergySystem


class DriveSystem:
    """
    Internal Drive & Homeostasis System.
    Each drive is a continuous variable in [0.0, 1.0].
    Computes non-linear Urgency and selects the dominant drive.
    """

    DRIVE_NAMES = (
        "hunger",
        "thirst",
        "fatigue",
        "pain",
        "fear",
        "curiosity",
        "comfort",
    )

    def __init__(self):
        self.drives: Dict[str, float] = {
            "hunger": 0.20,
            "thirst": 0.15,
            "fatigue": 0.10,
            "pain": 0.00,
            "fear": 0.00,
            "curiosity": 0.55,
            "comfort": 0.85,
        }

        # Non-linear urgency weights & exponents: Urgency_i = w_i * (drive_i ^ gamma_i)
        self.weights: Dict[str, float] = {
            "pain": 2.4,
            "fear": 2.0,
            "thirst": 1.5,
            "hunger": 1.4,
            "fatigue": 1.3,
            "curiosity": 0.9,
        }
        self.exponents: Dict[str, float] = {
            "pain": 1.5,
            "fear": 1.6,
            "thirst": 2.0,
            "hunger": 2.0,
            "fatigue": 2.1,
            "curiosity": 1.2,
        }

    def step(
        self,
        dt: float,
        energy_sys: EnergySystem,
        events: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Update all drives over dt seconds based on biological energy and environment events.
        """
        events = events or {}

        # 1. Hunger coupled with energy depletion and natural time drift
        hunger_drift = 0.0035 * dt
        if energy_sys.energy_ratio < 0.4:
            hunger_drift += 0.008 * (0.4 - energy_sys.energy_ratio) * dt
        self.drives["hunger"] = float(np.clip(self.drives["hunger"] + hunger_drift, 0.0, 1.0))

        # 2. Thirst increases steadily over time
        thirst_drift = 0.0045 * dt
        self.drives["thirst"] = float(np.clip(self.drives["thirst"] + thirst_drift, 0.0, 1.0))

        # 3. Fatigue synced with EnergySystem
        self.drives["fatigue"] = float(np.clip(energy_sys.fatigue, 0.0, 1.0))

        # 4. Pain & Fear from collision / hazard events, with natural decay
        if events.get("collided", False):
            self.drives["pain"] = float(np.clip(self.drives["pain"] + 0.45, 0.0, 1.0))
            self.drives["fear"] = float(np.clip(self.drives["fear"] + 0.30, 0.0, 1.0))
        else:
            self.drives["pain"] = float(np.clip(self.drives["pain"] - 0.04 * dt, 0.0, 1.0))

        near_hazard = float(events.get("hazard_proximity", 0.0))
        if near_hazard > 0.0:
            self.drives["fear"] = float(np.clip(self.drives["fear"] + 0.12 * near_hazard * dt, 0.0, 1.0))
        else:
            self.drives["fear"] = float(np.clip(self.drives["fear"] - 0.03 * dt, 0.0, 1.0))

        # 5. Event Consumptions (eating, drinking, resting)
        if events.get("ate_food", False):
            self.drives["hunger"] = float(np.clip(self.drives["hunger"] - 0.45, 0.0, 1.0))

        if events.get("drank_water", False):
            self.drives["thirst"] = float(np.clip(self.drives["thirst"] - 0.55, 0.0, 1.0))

        if events.get("is_resting", False):
            self.drives["pain"] = float(np.clip(self.drives["pain"] - 0.08 * dt, 0.0, 1.0))
            self.drives["fear"] = float(np.clip(self.drives["fear"] - 0.08 * dt, 0.0, 1.0))

        # 6. Comfort (inverse of pain, fear, and extreme hunger/fatigue)
        discomfort = max(
            self.drives["pain"],
            self.drives["fear"] * 0.8,
            max(0.0, self.drives["hunger"] - 0.5),
            max(0.0, self.drives["fatigue"] - 0.5),
        )
        self.drives["comfort"] = float(np.clip(1.0 - discomfort, 0.0, 1.0))

        # 7. Curiosity: flourishes when energy is ample and survival drives are calm
        survival_pressure = max(
            self.drives["pain"],
            self.drives["fear"],
            self.drives["hunger"],
            self.drives["thirst"],
            self.drives["fatigue"],
        )
        if survival_pressure < 0.45 and energy_sys.energy_ratio > 0.5:
            target_curiosity = min(1.0, 0.65 + 0.35 * energy_sys.energy_ratio)
        else:
            target_curiosity = max(0.05, 0.6 * (1.0 - survival_pressure))
        self.drives["curiosity"] = float(
            np.clip(self.drives["curiosity"] + 0.15 * (target_curiosity - self.drives["curiosity"]) * dt, 0.0, 1.0)
        )

        return self.to_dict()

    def get_urgencies(self) -> Dict[str, float]:
        urgencies: Dict[str, float] = {}
        for k, w in self.weights.items():
            val = self.drives.get(k, 0.0)
            gamma = self.exponents.get(k, 1.5)
            urgencies[k] = round(float(w * (val ** gamma)), 4)
        return urgencies

    def get_dominant_drive(self) -> str:
        urgencies = self.get_urgencies()
        if not urgencies:
            return "curiosity"
        return max(urgencies, key=lambda k: urgencies[k])

    def is_survival_override(self) -> bool:
        return any(
            self.drives[k] > 0.85
            for k in ("pain", "fear", "hunger", "thirst", "fatigue")
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "drives": {k: round(v, 3) for k, v in self.drives.items()},
            "urgencies": self.get_urgencies(),
            "dominant_drive": self.get_dominant_drive(),
            "survival_override": self.is_survival_override(),
        }

    def load_dict(self, data: Dict[str, Any]) -> None:
        if not data:
            return
        raw_drives = data.get("drives", data)
        if isinstance(raw_drives, dict):
            for k in self.DRIVE_NAMES:
                if k in raw_drives:
                    self.drives[k] = float(np.clip(raw_drives[k], 0.0, 1.0))

