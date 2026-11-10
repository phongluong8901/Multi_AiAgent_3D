from typing import Dict, Any
import numpy as np


class EnergySystem:
    """
    He thong Nang luong Sinh hoc (Biological Energy - Kcal) & Do Met moi (Fatigue).
    Cau noi truc tiep giua the chat van dong (motor) va nang luc lap ke hoach nhan thuc (cognitive):
    - Tieu hao Kcal theo toc do trao doi chat co ban (Basal Metabolic Rate - BMR).
    - Tieu hao Kcal ty le thuan voi luc day van toc (Motor Force).
    - Tieu hao Kcal theo tai trong suy nghi (Cognitive Load) va stress khi gap nguy hiem.
    - Chuyen hoa thuc an tu vung tieu hoa (Digesting Buffer) sang nang luong san sang su dung.
    - Tinh toan he so suy giam van dong (alpha_motor) va nhan thuc (alpha_cognitive) khi doi hoac kiet suc.
    """

    def __init__(
        self,
        energy: float = 800.0,
        energy_max: float = 1000.0,
        basal_rate: float = 1.2,
    ):
        """
        Khoi tao thong so he thong nang luong sinh hoc.

        Args:
            energy (float): Muc nang luong hien tai ban dau (Kcal), mac dinh 800.0.
            energy_max (float): Dung luong nang luong toi da (Kcal), mac dinh 1000.0.
            basal_rate (float): Toc do tieu thu co ban (Kcal/s khi khong hoat dong).
        """
        self.energy_max: float = float(energy_max)
        self.energy: float = float(np.clip(energy, 0.0, self.energy_max))
        self.digesting: float = 0.0
        self.fatigue: float = 0.0  # Do met moi trong khoang [0.0, 1.0]
        self.basal_rate: float = float(basal_rate)

        # Cac he so tieu hao va hap thu
        self.motor_cost_coeff: float = 3.5      # He so tieu hao khi chay nhay, van dong
        self.cognitive_cost_coeff: float = 1.0  # He so tieu hao khi tinh toan nhan thuc
        self.stress_cost_coeff: float = 1.5     # He so tieu hao khi hoang so hoac bi dau
        self.digestion_rate: float = 18.0       # Toc do hap thu Kcal tu thuc an moi giay

    @property
    def energy_ratio(self) -> float:
        """
        Ty le nang luong hien tai tren tong dung luong toi da [0.0, 1.0].
        """
        return float(np.clip(self.energy / max(self.energy_max, 1.0), 0.0, 1.0))

    @property
    def alpha_motor(self) -> float:
        """
        He so nhan hieu suat the chat (Physical Performance Multiplier) trong khoang [0.2, 1.0].
        Khi nang luong duoi 30% hoac khi met moi cao, toc do va luc day cua be se bi giam.
        """
        energy_factor = np.clip(self.energy / (0.3 * self.energy_max), 0.2, 1.0)
        fatigue_factor = 1.0 - 0.55 * self.fatigue
        return float(np.clip(energy_factor * fatigue_factor, 0.2, 1.0))

    @property
    def alpha_cognitive(self) -> float:
        """
        He so nhan dung luong nhan thuc (Cognitive Capacity Multiplier) trong khoang [0.25, 1.0].
        Anh huong den tam nhin lap ke hoach, su tap trung va kha nang to mo.
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
        Cap nhat tien trinh nang luong va do met moi theo buoc thoi gian dt (giay).

        Args:
            dt (float): Buoc thoi gian mo phong (vi du: 0.05s).
            motor_force_norm (float): Do lon cua luc van dong the chat [0.0 - 2.8].
            cognitive_load (float): Muc do tai trong nhan thuc tinh toan [0.0 - 1.0].
            stress_level (float): Muc do cang thang / so hai khi gan lo lua [0.0 - 1.0].
            is_resting (bool): True neu be dang nghi ngoi tren giuong ngu.

        Returns:
            Dict[str, float]: Thong so nang luong sau khi cap nhat.
        """
        # 1. Chuyen hoa thuc an trong bo dem tieu hoa sang nang luong san sang
        if self.digesting > 0.0:
            absorbed = min(self.digesting, self.digestion_rate * dt)
            self.digesting -= absorbed
            self.energy = min(self.energy_max, self.energy + absorbed)

        # 2. Tinh toan luong Kcal tieu thu
        e_basal = self.basal_rate * (0.6 if is_resting else 1.0)
        e_motor = self.motor_cost_coeff * (motor_force_norm ** 2)
        e_cog = self.cognitive_cost_coeff * cognitive_load
        e_stress = self.stress_cost_coeff * stress_level

        consumed = (e_basal + e_motor + e_cog + e_stress) * dt
        self.energy = float(np.clip(self.energy - consumed, 0.0, self.energy_max))

        # 3. Cap nhat do met moi (fatigue)
        if is_resting:
            # Hoi phuc the luc va giam met moi khi nam nghi tren giuong
            self.fatigue = float(np.clip(self.fatigue - 0.08 * dt, 0.0, 1.0))
        else:
            fatigue_gain = (0.004 * (motor_force_norm ** 2) + 0.0015 * cognitive_load + 0.001) * dt
            if self.energy_ratio < 0.2:
                fatigue_gain *= 2.0  # Kiệt sức nhanh hơn gấp đôi khi đói lả
            self.fatigue = float(np.clip(self.fatigue + fatigue_gain, 0.0, 1.0))

        return self.to_dict()

    def eat(self, kcal: float = 250.0) -> None:
        """
        Nap them luong Kcal tu thuc an vao bo dem tieu hoa.

        Args:
            kcal (float): Luong Kcal cua bua an (mac dinh 250.0 Kcal).
        """
        self.digesting = float(min(self.digesting + kcal, self.energy_max))

    def rest(self, duration_sec: float = 2.0) -> None:
        """
        Hoi phuc the luc tuc thoi khi nguoi dung an nut 'Nghi ngoi'.

        Args:
            duration_sec (float): Thoi gian nghi ngoi tuong duong (giay).
        """
        self.fatigue = float(np.clip(self.fatigue - 0.15 * duration_sec, 0.0, 1.0))
        if self.digesting > 0:
            transfer = min(self.digesting, 50.0 * duration_sec)
            self.digesting -= transfer
            self.energy = float(min(self.energy_max, self.energy + transfer))

    def to_dict(self) -> Dict[str, Any]:
        """
        Dong goi du lieu he thong nang luong de truyen qua WebSocket hoac luu tru.

        Returns:
            Dict[str, Any]: Cac chi so nang luong lam tron so thap phan dep.
        """
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
        """
        Khoi phuc trang thai he thong nang luong tu dictionary da luu tru.

        Args:
            data (Dict[str, Any]): Du lieu luu tru truoc do.
        """
        if not data:
            return
        self.energy_max = float(data.get("energy_max", self.energy_max))
        self.energy = float(np.clip(data.get("energy", self.energy), 0.0, self.energy_max))
        self.digesting = float(max(0.0, data.get("digesting", self.digesting)))
        self.fatigue = float(np.clip(data.get("fatigue", self.fatigue), 0.0, 1.0))
