import ast
import json
from typing import Any

TOOL_SCHEMA = {
    "name": "skill_dev_fullstack_feature_pack",
    "description": (
        "sinh module tính năng sâu cho backend mini app: API cache TTL, realtime SSE Server-Sent Events, "
        "xác thực mã PIN token, lưu cài đặt SQLite và xuất CSV JSON. "
        "Generate production-ready Python backend feature modules (TTL cache, SSE stream, PIN auth + SQLite settings, CSV/JSON exporter)."
    ),
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": [
                    "generate_ttl_cache_module",
                    "generate_sse_stream_helper",
                    "generate_auth_settings_module",
                    "generate_csv_json_exporter",
                ],
            },
            "default_ttl_sec": {"type": "integer"},
            "channel_name": {"type": "string"},
            "pin_env_var": {"type": "string"},
            "db_path": {"type": "string"},
        },
        "required": ["action"],
    },
}

_TTL_TEMPLATE = r"""import time
from typing import Any

class TTLCache:
    def __init__(self, default_ttl_sec: int = __TTL__):
        self.default_ttl_sec = max(1, int(default_ttl_sec))
        self._store: dict[str, tuple[float, Any]] = {}

    def set(self, key: str, value: Any, ttl_sec: int | None = None) -> None:
        ttl = self.default_ttl_sec if ttl_sec is None else max(1, int(ttl_sec))
        self._store[key] = (time.time() + ttl, value)

    def get(self, key: str, default: Any = None) -> Any:
        item = self._store.get(key)
        if not item:
            return default
        exp, val = item
        if time.time() > exp:
            self._store.pop(key, None)
            return default
        return val

    def clear_expired(self) -> int:
        now = time.time()
        expired = [k for k, (exp, _) in self._store.items() if now > exp]
        for k in expired:
            self._store.pop(k, None)
        return len(expired)
"""

_SSE_TEMPLATE = r"""import json
from typing import Any

DEFAULT_CHANNEL = __CHANNEL__

def format_sse_event(data: Any, event: str = DEFAULT_CHANNEL, event_id: str | None = None) -> str:
    payload = data if isinstance(data, str) else json.dumps(data, ensure_ascii=False)
    lines = []
    if event_id is not None:
        lines.append(f"id: {event_id}")
    if event:
        lines.append(f"event: {event}")
    for line in payload.splitlines() or [""]:
        lines.append(f"data: {line}")
    return "\n".join(lines) + "\n\n"
"""

_AUTH_SETTINGS_TEMPLATE = r"""import hmac
import json
import os
import sqlite3
from typing import Any

PIN_ENV_VAR = __PIN_ENV__
DEFAULT_DB_PATH = __DB_PATH__

def verify_pin_or_token(provided: str, env_var: str = PIN_ENV_VAR) -> bool:
    expected = os.environ.get(env_var, "")
    if not expected:
        return True
    return hmac.compare_digest(str(provided or ""), expected)

class SettingsStore:
    def __init__(self, db_path: str = DEFAULT_DB_PATH):
        self.db_path = db_path
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("CREATE TABLE IF NOT EXISTS app_settings (k TEXT PRIMARY KEY, v TEXT NOT NULL)")

    def set(self, key: str, value: Any) -> None:
        raw = json.dumps(value, ensure_ascii=False)
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("INSERT OR REPLACE INTO app_settings (k, v) VALUES (?, ?)", (key, raw))

    def get(self, key: str, default: Any = None) -> Any:
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute("SELECT v FROM app_settings WHERE k = ?", (key,)).fetchone()
        return json.loads(row[0]) if row else default
"""

_EXPORTER_TEMPLATE = r"""import csv
import io
import json
from typing import Any

def export_records_csv(records: list[dict[str, Any]]) -> str:
    if not records:
        return ""
    fieldnames = list(records[0].keys())
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(records)
    return buf.getvalue()

def export_records_json(records: list[dict[str, Any]], indent: int = 2) -> str:
    return json.dumps(records, ensure_ascii=False, indent=indent)
"""

def generate_ttl_cache_module(default_ttl_sec: int = 600) -> dict[str, Any]:
    code = _TTL_TEMPLATE.replace("__TTL__", str(max(1, int(default_ttl_sec))))
    ast.parse(code)
    return {"ok": True, "filename": "ttl_cache.py", "code": code}

def generate_sse_stream_helper(channel_name: str = "events") -> dict[str, Any]:
    code = _SSE_TEMPLATE.replace("__CHANNEL__", json.dumps(str(channel_name)))
    ast.parse(code)
    return {"ok": True, "filename": "sse_helper.py", "code": code}

def generate_auth_settings_module(pin_env_var: str = "APP_PIN", db_path: str = "settings.db") -> dict[str, Any]:
    code = (
        _AUTH_SETTINGS_TEMPLATE
        .replace("__PIN_ENV__", json.dumps(str(pin_env_var)))
        .replace("__DB_PATH__", json.dumps(str(db_path)))
    )
    ast.parse(code)
    return {"ok": True, "filename": "auth_settings.py", "code": code}

def generate_csv_json_exporter() -> dict[str, Any]:
    code = _EXPORTER_TEMPLATE
    ast.parse(code)
    return {"ok": True, "filename": "data_exporter.py", "code": code}

def execute(action: str = "", **kwargs: Any) -> dict[str, Any]:
    handlers = {
        "generate_ttl_cache_module": generate_ttl_cache_module,
        "generate_sse_stream_helper": generate_sse_stream_helper,
        "generate_auth_settings_module": generate_auth_settings_module,
        "generate_csv_json_exporter": generate_csv_json_exporter,
    }
    if action not in handlers:
        return {"ok": False, "error": f"Unknown action: {action}"}
    try:
        return handlers[action](**kwargs)
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
