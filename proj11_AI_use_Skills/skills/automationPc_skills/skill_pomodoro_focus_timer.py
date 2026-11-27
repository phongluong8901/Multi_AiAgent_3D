import json
import os
from datetime import datetime, timedelta

TOOL_SCHEMA = {
    "name": "skill_pomodoro_focus_timer",
    "description": "Track Pomodoro focus sessions in a local JSON log: start/stop session, record task label, and summarize daily focus minutes.",
    "risk_level": "safe",
    "parameters": {
        "start_session": {
            "task": "str='Deep Work'",
            "minutes": "int=25",
            "log_path": "str='focus_log.json'"
        },
        "complete_session": {
            "log_path": "str='focus_log.json'"
        },
        "daily_summary": {
            "log_path": "str='focus_log.json'"
        }
    }
}

def execute(action: str = "", **kwargs) -> dict:
    if action == "start_session":
        return _safe_call(start_session, kwargs)
    elif action == "complete_session":
        return _safe_call(complete_session, kwargs)
    elif action == "daily_summary":
        return _safe_call(daily_summary, kwargs)
    else:
        return {"ok": False, "error": "Unknown action"}

def start_session(task: str = 'Deep Work', minutes: int = 25, log_path: str = 'focus_log.json') -> dict:
    try:
        session = {
            "task": task,
            "start_time": datetime.now().isoformat(),
            "duration": minutes
        }
        log = _load_log(log_path)
        log.append(session)
        _save_log(log_path, log)
        return {"ok": True, "session": session}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def complete_session(log_path: str = 'focus_log.json') -> dict:
    try:
        log = _load_log(log_path)
        if not log:
            return {"ok": False, "error": "No active sessions to complete"}
        last_session = log[-1]
        if "end_time" in last_session:
            return {"ok": False, "error": "Session already completed"}
        last_session["end_time"] = datetime.now().isoformat()
        _save_log(log_path, log)
        return {"ok": True, "session": last_session}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def daily_summary(log_path: str = 'focus_log.json') -> dict:
    try:
        log = _load_log(log_path)
        today = datetime.now().date()
        total_minutes = sum(
            session["duration"]
            for session in log
            if datetime.fromisoformat(session["start_time"]).date() == today and "end_time" in session
        )
        return {"ok": True, "total_minutes": total_minutes}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def _load_log(log_path: str) -> list:
    if not os.path.exists(log_path):
        return []
    with open(log_path, 'r') as file:
        return json.load(file)

def _save_log(log_path: str, log: list) -> None:
    with open(log_path, 'w') as file:
        json.dump(log, file, indent=4)

def _safe_call(fn, kw):
    import inspect as _insp
    sig = _insp.signature(fn)
    if any(p.kind == _insp.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kw)
    valid = {k: v for k, v in kw.items() if k in sig.parameters}
    return fn(**valid)
