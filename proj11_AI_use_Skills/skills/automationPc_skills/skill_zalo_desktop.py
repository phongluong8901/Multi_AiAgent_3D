"""Windows Zalo Desktop App Automation (launch/focus Zalo, search contact, send Vietnamese message & files)."""
from __future__ import annotations

import os
import subprocess
import time
from pathlib import Path
from typing import Any

TOOL_SCHEMA: dict[str, Any] = {
    "name": "skill_zalo_desktop",
    "risk_level": "confirm",
    "description": (
        "Tự động hóa 100% ứng dụng Zalo Desktop trên Windows (KHÔNG dùng web): mở/focus cửa sổ Zalo PC, "
        "tìm kiếm người nhận (Ctrl+F), mở khung chat, đọc N tin nhắn gần nhất (tự cuộn lên ghép ảnh cho Gemini Vision "
        "và tự đóng/thu nhỏ trả cửa sổ về trạng thái ban đầu), gửi tin nhắn tiếng Việt có dấu hoặc gửi file. "
        "Zalo Desktop automation: read_chat_messages, send_message, open_chat, focus_zalo."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["read_chat_messages", "send_message", "open_chat", "focus_zalo"],
                "description": (
                    "read_chat_messages: mở khung chat người nhận, tự cuộn lên chụp đủ N tin nhắn rồi tự trả cửa sổ về trạng thái ban đầu; "
                    "send_message / open_chat / focus_zalo."
                ),
            },
            "recipient": {
                "type": "string",
                "description": "Tên hiển thị hoặc số điện thoại người nhận / nhóm chat trên Zalo (ví dụ: 'Anh Thư').",
            },
            "count": {
                "type": "integer",
                "description": "Số lượng tin nhắn cần đọc (cho read_chat_messages, mặc định: 10).",
            },
            "message": {
                "type": "string",
                "description": "Nội dung tin nhắn tiếng Việt cần gửi khi action='send_message'.",
            },
            "file_path": {
                "type": "string",
                "description": "Đường dẫn tuyệt đối tới ảnh/file muốn gửi kèm (tùy chọn).",
            },
            "draft_only": {
                "type": "boolean",
                "description": "Mặc định False (LUÔN nhấn Enter gửi tin nhắn ngay). CHỈ đặt True nếu người dùng yêu cầu rõ 'chỉ soạn nháp, đừng gửi'.",
            },
        },
        "required": ["action"],
    },
}


def _find_zalo_executable() -> str | None:
    candidates = [
        Path(os.environ.get("APPDATA", "")) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Zalo.lnk",
        Path(os.environ.get("APPDATA", "")) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Zalo" / "Zalo.lnk",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Zalo" / "Zalo.exe",
        Path.home() / "Desktop" / "Zalo.lnk",
    ]
    for c in candidates:
        try:
            if c.exists():
                return str(c)
        except OSError:
            continue
    return None


def _get_zalo_window():
    import pygetwindow as gw  # type: ignore

    for w in gw.getAllWindows():
        title = (w.title or "").strip()
        if title and (title.lower() == "zalo" or title.lower().startswith("zalo")):
            return w
    return None


