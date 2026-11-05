from typing import Dict, Any
import numpy as np


class EnergySystem:
    """
    Biological Energy (Kcal) & Fatigue System.
    Bridges physical body execution and cognitive planning depth.
    """

    def __init__(
        self,
        energy: float = 800.0,
        energy_max: float = 1000.0,
        basal_rate: float = 1.2,
    ):
        self.energy_max: float = float(energy_max)
        self.energy: float = float(np.clip(energy, 0.0, self.energy_max))
        self.digesting: float = 0.0
        self.fatigue: float = 0.0  # [0.0, 1.0]
        self.basal_rate: float = float(basal_rate)

        # Coefficients
        self.motor_cost_coeff: float = 3.5
        self.cognitive_cost_coeff: float = 1.0
        self.stress_cost_coeff: float = 1.5
        self.digestion_rate: float = 18.0  # Kcal absorbed per second

    @property
    def energy_ratio(self) -> float:
        return float(np.clip(self.energy / max(self.energy_max, 1.0), 0.0, 1.0))

    @property
    def alpha_motor(self) -> float:
        """
        Physical performance multiplier in [0.2, 1.0].
        Drops when energy is below 30% of max or when fatigue is high.
        """
        energy_factor = np.clip(self.energy / (0.3 * self.energy_max), 0.2, 1.0)
        fatigue_factor = 1.0 - 0.55 * self.fatigue
        return float(np.clip(energy_factor * fatigue_factor, 0.2, 1.0))

    @property
    def alpha_cognitive(self) -> float:
        """
        Cognitive capacity multiplier in [0.25, 1.0].
        Affects planning horizon and attention.
        """
        energy_factor = np.clip(self.energy / (0.25 * self.energy_max), 0.25, 1.0)
        fatigue_factor = 1.0 - 0.6 * self.fatigue
        return float(np.clip(energy_factor * fatigue_factor, 0.25, 1.0))

    def step(
        self,
        dt: float,
        motor_force_norm: float = 0.0,
        cognitive_load: float = 0.1,
        stress_level: float = 0.0,
        is_resting: bool = False,
    ) -> Dict[str, float]:
        """
        Advance energy & fatigue state by dt seconds.
        """
        # 1. Absorb digesting food into available energy
        if self.digesting > 0.0:
            absorbed = min(self.digesting, self.digestion_rate * dt)
            self.digesting -= absorbed
            self.energy = min(self.energy_max, self.energy + absorbed)

        # 2. Calculate Kcal consumption
        e_basal = self.basal_rate * (0.6 if is_resting else 1.0)
        e_motor = self.motor_cost_coeff * (motor_force_norm ** 2)
        e_cog = self.cognitive_cost_coeff * cognitive_load
        e_stress = self.stress_cost_coeff * stress_level

        consumed = (e_basal + e_motor + e_cog + e_stress) * dt
        self.energy = float(np.clip(self.energy - consumed, 0.0, self.energy_max))

        # 3. Update fatigue
        if is_resting:
            # Recover fatigue while resting in bed
            self.fatigue = float(np.clip(self.fatigue - 0.08 * dt, 0.0, 1.0))
        else:
            fatigue_gain = (0.004 * (motor_force_norm ** 2) + 0.0015 * cognitive_load + 0.001) * dt
            if self.energy_ratio < 0.2:
                fatigue_gain *= 2.0
            self.fatigue = float(np.clip(self.fatigue + fatigue_gain, 0.0, 1.0))

        return self.to_dict()

    def eat(self, kcal: float = 250.0) -> None:
        """Add food calories to the digestion buffer."""
        self.digesting = float(min(self.digesting + kcal, self.energy_max))

    def rest(self, duration_sec: float = 2.0) -> None:
        """Immediate rest boost."""
        self.fatigue = float(np.clip(self.fatigue - 0.15 * duration_sec, 0.0, 1.0))
        if self.digesting > 0:
            transfer = min(self.digesting, 50.0 * duration_sec)
            self.digesting -= transfer
            self.energy = float(min(self.energy_max, self.energy + transfer))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "energy": round(self.energy, 2),
            "energy_max": round(self.energy_max, 2),
            "energy_ratio": round(self.energy_ratio, 3),
            "digesting": round(self.digesting, 2),
            "fatigue": round(self.fatigue, 3),
            "alpha_motor": round(self.alpha_motor, 3),
            "alpha_cognitive": round(self.alpha_cognitive, 3),
        }

    def load_dict(self, data: Dict[str, Any]) -> None:
        if not data:
            return
        self.energy_max = float(data.get("energy_max", self.energy_max))
        self.energy = float(np.clip(data.get("energy", self.energy), 0.0, self.energy_max))
        self.digesting = float(max(0.0, data.get("digesting", self.digesting)))
        self.fatigue = float(np.clip(data.get("fatigue", self.fatigue), 0.0, 1.0))

