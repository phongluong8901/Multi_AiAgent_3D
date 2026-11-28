"""Screen Capture & 0-1000 Coordinate Grid Annotator for Gemini Vision GUI control."""
import os
from typing import Any

TOOL_SCHEMA: dict[str, Any] = {
    "name": "skill_screen_capture_annotator",
    "description": (
        "Chụp ảnh màn hình Windows (screenshot), tự thu gọn và vẽ lưới tọa độ chuẩn hóa 0-1000 "
        "để Gemini Vision nhìn chính xác vị trí nút bấm/ô chat trên Zalo PC, Antigravity, app desktop; "
        "chuyển đổi tọa độ chuẩn hóa (0-1000) sang pixel thật để click chuột. "
        "Screen capture with optional 0-1000 coordinate grid overlay and normalized-to-pixel converter."
    ),
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["capture_app_window", "capture_screen", "normalized_to_pixel"],
                "description": (
                    "capture_app_window: chụp riêng bất kỳ cửa sổ ứng dụng Windows nào (Zalo, Telegram, Slack, Discord, Excel, VS Code...), "
                    "hỗ trợ tự cuộn ghép nhiều trang (scroll_steps) gửi Gemini Vision và TỰ ĐỘNG trả cửa sổ về trạng thái ban đầu; "
                    "capture_screen: chụp toàn màn hình kèm lưới 0-1000; normalized_to_pixel."
                ),
            },
            "app_title": {
                "type": "string",
                "description": "Tên hoặc một phần tiêu đề cửa sổ ứng dụng cần chụp (cho capture_app_window, vd: 'Zalo', 'Telegram', 'Discord', 'Excel').",
            },
            "scroll_steps": {
                "type": "integer",
                "description": "Số lần cuộn thêm để chụp ghép nhiều trang nội dung (0 = chỉ chụp 1 khung hiện tại, 1-3 = cuộn ghép ảnh).",
            },
            "scroll_direction": {
                "type": "string",
                "enum": ["up", "down"],
                "description": "Hướng cuộn khi scroll_steps > 0 ('up' để đọc tin nhắn cũ hơn trong chat, 'down' để đọc danh sách/tài liệu dài).",
            },
            "restore_window": {
                "type": "boolean",
                "description": "Mặc định True: tự động thu nhỏ app về trạng thái ban đầu và trả focus về cửa sổ người dùng đang làm việc.",
            },
            "save_path": {"type": "string", "description": "Đường dẫn lưu ảnh PNG (mặc định: outputs/app_vision_capture.png)."},
            "monitor": {"type": "integer", "description": "Chỉ số màn hình (1 = màn chính, 0 = tất cả màn)."},
            "draw_grid": {"type": "boolean", "description": "Vẽ lưới tọa độ 0-1000 lên ảnh (mặc định: True)."},
            "norm_x": {"type": "number", "description": "Tọa độ X chuẩn hóa (0..1000)."},
            "norm_y": {"type": "number", "description": "Tọa độ Y chuẩn hóa (0..1000)."},
            "width": {"type": "integer", "description": "Chiều rộng màn hình pixel (mặc định: 1920)."},
            "height": {"type": "integer", "description": "Chiều cao màn hình pixel (mặc định: 1080)."},
        },
        "required": ["action"],
    },
}


def normalized_to_pixel(norm_x: float, norm_y: float, width: int = 1920, height: int = 1080) -> dict[str, Any]:
    nx = max(0.0, min(1000.0, float(norm_x)))
    ny = max(0.0, min(1000.0, float(norm_y)))
    w = max(1, int(width))
    h = max(1, int(height))
    px = int(round((nx / 1000.0) * w))
    py = int(round((ny / 1000.0) * h))
    return {"ok": True, "x": min(w - 1, px), "y": min(h - 1, py), "width": w, "height": h}


def capture_screen(save_path: str = "screen.png", monitor: int = 1, draw_grid: bool = True) -> dict[str, Any]:
    try:
        import mss  # type: ignore
        from PIL import Image, ImageDraw  # type: ignore
    except ImportError as e:
        return {"ok": False, "error": f"Missing package: {e}. Run: pip install mss pillow"}

    out_path = os.path.abspath(save_path or "screen.png")
    parent = os.path.dirname(out_path)
    if parent:
        os.makedirs(parent, exist_ok=True)

    with mss.mss() as sct:
        mon_idx = int(monitor) if 0 <= int(monitor) < len(sct.monitors) else 1
        mon = sct.monitors[mon_idx]
        raw = sct.grab(mon)
        img = Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")

    orig_w, orig_h = img.size
    if draw_grid:
        draw = ImageDraw.Draw(img)
        for step in range(100, 1000, 100):
            x = int(orig_w * step / 1000)
            y = int(orig_h * step / 1000)
            draw.line([(x, 0), (x, orig_h)], fill=(255, 60, 60), width=1)
            draw.line([(0, y), (orig_w, y)], fill=(255, 60, 60), width=1)
            draw.text((x + 3, 4), str(step), fill=(255, 40, 40))
            draw.text((4, y + 3), str(step), fill=(255, 40, 40))

    img.save(out_path, format="PNG", optimize=True)
    return {
        "ok": True,
        "path": out_path,
        "width": orig_w,
        "height": orig_h,
        "grid_scale": 1000 if draw_grid else 0,
    }


