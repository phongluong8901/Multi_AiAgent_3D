import json
import sqlite3
import time
from pathlib import Path
from typing import Dict, Any, List, Optional
from .config import BASE_DIR


class PersistenceManager:
    """
    Local Persistence for Agent State (JSON) and Teacher Demonstrations / Memory (SQLite).
    """

    def __init__(self):
        self.data_dir: Path = BASE_DIR / "data"
        self.state_path: Path = self.data_dir / "agent_state.json"
        self.db_path: Path = self.data_dir / "memory.sqlite"
        self._ensure_storage()

    def _ensure_storage(self) -> None:
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
        Save a single (state, action, internal_context) demonstration step from Teacher.
        Returns the total demonstration count.
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

    def clear_demonstrations(self) -> int:
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
        try:
            if not self.state_path.exists():
                return None
            content = self.state_path.read_text(encoding="utf-8")
            return json.loads(content)
        except Exception:
            return None


persistence_manager = PersistenceManager()

