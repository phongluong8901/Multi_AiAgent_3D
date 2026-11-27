"""Windows Application & Active Window Manager (list, focus, minimize, maximize, snap, launch, browser search)."""
import json
import os
import shutil
import subprocess
import urllib.parse
from pathlib import Path
from typing import Any

TOOL_SCHEMA: dict[str, Any] = {
    "name": "skill_app_window_manager",
    "description": (
        "Quản lý cửa sổ và ứng dụng đang chạy trên Windows: liệt kê cửa sổ đang mở (`list_windows`), "
        "chuyển tới (`focus_window`), thu nhỏ (`minimize_window`), phóng to (`maximize_window`), chia đôi màn hình (`snap_window`), "
        "mở ứng dụng hoặc URL (`launch_app`), hoặc mở trình duyệt tìm kiếm trực tiếp Google/YouTube (`open_browser_search`)."
    ),
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": [
                    "list_windows",
                    "focus_window",
                    "minimize_window",
                    "maximize_window",
                    "snap_window",
                    "launch_app",
                    "open_browser_search",
                ],
                "description": "Thao tác quản lý cửa sổ / mở app / mở trình duyệt tìm kiếm ngay.",
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
                "description": "Tên ứng dụng, đường dẫn file, hoặc URL https:// cần mở khi action='launch_app'.",
            },
            "query": {
                "type": "string",
                "description": "Từ khóa tìm kiếm trên Google/YouTube khi action='open_browser_search'.",
            },
            "site": {
                "type": "string",
                "enum": ["google", "youtube", "bing", "github", "wikipedia"],
                "description": "Trang tìm kiếm khi action='open_browser_search' (mặc định: google).",
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
        proc = subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=15)
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


def _resolve_windows_app(target: str) -> str | None:
    """Resolve an app name to an executable or Start Menu shortcut (.lnk) on Windows."""
    raw = (target or "").strip().strip('"').strip("'")
    if not raw:
        return None
    # 1. Explicit existing file path
    p = Path(raw)
    if p.exists():
        return str(p)
    # 2. On PATH (e.g. notepad, calc, code, wt)
    found_path = shutil.which(raw) or shutil.which(f"{raw}.exe")
    if found_path:
        return found_path

    low = raw.lower().removesuffix(".exe")
    # 3. Windows Start Menu shortcuts (.lnk) & Desktop shortcuts
    shortcut_roots = [
        Path(os.environ.get("APPDATA", "")) / "Microsoft" / "Windows" / "Start Menu" / "Programs",
        Path(os.environ.get("PROGRAMDATA", r"C:\ProgramData")) / "Microsoft" / "Windows" / "Start Menu" / "Programs",
        Path.home() / "Desktop",
    ]
    partial_match: str | None = None
    for root in shortcut_roots:
        try:
            if not root.exists():
                continue
            for lnk in root.rglob("*.lnk"):
                stem = lnk.stem.lower()
                if stem == low:
                    return str(lnk)
                if partial_match is None and low in stem:
                    partial_match = str(lnk)
        except OSError:
            continue
    if partial_match:
        return partial_match

    # 4. Common Windows install directories (%LOCALAPPDATA%\Programs, Program Files)
    local_app = Path(os.environ.get("LOCALAPPDATA", ""))
    install_candidates = [
        local_app / "Programs" / raw / f"{raw}.exe",
        local_app / raw / f"{raw}.exe",
        Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / raw / f"{raw}.exe",
        Path(os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)")) / raw / f"{raw}.exe",
    ]
    for cand in install_candidates:
        try:
            if cand.exists():
                return str(cand)
        except OSError:
            continue

    # 5. Case-insensitive 2-level scan under %LOCALAPPDATA%\Programs
    prog_dir = local_app / "Programs"
    try:
        if prog_dir.exists():
            for sub in prog_dir.iterdir():
                if sub.is_dir() and low in sub.name.lower():
                    for exe in sub.glob("*.exe"):
                        if low in exe.stem.lower():
                            return str(exe)
    except OSError:
        pass
    return None


