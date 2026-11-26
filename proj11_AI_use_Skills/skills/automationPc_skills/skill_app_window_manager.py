"""Windows Application & Active Window Manager (list, focus, minimize, maximize, snap, launch)."""
import json
import subprocess
from typing import Any

TOOL_SCHEMA: dict[str, Any] = {
    "name": "skill_app_window_manager",
    "description": (
        "Quản lý cửa sổ và ứng dụng đang chạy trên Windows: liệt kê tất cả các cửa sổ đang mở (active windows), "
        "chuyển tới (focus), thu nhỏ (minimize), phóng to (maximize), chia đôi màn hình (snap trái/phải), hoặc mở ứng dụng mới. "
        "Windows window & app manager: list open windows, focus, minimize, maximize, snap, launch app."
    ),
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["list_windows", "focus_window", "minimize_window", "maximize_window", "snap_window", "launch_app"],
                "description": "Thao tác quản lý cửa sổ (mặc định: list_windows).",
            },
            "title_query": {
                "type": "string",
                "description": "Một phần tiêu đề cửa sổ cần thao tác (ví dụ: 'Chrome', 'Code', 'Zalo').",
            },
            "position": {
                "type": "string",
                "enum": ["left", "right", "top", "bottom"],
                "description": "Vị trí chia màn hình khi action='snap_window'.",
            },
            "app_name_or_path": {
                "type": "string",
                "description": "Tên hoặc đường dẫn ứng dụng cần mở khi action='launch_app' (ví dụ: 'notepad', 'calc').",
            },
        },
        "required": ["action"],
    },
}


def list_windows() -> dict[str, Any]:
    try:
        import pygetwindow as gw  # type: ignore
        wins = []
        for w in gw.getAllWindows():
            title = (w.title or "").strip()
            if not title:
                continue
            wins.append({
                "title": title,
                "left": int(getattr(w, "left", 0)),
                "top": int(getattr(w, "top", 0)),
                "width": int(getattr(w, "width", 0)),
                "height": int(getattr(w, "height", 0)),
                "minimized": bool(getattr(w, "isMinimized", False)),
                "active": bool(getattr(w, "isActive", False)),
            })
        return {"ok": True, "count": len(wins), "windows": wins, "backend": "pygetwindow"}
    except ImportError:
        ps = (
            "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;"
            "Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | "
            "Select-Object Id,ProcessName,MainWindowTitle | ConvertTo-Json"
        )
        proc = subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, text=True, timeout=15)
        if proc.returncode != 0:
            return {"ok": False, "error": proc.stderr.strip() or "Failed to list windows via PowerShell"}
        raw = proc.stdout.strip()
        rows = json.loads(raw) if raw else []
        if isinstance(rows, dict):
            rows = [rows]
        wins = [{"pid": r.get("Id"), "process": r.get("ProcessName"), "title": r.get("MainWindowTitle")} for r in rows]
        return {"ok": True, "count": len(wins), "windows": wins, "backend": "powershell"}


def _find_window(title_query: str):
    import pygetwindow as gw  # type: ignore
    q = (title_query or "").strip().lower()
    for w in gw.getAllWindows():
        if q and q in (w.title or "").lower():
            return w
    return None


def focus_window(title_query: str) -> dict[str, Any]:
    if not (title_query or "").strip():
        return {"ok": False, "error": "Missing title_query"}
    try:
        w = _find_window(title_query)
        if not w:
            return {"ok": False, "error": f"Window not found matching '{title_query}'"}
        if getattr(w, "isMinimized", False):
            w.restore()
        w.activate()
        return {"ok": True, "title": w.title, "action": "focused"}
    except ImportError:
        return {"ok": False, "error": "Missing package pygetwindow (pip install pygetwindow)"}


def minimize_window(title_query: str) -> dict[str, Any]:
    try:
        w = _find_window(title_query)
        if not w:
            return {"ok": False, "error": f"Window not found matching '{title_query}'"}
        w.minimize()
        return {"ok": True, "title": w.title, "action": "minimized"}
    except ImportError:
        return {"ok": False, "error": "Missing package pygetwindow"}


def maximize_window(title_query: str) -> dict[str, Any]:
    try:
        w = _find_window(title_query)
        if not w:
            return {"ok": False, "error": f"Window not found matching '{title_query}'"}
        w.maximize()
        return {"ok": True, "title": w.title, "action": "maximized"}
    except ImportError:
        return {"ok": False, "error": "Missing package pygetwindow"}


def snap_window(title_query: str, position: str = "left") -> dict[str, Any]:
    try:
        w = _find_window(title_query)
        if not w:
            return {"ok": False, "error": f"Window not found matching '{title_query}'"}
        sw, sh = 1920, 1040
        try:
            import pyautogui  # type: ignore
            sw, sh = pyautogui.size()
            sh = max(400, sh - 40)
        except Exception:
            pass
        if getattr(w, "isMinimized", False):
            w.restore()
        pos = (position or "left").lower()
        if pos == "right":
            w.moveTo(sw // 2, 0); w.resizeTo(sw // 2, sh)
        elif pos == "top":
            w.moveTo(0, 0); w.resizeTo(sw, sh // 2)
        elif pos == "bottom":
            w.moveTo(0, sh // 2); w.resizeTo(sw, sh // 2)
        else:
            w.moveTo(0, 0); w.resizeTo(sw // 2, sh)
        return {"ok": True, "title": w.title, "position": pos}
    except ImportError:
        return {"ok": False, "error": "Missing package pygetwindow"}


def launch_app(app_name_or_path: str) -> dict[str, Any]:
    target = (app_name_or_path or "").strip()
    if not target:
        return {"ok": False, "error": "Missing app_name_or_path"}
    proc = subprocess.Popen(["cmd", "/c", "start", "", target], shell=False)
    return {"ok": True, "launched": target, "pid": proc.pid}


def execute(action: str = "list_windows", **kwargs: Any) -> dict[str, Any]:
    act = (action or "list_windows").strip().lower()
    try:
        if act == "list_windows":
            return list_windows()
        if act == "focus_window":
            return focus_window(kwargs.get("title_query", ""))
        if act == "minimize_window":
            return minimize_window(kwargs.get("title_query", ""))
        if act == "maximize_window":
            return maximize_window(kwargs.get("title_query", ""))
        if act == "snap_window":
            return snap_window(kwargs.get("title_query", ""), kwargs.get("position", "left"))
        if act == "launch_app":
            return launch_app(kwargs.get("app_name_or_path", ""))
        return {"ok": False, "error": f"Unknown action: {action}"}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
