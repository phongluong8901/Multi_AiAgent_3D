import time
import math
import os

try:
    import pyautogui
except ImportError:
    pyautogui = None


class MouseControllerClient:
    """Client for controlling computer mouse to perform geometric movements and clicks safely and efficiently."""

    def __init__(self, output_dir: str = "outputs"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        if pyautogui is None:
            raise RuntimeError("Missing package pyautogui. Please install it via pip install pyautogui.")
        
        # Safety fail-safe: moving mouse to any corner aborts pyautogui operations
        pyautogui.FAILSAFE = True

    def get_screen_size(self) -> dict:
        """Get the current screen width and height in pixels."""
        width, height = pyautogui.size()
        return {"width": width, "height": height}

    def get_current_position(self) -> dict:
        """Get the current mouse cursor X and Y coordinates."""
        x, y = pyautogui.position()
        return {"x": x, "y": y}

    def click_at(self, x: int, y: int, button: str = "left", clicks: int = 1, interval: float = 0.0) -> dict:
        """Click at a specific screen coordinate (x, y)."""
        if button not in ["left", "right", "middle"]:
            raise ValueError("Button must be one of 'left', 'right', 'middle'.")
        pyautogui.click(x=x, y=y, clicks=clicks, interval=interval, button=button)
        return {"status": "success", "message": f"Clicked at ({x}, {y}) with {button} button {clicks} time(s)."}

    def move_to(self, x: int, y: int, duration: float = 0.5) -> dict:
        """Move the mouse cursor smoothly to a specific coordinate (x, y) over a duration."""
        pyautogui.moveTo(x, y, duration=duration)
        return {"status": "success", "message": f"Moved mouse to ({x}, {y})."}

    def draw_circle(
        self,
        center_x: int = 0,
        center_y: int = 0,
        radius: int = 120,
        duration: float = 0.8,
        steps: int = 36,
        loops: int = 1,
    ) -> dict:
        """Move the mouse in a circle (hinh tron) around (center_x, center_y) for `loops` rotations. Defaults to screen center if <= 0."""
        if steps < 4:
            raise ValueError("Steps must be at least 4 to form a circular path.")
        loops = max(1, min(int(loops or 1), 50))
        if center_x <= 0 or center_y <= 0:
            screen_w, screen_h = pyautogui.size()
            center_x = screen_w // 2
            center_y = screen_h // 2

        # Note: pyautogui ignores duration < MINIMUM_DURATION (0.1s) and teleports instantly,
        # so we pace each step explicitly with time.sleep(step_delay) for smooth visible motion.
        step_delay = max(0.005, float(duration) / steps) if float(duration) > 0 else 0.0
        prev_pause = getattr(pyautogui, "PAUSE", 0.1)
        pyautogui.PAUSE = 0.0
        try:
            first_x = center_x + int(radius * math.cos(0.0))
            first_y = center_y + int(radius * math.sin(0.0))
            pyautogui.moveTo(first_x, first_y, duration=0.15)

            for _ in range(loops):
                for i in range(1, steps + 1):
                    angle = (2 * math.pi * i) / steps
                    x = center_x + int(radius * math.cos(angle))
                    y = center_y + int(radius * math.sin(angle))
                    pyautogui.moveTo(x, y)
                    if step_delay > 0:
                        time.sleep(step_delay)
        finally:
            pyautogui.PAUSE = prev_pause

        return {
            "status": "success",
            "loops": loops,
            "center": [center_x, center_y],
            "radius": radius,
            "duration_per_loop_sec": duration,
            "message": f"Drew {loops} circle(s) at center ({center_x}, {center_y}) with radius {radius}px.",
        }

    def draw_zigzag(
        self,
        start_x: int = 0,
        start_y: int = 0,
        width: int = 240,
        height: int = 120,
        num_waves: int = 5,
        duration: float = 1.5,
    ) -> dict:
        """Move the mouse in a zigzag pattern starting from (start_x, start_y). Defaults near screen center if <= 0."""
        if num_waves < 1:
            raise ValueError("Number of waves must be at least 1.")
        if start_x <= 0 or start_y <= 0:
            screen_w, screen_h = pyautogui.size()
            start_x = max(50, screen_w // 2 - width // 2)
            start_y = max(50, screen_h // 2 - height // 2)

        total_points = num_waves * 2
        dx = width / total_points
        step_delay = max(0.02, float(duration) / max(1, total_points)) if float(duration) > 0 else 0.0
        prev_pause = getattr(pyautogui, "PAUSE", 0.1)
        pyautogui.PAUSE = 0.0
        try:
            pyautogui.moveTo(start_x, start_y, duration=0.15)
            current_x = float(start_x)
            for i in range(1, total_points + 1):
                current_x += dx
                current_y = float(start_y + height) if (i % 2 == 1) else float(start_y)
                pyautogui.moveTo(int(current_x), int(current_y), duration=max(0.1, step_delay))
        finally:
            pyautogui.PAUSE = prev_pause

        return {"status": "success", "message": f"Drew a zigzag pattern starting from ({start_x}, {start_y})."}