def capture_app_window(
    app_title: str,
    scroll_steps: int = 0,
    scroll_direction: str = "down",
    draw_grid: bool = False,
    restore_window: bool = True,
    save_path: str = "outputs/app_vision_capture.png",
) -> dict[str, Any]:
    """Universal Desktop App Vision Reader: focus ANY Windows app, capture (with optional multi-page scroll stitching),
    return screenshot_path for Gemini Vision, and ALWAYS restore original window state & focus."""
    import time as _time

    query = (app_title or "").strip()
    if not query:
        return {"ok": False, "error": "Thiếu tên cửa sổ ứng dụng (app_title)."}

    try:
        import mss  # type: ignore
        import pygetwindow as gw  # type: ignore
        from PIL import Image, ImageDraw  # type: ignore
    except ImportError as exc:
        return {"ok": False, "error": f"Missing package: {exc}"}

    target_win = None
    q_low = query.lower()
    for w in gw.getAllWindows():
        t = (w.title or "").strip()
        if t and q_low in t.lower():
            target_win = w
            break
    if target_win is None:
        return {"ok": False, "error": f"Không tìm thấy cửa sổ ứng dụng nào chứa '{query}'."}

    prev_active = None
    try:
        prev_active = gw.getActiveWindow()
    except Exception:
        prev_active = None

    was_minimized = bool(getattr(target_win, "isMinimized", False))
    out_path = os.path.abspath(save_path or "outputs/app_vision_capture.png")
    parent = os.path.dirname(out_path)
    if parent:
        os.makedirs(parent, exist_ok=True)

    steps = max(0, min(int(scroll_steps or 0), 3))
    scroll_val = 700 if (scroll_direction or "down").strip().lower() == "up" else -700

    try:
        if was_minimized:
            target_win.restore()
            _time.sleep(0.4)
        target_win.activate()
        _time.sleep(0.35)

        left = max(0, int(target_win.left))
        top = max(0, int(target_win.top))
        width = max(320, int(target_win.width))
        height = max(280, int(target_win.height))
        region = {"left": left, "top": top, "width": width, "height": height}

        with mss.mss() as sct:
            raw0 = sct.grab(region)
            img0 = Image.frombytes("RGB", raw0.size, raw0.bgra, "raw", "BGRX")
            frames = [img0]

            if steps > 0:
                try:
                    import pyautogui  # type: ignore

                    pyautogui.moveTo(left + width // 2, top + height // 2)
                    for _ in range(steps):
                        pyautogui.scroll(scroll_val)
                        _time.sleep(0.35)
                        raw_next = sct.grab(region)
                        img_next = Image.frombytes("RGB", raw_next.size, raw_next.bgra, "raw", "BGRX")
                        if scroll_val > 0:
                            frames.insert(0, img_next)
                        else:
                            frames.append(img_next)
                    for _ in range(steps):
                        pyautogui.scroll(-scroll_val)
                        _time.sleep(0.1)
                except Exception:
                    pass

        total_h = sum(f.height for f in frames)
        combined = Image.new("RGB", (width, total_h))
        y_off = 0
        for f in frames:
            combined.paste(f, (0, y_off))
            y_off += f.height

        if draw_grid and len(frames) == 1:
            draw = ImageDraw.Draw(combined)
            for s in range(100, 1000, 100):
                gx = int(width * s / 1000)
                gy = int(total_h * s / 1000)
                draw.line([(gx, 0), (gx, total_h)], fill=(255, 60, 60), width=1)
                draw.line([(0, gy), (width, gy)], fill=(255, 60, 60), width=1)
                draw.text((gx + 3, 4), str(s), fill=(255, 40, 40))
                draw.text((4, gy + 3), str(s), fill=(255, 40, 40))

        if combined.width > 1300:
            ratio = 1300 / float(combined.width)
            combined = combined.resize((1300, int(combined.height * ratio)))
        combined.save(out_path, format="PNG", optimize=True)

        return {
            "ok": True,
            "app_title": target_win.title,
            "screenshot_path": out_path,
            "path": out_path,
            "frames_captured": len(frames),
            "restored_previous_state": bool(restore_window),
            "message": (
                f"Da chup cua so '{target_win.title}' ({len(frames)} trang) va tu dong tra lai trang thai cua so ban dau. "
                "Hay nhin truc tiep anh dinh kem de doc du lieu chinh xac."
            ),
        }
    finally:
        if restore_window:
            try:
                if was_minimized:
                    target_win.minimize()
                if prev_active is not None and prev_active != target_win:
                    prev_active.activate()
            except Exception:
                pass


def execute(action: str = "capture_screen", **kwargs: Any) -> dict[str, Any]:
    act = (action or "capture_screen").strip().lower()
    try:
        if act == "capture_app_window":
            return capture_app_window(
                app_title=kwargs.get("app_title") or kwargs.get("title_query") or "",
                scroll_steps=int(kwargs.get("scroll_steps") or 0),
                scroll_direction=kwargs.get("scroll_direction", "down"),
                draw_grid=bool(kwargs.get("draw_grid", False)),
                restore_window=bool(kwargs.get("restore_window", True)),
                save_path=kwargs.get("save_path", "outputs/app_vision_capture.png"),
            )
        if act == "capture_screen":
            return capture_screen(
                save_path=kwargs.get("save_path", "outputs/screen.png"),
                monitor=kwargs.get("monitor", 1),
                draw_grid=kwargs.get("draw_grid", True),
            )
        if act == "normalized_to_pixel":
            return normalized_to_pixel(
                norm_x=kwargs.get("norm_x", 500),
                norm_y=kwargs.get("norm_y", 500),
                width=kwargs.get("width", 1920),
                height=kwargs.get("height", 1080),
            )
        return {"ok": False, "error": f"Unknown action: {action}"}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
