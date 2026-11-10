from typing import Dict, Any, Optional
import numpy as np
from .energy import EnergySystem


class DriveSystem:
    """
    He thong Dong luc Noi tai & Can bang Noi moi (Homeostasis & Drive System).
    Mo phong he vi mach cam xuc va nhu cau sinh ton cua tre em:
    - 8 dong luc noi tai: hunger, thirst, fatigue, pain, fear, curiosity, comfort, social.
    - Moi dong luc la mot bien lien tuc nam trong khoang [0.0, 1.0].
    - Tinh toan Do cap thiet phi tuyen (Non-linear Urgency): Urgency_i = w_i * (drive_i ^ gamma_i).
    - Tu dong chon ra Dong luc Chi phoi (Dominant Drive) de dinh huong hanh vi.
    - Co che Canh bao Sinh ton (Survival Override): Kich hoat khi co dong luc nguy cap vuot nguong 0.85.
    """

    DRIVE_NAMES = (
        "hunger",
        "thirst",
        "fatigue",
        "pain",
        "fear",
        "curiosity",
        "comfort",
        "social",
    )

    def __init__(self):
        """Khoi tao gia tri dong luc ban dau va trong so tinh do cap thiet."""
        self.drives: Dict[str, float] = {
            "hunger": 0.20,
            "thirst": 0.15,
            "fatigue": 0.10,
            "pain": 0.00,
            "fear": 0.00,
            "curiosity": 0.55,
            "comfort": 0.85,
            "social": 0.30,
        }

        # Trong so uu tien: Urgency_i = w_i * (drive_i ^ gamma_i)
        # Cac dong luc sinh ton cap thiet (pain, fear, thirst, hunger) co he so cao
        self.weights: Dict[str, float] = {
            "pain": 2.4,
            "fear": 2.0,
            "thirst": 1.5,
            "hunger": 1.4,
            "fatigue": 1.3,
            "social": 1.1,
            "curiosity": 0.9,
        }
        # So mu phi tuyen tao su bung no do cap thiet khi vuot nguong cao
        self.exponents: Dict[str, float] = {
            "pain": 1.5,
            "fear": 1.6,
            "thirst": 2.0,
            "hunger": 2.0,
            "fatigue": 2.1,
            "social": 1.7,
            "curiosity": 1.2,
        }

    def step(
        self,
        dt: float,
        energy_sys: EnergySystem,
        events: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Cap nhat toan bo cac dong luc noi tai theo thoi gian dt dua tren nang luong the chat
        va cac su kien tu the gioi mo phong (va cham, an uong, gap ban be).

        Args:
            dt (float): Buoc thoi gian mo phong (s).
            energy_sys (EnergySystem): Tham chieu he thong nang luong sinh hoc cua be.
            events (Optional[Dict[str, Any]]): Dict su kien tu moi truong (ate_food, collided,...).

        Returns:
            Dict[str, Any]: Trạng thái dong luc, muc do cap thiet va dong luc chu dao sau buoc tinh.
        """
        events = events or {}

        # 1. Doi (Hunger): Tang dan theo thoi gian va tang nhanh khi Kcal can kiet
        hunger_drift = 0.0035 * dt
        if energy_sys.energy_ratio < 0.4:
            hunger_drift += 0.008 * (0.4 - energy_sys.energy_ratio) * dt
        self.drives["hunger"] = float(np.clip(self.drives["hunger"] + hunger_drift, 0.0, 1.0))

        # 2. Khat (Thirst): Tang deu dan theo thoi gian
        thirst_drift = 0.0045 * dt
        self.drives["thirst"] = float(np.clip(self.drives["thirst"] + thirst_drift, 0.0, 1.0))

        # 3. Met moi (Fatigue): Dong bo voi EnergySystem va chu ky ngay/dem sinh hoc
        fatigue_drift = 0.0
        if events.get("is_night", False):
            fatigue_drift = 0.015 * dt  # Buoi dem day nhanh cam giac buon ngu
        self.drives["fatigue"] = float(np.clip(energy_sys.fatigue + fatigue_drift, 0.0, 1.0))

        # 4. Dau (Pain) & So hai (Fear): Tang vot khi va cham hoac gan nguy hiem, phai mo dan theo thoi gian
        if events.get("collided", False):
            self.drives["pain"] = float(np.clip(self.drives["pain"] + 0.45, 0.0, 1.0))
            self.drives["fear"] = float(np.clip(self.drives["fear"] + 0.30, 0.0, 1.0))
        else:
            self.drives["pain"] = float(np.clip(self.drives["pain"] - 0.04 * dt, 0.0, 1.0))

        # Noi so tang khi chung kien ban be bi dau (Hoc quan sat xa hoi / Empathy)
        if events.get("peer_in_pain", False):
            self.drives["fear"] = float(np.clip(self.drives["fear"] + 0.25, 0.0, 1.0))

        near_hazard = float(events.get("hazard_proximity", 0.0))
        if near_hazard > 0.0:
            self.drives["fear"] = float(np.clip(self.drives["fear"] + 0.12 * near_hazard * dt, 0.0, 1.0))
        else:
            self.drives["fear"] = float(np.clip(self.drives["fear"] - 0.03 * dt, 0.0, 1.0))

        # 5. Giai toa nhu cau qua cac su kien tieu thu
        if events.get("ate_food", False):
            self.drives["hunger"] = float(np.clip(self.drives["hunger"] - 0.45, 0.0, 1.0))

        if events.get("drank_water", False):
            self.drives["thirst"] = float(np.clip(self.drives["thirst"] - 0.55, 0.0, 1.0))

        if events.get("is_resting", False):
            self.drives["pain"] = float(np.clip(self.drives["pain"] - 0.08 * dt, 0.0, 1.0))
            self.drives["fear"] = float(np.clip(self.drives["fear"] - 0.08 * dt, 0.0, 1.0))

        # 6. Nhu cau Xa hoi & Gan ket (Social / Loneliness Drive)
        if events.get("near_peer", False):
            # O gan ban be -> Giam co don nhanh chong, tang su gan ket
            self.drives["social"] = float(np.clip(self.drives["social"] - 0.08 * dt, 0.0, 1.0))
        else:
            # O mot minh lau -> Tang nhu cau tim ban bau ban
            self.drives["social"] = float(np.clip(self.drives["social"] + 0.005 * dt, 0.0, 1.0))

        # 7. Do Thoai mai (Comfort): Nghich dao cua dau don, so hai, doi khat va co don
        discomfort = max(
            self.drives["pain"],
            self.drives["fear"] * 0.8,
            self.drives["social"] * 0.5,
            max(0.0, self.drives["hunger"] - 0.5),
            max(0.0, self.drives["fatigue"] - 0.5),
        )
        self.drives["comfort"] = float(np.clip(1.0 - discomfort, 0.0, 1.0))

        # 8. Tinh To mo (Curiosity): Nay no manh me khi be no am va khong co ap luc sinh ton
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
        """
        Tinh toan do cap thiet phi tuyen cho tung dong luc: Urgency = weight * (drive ^ exponent).

        Returns:
            Dict[str, float]: Ban do cap thiet cua tung dong luc.
        """
        urgencies: Dict[str, float] = {}
        for k, w in self.weights.items():
            val = self.drives.get(k, 0.0)
            gamma = self.exponents.get(k, 1.5)
            urgencies[k] = round(float(w * (val ** gamma)), 4)
        return urgencies

    def get_dominant_drive(self) -> str:
        """
        Xac dinh dong luc co do cap thiet cao nhat de dieu huong hanh vi chinh cua be.

        Returns:
            str: Ten dong luc chi phoi (vi du: 'hunger', 'curiosity', 'fatigue',...).
        """
        urgencies = self.get_urgencies()
        if not urgencies:
            return "curiosity"
        return max(urgencies, key=lambda k: urgencies[k])

    def is_survival_override(self) -> bool:
        """
        Kiem tra co dong luc sinh ton nao dang vuot nguong khan cap (> 0.85) can duoc uu tien tuyet doi.

        Returns:
            bool: True neu can ghi de sinh ton, False neu be dang an toan.
        """
        return any(
            self.drives[k] > 0.85
            for k in ("pain", "fear", "hunger", "thirst", "fatigue")
        )

    def to_dict(self) -> Dict[str, Any]:
        """
        Dong goi du lieu he thong dong luc de truyen ve frontend va luu tru.

        Returns:
            Dict[str, Any]: Dict chua drives, urgencies, dominant_drive va survival_override.
        """
        return {
            "drives": {k: round(v, 3) for k, v in self.drives.items()},
            "urgencies": self.get_urgencies(),
            "dominant_drive": self.get_dominant_drive(),
            "survival_override": self.is_survival_override(),
        }

    def load_dict(self, data: Dict[str, Any]) -> None:
        """
        Khoi phuc cac chi so dong luc tu du lieu da luu tru truoc do.

        Args:
            data (Dict[str, Any]): Du lieu luu tru can khoi phuc.
        """
        if not data:
            return
        raw_drives = data.get("drives", data)
        if isinstance(raw_drives, dict):
            for k in self.DRIVE_NAMES:
                if k in raw_drives:
                    self.drives[k] = float(np.clip(raw_drives[k], 0.0, 1.0))
