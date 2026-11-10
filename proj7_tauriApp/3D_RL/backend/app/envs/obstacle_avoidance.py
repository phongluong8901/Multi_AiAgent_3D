"""
Module Wrapper Tuong Thich Tranh Ne Vat Can (Obstacle Avoidance Environment).
Ke thua truc tiep tu ChildWorldEnv de tuong thich hoan hao voi cac pipeline huan luyen PPO
va Stable-Baselines3 cu.
"""

from .child_world_env import ChildWorldEnv


class ObstacleAvoidanceEnv(ChildWorldEnv):
    """
    Lop wrapper tuong thich nguoc (Backward Compatibility Wrapper).
    Ke thua toan bo he thong the gioi dai do thi 100x100, nang luong sinh hoc (EnergySystem),
    dong luc noi tai (DriveSystem), xe co dong va cac khu vuc tai nguyen tu ChildWorldEnv.
    """

    def __init__(self, persist_internal: bool = False):
        """
        Khoi tao moi truong tranh ne vat can.

        Args:
            persist_internal (bool): True neu muon giu nguyen muc nang luong va dong luc
                                    khi reset giua cac episode, False neu reset ve ban dau.
        """
        super().__init__(persist_internal=persist_internal)
