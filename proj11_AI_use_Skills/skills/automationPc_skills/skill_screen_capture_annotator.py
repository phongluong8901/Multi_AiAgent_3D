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
                "enum": ["capture_screen", "normalized_to_pixel"],
                "description": "Thao tác cần chạy (mặc định: capture_screen).",
            },
            "save_path": {"type": "string", "description": "Đường dẫn lưu ảnh PNG (mặc định: screen.png)."},
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


def execute(action: str = "capture_screen", **kwargs: Any) -> dict[str, Any]:
    act = (action or "capture_screen").strip().lower()
    try:
        if act == "capture_screen":
            return capture_screen(
                save_path=kwargs.get("save_path", "screen.png"),
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