def focus_zalo(launch_if_missing: bool = True, wait_sec: float = 8.0) -> dict[str, Any]:
    try:
        import pygetwindow as gw  # noqa: F401
    except ImportError:
        return {"ok": False, "error": "Missing package pygetwindow (pip install pygetwindow)"}

    win = _get_zalo_window()
    launched = False
    if win is None and launch_if_missing:
        exe = _find_zalo_executable()
        if not exe:
            return {"ok": False, "error": "Không tìm thấy ứng dụng Zalo Desktop trên Windows."}
        os.startfile(exe)
        launched = True
        deadline = time.monotonic() + wait_sec
        while time.monotonic() < deadline:
            time.sleep(0.5)
            win = _get_zalo_window()
            if win is not None:
                break

    if win is None:
        return {"ok": False, "error": "Đã mở Zalo nhưng chưa thấy cửa sổ Zalo hiện lên (hãy kiểm tra khay hệ thống)."}

    try:
        if getattr(win, "isMinimized", False):
            win.restore()
            time.sleep(0.3)
        win.activate()
        time.sleep(0.4)
    except Exception:
        # Fallback: click center of window to guarantee keyboard focus
        try:
            import pyautogui  # type: ignore

            cx = int(win.left + max(100, win.width // 2))
            cy = int(win.top + min(40, max(15, win.height // 10)))
            pyautogui.click(cx, cy)
            time.sleep(0.3)
        except Exception:
            pass

    return {"ok": True, "title": win.title, "launched": launched}


def _paste_text(text: str) -> None:
    import pyautogui  # type: ignore
    import pyperclip  # type: ignore

    pyperclip.copy(text)
    time.sleep(0.12)
    pyautogui.hotkey("ctrl", "v")
    time.sleep(0.25)


def _copy_file_to_clipboard(file_path: str) -> tuple[bool, str]:
    safe_path = str(Path(file_path).resolve()).replace("'", "''")
    proc = subprocess.run(
        ["powershell", "-NoProfile", "-Command", f"Set-Clipboard -Path '{safe_path}'"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=10,
    )
    if proc.returncode != 0:
        return False, (proc.stderr or proc.stdout or "Set-Clipboard failed").strip()
    return True, ""


def open_chat(recipient: str) -> dict[str, Any]:
    target = (recipient or "").strip()
    if not target:
        return {"ok": False, "error": "Thiếu tên người nhận (recipient)."}
    try:
        import pyautogui  # type: ignore
        import pyperclip  # noqa: F401
    except ImportError as exc:
        return {"ok": False, "error": f"Thiếu thư viện GUI: {exc}. Chạy: pip install pyautogui pyperclip"}

    foc = focus_zalo(launch_if_missing=True)
    if not foc.get("ok"):
        return foc

    # Ctrl+F opens Zalo PC search bar
    pyautogui.hotkey("ctrl", "f")
    time.sleep(0.35)
    pyautogui.hotkey("ctrl", "a")
    time.sleep(0.1)
    _paste_text(target)
    time.sleep(1.1)
    pyautogui.press("enter")
    time.sleep(0.55)
    return {"ok": True, "recipient": target, "action": "opened_chat"}


def send_message(
    recipient: str,
    message: str = "",
    file_path: str = "",
    draft_only: bool = False,
) -> dict[str, Any]:
    target = (recipient or "").strip()
    msg = (message or "").strip()
    fpath = (file_path or "").strip()
    if not target:
        return {"ok": False, "error": "Thiếu tên người nhận (recipient)."}
    if not msg and not fpath:
        return {"ok": False, "error": "Cần cung cấp nội dung tin nhắn (message) hoặc file_path."}
    if fpath and not Path(fpath).is_file():
        return {"ok": False, "error": f"Không tìm thấy tệp đính kèm: {fpath}"}

    try:
        import pyautogui  # type: ignore
    except ImportError:
        return {"ok": False, "error": "Thiếu thư viện pyautogui (pip install pyautogui)"}

    opened = open_chat(target)
    if not opened.get("ok"):
        return opened

    should_send = not bool(draft_only)
    sent_parts: list[str] = []
    if msg:
        _paste_text(msg)
        if should_send:
            pyautogui.press("enter")
            time.sleep(0.35)
        sent_parts.append("text")

    if fpath:
        ok_clip, err_clip = _copy_file_to_clipboard(fpath)
        if not ok_clip:
            return {"ok": False, "error": f"Không thể copy file vào clipboard: {err_clip}"}
        time.sleep(0.25)
        pyautogui.hotkey("ctrl", "v")
        time.sleep(0.9)
        if should_send:
            pyautogui.press("enter")
            time.sleep(0.4)
        sent_parts.append("file")

    return {
        "ok": True,
        "recipient": target,
        "message": msg,
        "file_path": fpath,
        "sent_immediately": should_send,
        "sent": sent_parts,
    }


def _snapshot_window_state():
    """Capture currently active window + whether Zalo was minimized/absent so we can restore after automation."""
    try:
        import pygetwindow as gw  # type: ignore

        prev_active = gw.getActiveWindow()
    except Exception:
        prev_active = None
    zwin = None
    try:
        zwin = _get_zalo_window()
    except Exception:
        zwin = None
    was_minimized = bool(getattr(zwin, "isMinimized", False)) if zwin is not None else True
    return prev_active, was_minimized


def _restore_window_state(prev_active, was_minimized: bool) -> None:
    """Restore Zalo Desktop back to minimized (if it was hidden/minimized) and return focus to previous window."""
    try:
        zwin = _get_zalo_window()
        if zwin is not None and was_minimized:
            zwin.minimize()
        if prev_active is not None and (zwin is None or prev_active != zwin):
            prev_active.activate()
    except Exception:
        pass


def read_chat_messages(recipient: str, count: int = 10, output_dir: str = "outputs") -> dict[str, Any]:
    """Open Zalo Desktop chat with `recipient`, capture latest + scrolled-up older messages into 1 crisp PNG for Vision, and ALWAYS restore window state."""
    target = (recipient or "").strip()
    if not target:
        return {"ok": False, "error": "Thiếu tên người nhận (recipient)."}

    try:
        import mss  # type: ignore
        import pyautogui  # type: ignore
        from PIL import Image  # type: ignore
    except ImportError as exc:
        return {"ok": False, "error": f"Thiếu thư viện chụp/đọc Zalo Desktop: {exc}"}

    os.makedirs(output_dir, exist_ok=True)
    prev_active, was_minimized = _snapshot_window_state()
    out_path = str(Path(output_dir).resolve() / "zalo_chat_read.png")

    try:
        opened = open_chat(target)
        if not opened.get("ok"):
            return opened

        zwin = _get_zalo_window()
        if zwin is None:
            return {"ok": False, "error": "Không tìm thấy cửa sổ Zalo Desktop sau khi mở chat."}

        left = max(0, int(zwin.left))
        top = max(0, int(zwin.top))
        width = max(500, int(zwin.width))
        height = max(400, int(zwin.height))

        # Focus capture on the right-hand chat pane (skip left 30% sidebar & bottom input box)
        pane_left = left + int(width * 0.28)
        pane_top = top + 55
        pane_w = max(320, width - int(width * 0.28) - 10)
        pane_h = max(280, height - 125)
        region = {"left": pane_left, "top": pane_top, "width": pane_w, "height": pane_h}

        with mss.mss() as sct:
            raw_latest = sct.grab(region)
            img_latest = Image.frombytes("RGB", raw_latest.size, raw_latest.bgra, "raw", "BGRX")

            frames = [img_latest]
            need_scrolls = 1 if int(count or 10) > 6 else 0
            if int(count or 10) > 14:
                need_scrolls = 2

            if need_scrolls > 0:
                cx = pane_left + pane_w // 2
                cy = pane_top + pane_h // 2
                pyautogui.moveTo(cx, cy)
                for _ in range(need_scrolls):
                    pyautogui.scroll(750)
                    time.sleep(0.4)
                    raw_older = sct.grab(region)
                    img_older = Image.frombytes("RGB", raw_older.size, raw_older.bgra, "raw", "BGRX")
                    frames.insert(0, img_older)
                # Scroll back down so Zalo stays at latest message
                for _ in range(need_scrolls):
                    pyautogui.scroll(-750)
                    time.sleep(0.15)

        # Stitch frames vertically (top = older, bottom = newest)
        total_h = sum(f.height for f in frames)
        combined = Image.new("RGB", (pane_w, total_h))
        y_off = 0
        for f in frames:
            combined.paste(f, (0, y_off))
            y_off += f.height
        if combined.width > 1100:
            ratio = 1100 / float(combined.width)
            combined = combined.resize((1100, int(combined.height * ratio)))
        combined.save(out_path, format="PNG")

        return {
            "ok": True,
            "recipient": target,
            "requested_count": int(count or 10),
            "frames_captured": len(frames),
            "restored_previous_state": True,
            "screenshot_path": out_path,
            "message": (
                f"Da mo khung chat '{target}' tren Zalo Desktop, chup {len(frames)} trang man hinh "
                "(phan tren la tin cu hon, phan duoi la tin moi nhat) va DA TU DONG THU NHO / TRA LAI CUA SO CU. "
                f"Hay nhin truc tiep anh dinh kem de liet ke du {int(count or 10)} tin nhan gan nhat (loai bo trung lap o ranh gioi cuon)."
            ),
        }
    finally:
        _restore_window_state(prev_active, was_minimized)


def execute(action: str = "send_message", **kwargs: Any) -> dict[str, Any]:
    act = (action or "send_message").strip().lower()
    try:
        if act == "read_chat_messages":
            return read_chat_messages(
                recipient=kwargs.get("recipient", ""),
                count=int(kwargs.get("count") or 10),
            )
        if act == "focus_zalo":
            return focus_zalo()
        if act == "open_chat":
            return open_chat(recipient=kwargs.get("recipient", ""))
        if act == "send_message":
            prev_active, was_minimized = _snapshot_window_state()
            try:
                return send_message(
                    recipient=kwargs.get("recipient", ""),
                    message=kwargs.get("message", ""),
                    file_path=kwargs.get("file_path", ""),
                    draft_only=bool(kwargs.get("draft_only", False)),
                )
            finally:
                _restore_window_state(prev_active, was_minimized)
        return {"ok": False, "error": f"Unknown action: {action}"}
    except Exception as exc:
        return {"ok": False, "error": f"{type(exc).__name__}: {exc}"}