def launch_app(app_name_or_path: str) -> dict[str, Any]:
    target = (app_name_or_path or "").strip()
    if not target:
        return {"ok": False, "error": "Missing app_name_or_path"}
    if target.lower().startswith(("http://", "https://")):
        try:
            os.startfile(target)
            return {"ok": True, "launched": target, "resolved_path": target, "type": "url"}
        except Exception as exc:
            return {"ok": False, "error": f"Khong the mo URL '{target}': {exc}"}
    resolved = _resolve_windows_app(target)
    if not resolved:
        return {
            "ok": False,
            "error": (
                f"Khong tim thay ung dung '{target}' tren Windows "
                "(da kiem tra PATH, Start Menu .lnk va thu muc Programs)."
            ),
        }
    try:
        os.startfile(resolved)
        return {"ok": True, "launched": target, "resolved_path": resolved}
    except Exception as exc:
        return {"ok": False, "error": f"Khong the mo '{resolved}': {exc}"}


def _resolve_first_youtube_video_url(encoded_query: str) -> str | None:
    """Resolve the top YouTube watch URL (`watch?v=...`) so opening it auto-plays immediately."""
    import re as _re

    search_url = f"https://www.youtube.com/results?search_query={encoded_query}"
    try:
        import httpx

        resp = httpx.get(
            search_url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
            timeout=5.0,
            follow_redirects=True,
        )
        if resp.status_code == 200:
            m = _re.search(r'"videoId":"([a-zA-Z0-9_-]{11})"', resp.text)
            if m:
                return f"https://www.youtube.com/watch?v={m.group(1)}"
    except Exception:
        pass
    return None


def _open_url_in_new_window(url: str) -> str:
    """Open URL in a dedicated new Chrome/Edge window (--new-window), falling back to os.startfile."""
    import subprocess as _sp

    candidates = [
        shutil.which("chrome"),
        shutil.which("chrome.exe"),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        shutil.which("msedge"),
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ]
    browser_exe = next((p for p in candidates if p and os.path.isfile(p)), None)
    if browser_exe:
        flags = (
            getattr(_sp, "DETACHED_PROCESS", 0) | getattr(_sp, "CREATE_NEW_PROCESS_GROUP", 0)
            if os.name == "nt"
            else 0
        )
        _sp.Popen(
            [browser_exe, "--new-window", url],
            stdout=_sp.DEVNULL,
            stderr=_sp.DEVNULL,
            creationflags=flags,
        )
        return browser_exe
    os.startfile(url)
    return "os.startfile"


def open_browser_search(
    query: str,
    site: str = "google",
    auto_play: bool = True,
    new_window: bool = True,
) -> dict[str, Any]:
    q = (query or "").strip()
    if not q:
        return {"ok": False, "error": "Missing search query"}
    encoded = urllib.parse.quote_plus(q)
    site_key = (site or "google").strip().lower()
    url_map = {
        "google": f"https://www.google.com/search?q={encoded}",
        "youtube": f"https://www.youtube.com/results?search_query={encoded}",
        "bing": f"https://www.bing.com/search?q={encoded}",
        "github": f"https://github.com/search?q={encoded}",
        "wikipedia": f"https://vi.wikipedia.org/w/index.php?search={encoded}",
    }
    url = url_map.get(site_key, url_map["google"])
    direct_video = False
    if site_key == "youtube" and auto_play:
        watch_url = _resolve_first_youtube_video_url(encoded)
        if watch_url:
            url = watch_url
            direct_video = True
    try:
        if new_window:
            launcher = _open_url_in_new_window(url)
        else:
            os.startfile(url)
            launcher = "os.startfile"
        return {
            "ok": True,
            "site": site_key,
            "query": q,
            "url": url,
            "new_window": bool(new_window),
            "launcher": launcher,
            "direct_video_playback": direct_video,
        }
    except Exception as exc:
        return {"ok": False, "error": f"Khong the mo trinh duyet voi URL '{url}': {exc}"}


def execute(action: str = "list_windows", **kwargs: Any) -> dict[str, Any]:
    act = (action or "list_windows").strip().lower()
    try:
        if act == "open_browser_search":
            return open_browser_search(
                query=kwargs.get("query") or kwargs.get("title_query") or kwargs.get("app_name_or_path") or "",
                site=kwargs.get("site", "google"),
                auto_play=kwargs.get("auto_play", True),
                new_window=kwargs.get("new_window", True),
            )
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
