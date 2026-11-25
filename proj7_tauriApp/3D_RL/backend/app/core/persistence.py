import json
import sqlite3
import time
from pathlib import Path
from typing import Dict, Any, List, Optional
from .config import BASE_DIR


class PersistenceManager:
    """
    Quan ly luu tru ben vung du lieu cua Agent va Teacher tren may cuc bo:
    1. Trạng thái Agent (agent_state.json):
       - Luu vi tri, diem thuong, nang luong, cac chi so tam ly va tien do nhan thuc.
    2. Du lieu Thi pham & Ky uc (memory.sqlite):
       - Luu cac buoc thi pham (demonstrations) do Teacher truc tiep dieu khien (WASD).
       - Phuc vu huan luyen Bat chuoc (Behavioral Cloning - BC).
    """

    def __init__(self):
        """Khoi tao duong dan thu muc data, file JSON va co so du lieu SQLite."""
        self.data_dir: Path = BASE_DIR / "data"
        self.state_path: Path = self.data_dir / "agent_state.json"
        self.db_path: Path = self.data_dir / "memory.sqlite"
        self._ensure_storage()

    def _ensure_storage(self) -> None:
        """
        Kiem tra va tu dong tao thu muc data/ cung nhu bang demonstrations trong SQLite
        neu chua ton tai.
        """
        try:
            self.data_dir.mkdir(parents=True, exist_ok=True)
            with sqlite3.connect(str(self.db_path)) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS demonstrations (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp REAL NOT NULL,
                        obs_json TEXT NOT NULL,
                        action_json TEXT NOT NULL,
                        drives_json TEXT NOT NULL,
                        energy REAL NOT NULL,
                        reward REAL NOT NULL
                    )
                    """
                )
                conn.commit()
        except Exception:
            pass

    def record_demonstration(
        self,
        obs: List[float],
        action: List[float],
        drives: Dict[str, float],
        energy: float,
        reward: float,
    ) -> int:
        """
        Luu mot mau thi pham (state, action, internal_context) tu Teacher vao CSDL SQLite.

        Args:
            obs (List[float]): Vector quan sat tai thoi diem hien tai (28 chieu).
            action (List[float]): Hanh dong van toc [vx, vz] do nguoi dung nhap qua WASD.
            drives (Dict[str, float]): Cac chi so dong luc sinh hoc (hunger, thirst, fatigue,...).
            energy (float): Muc nang luong sinh hoc tai thoi diem do (Kcal).
            reward (float): Diem thuong nhan duoc tu moi truong.

        Returns:
            int: Tong so mau thi pham hien co trong CSDL sau khi luu.
        """
        try:
            self._ensure_storage()
            with sqlite3.connect(str(self.db_path)) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO demonstrations (timestamp, obs_json, action_json, drives_json, energy, reward)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        time.time(),
                        json.dumps([round(float(x), 4) for x in obs]),
                        json.dumps([round(float(x), 4) for x in action]),
                        json.dumps(drives),
                        float(energy),
                        float(reward),
                    ),
                )
                conn.commit()
        except Exception:
            pass
        return self.get_demo_count()

    def get_demo_count(self) -> int:
        """
        Dem tong so mau thi pham hien co trong CSDL demonstrations.

        Returns:
            int: So luong mau (tra ve 0 neu CSDL rong hoac gap loi).
        """
        try:
            if not self.db_path.exists():
                return 0
            with sqlite3.connect(str(self.db_path)) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM demonstrations")
                row = cursor.fetchone()
                return int(row[0]) if row else 0
        except Exception:
            return 0

    def load_all_demonstrations(self) -> List[Dict[str, Any]]:
        """
        Nap toan bo mau thi pham da luu tu SQLite de phuc vu huan luyen Bat chuoc (Behavioral Cloning).

        Returns:
            List[Dict[str, Any]]: Danh sach cac dict chua obs, action, drives, energy, reward.
        """
        results: List[Dict[str, Any]] = []
        try:
            if not self.db_path.exists():
                return results
            with sqlite3.connect(str(self.db_path)) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT id, timestamp, obs_json, action_json, drives_json, energy, reward FROM demonstrations ORDER BY id ASC"
                )
                rows = cursor.fetchall()
                for r in rows:
                    results.append(
                        {
                            "id": r[0],
                            "timestamp": r[1],
                            "obs": json.loads(r[2]),
                            "action": json.loads(r[3]),
                            "drives": json.loads(r[4]),
                            "energy": r[5],
                            "reward": r[6],
                        }
                    )
        except Exception:
            pass
        return results

    def clear_demonstrations(self) -> int:
        """
        Xoa sach toan bo du lieu thi pham trong CSDL demonstrations (phuc vu reset).

        Returns:
            int: Luon tra ve 0 sau khi xoa.
        """
        try:
            if self.db_path.exists():
                with sqlite3.connect(str(self.db_path)) as conn:
                    cursor = conn.cursor()
                    cursor.execute("DELETE FROM demonstrations")
                    conn.commit()
        except Exception:
            pass
        return 0

    def save_agent_state(self, state_dict: Dict[str, Any]) -> bool:
        """
        Luu trang thai tong the cua moi truong va agent ra file agent_state.json.

        Args:
            state_dict (Dict[str, Any]): Du lieu trang thai xuat tu env.export_state().

        Returns:
            bool: True neu luu thanh cong, False neu that bai.
        """
        try:
            self._ensure_storage()
            payload = {
                "saved_at": time.time(),
                **state_dict,
            }
            self.state_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
            return True
        except Exception:
            return False

    def load_agent_state(self) -> Optional[Dict[str, Any]]:
        """
        Doc lai trang thai da luu truoc do tu file agent_state.json.

        Returns:
            Optional[Dict[str, Any]]: Du lieu trang thai hoac None neu file khong ton tai.
        """
        try:
            if not self.state_path.exists():
                return None
            content = self.state_path.read_text(encoding="utf-8")
            return json.loads(content)
        except Exception:
            return None


# The hien quan ly luu tru toan cuc
persistence_manager = PersistenceManager()
