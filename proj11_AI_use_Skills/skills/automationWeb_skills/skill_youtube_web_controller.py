import re
import json
import requests

TOOL_SCHEMA = {
    "name": "skill_youtube_web_controller",
    "description": "Điều khiển tab YouTube đang mở trên Chrome, phát tạm dừng video YouTube, đổi tốc độ phát 1.5x 2x, tua thời gian, tách ID video và tạo link timestamp YouTube. Control YouTube tabs on Chrome, play/pause videos, change playback speed (1.5x, 2x), seek time, extract video IDs, and generate timestamped share links.",
    "risk_level": "safe",
    "parameters": {
        "action": "parse_youtube_url, build_timestamp_url, control_playback",
        "url": "YouTube URL",
        "seconds": "Timestamp in seconds",
        "command": "play, pause, toggle, seek, playbackRate",
        "value": "Value for command (e.g., 10 for seek, 1.5 for playbackRate)",
        "cdp_url": "Chrome DevTools Protocol URL",
        "dry_run": "Boolean to simulate actions"
    }
}

def execute(action: str = "parse_youtube_url", **kwargs) -> dict:
    try:
        if action == "parse_youtube_url":
            return parse_youtube_url(kwargs.get("url", ""))
        elif action == "build_timestamp_url":
            return build_timestamp_url(kwargs.get("url", ""), kwargs.get("seconds", 0))
        elif action == "control_playback":
            return control_playback(
                kwargs.get("command", "toggle"),
                kwargs.get("value", 1.0),
                kwargs.get("cdp_url", "http://localhost:9222"),
                kwargs.get("dry_run", True)
            )
        else:
            return {"ok": False, "error": "Unknown action"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def parse_youtube_url(url: str) -> dict:
    video_id = _extract_video_id(url)
    if video_id:
        return {"ok": True, "video_id": video_id}
    return {"ok": False, "error": "Invalid YouTube URL"}

def build_timestamp_url(url: str, seconds: int = 0) -> dict:
    video_id = _extract_video_id(url)
    if video_id:
        timestamp = _seconds_to_timestamp(seconds)
        return {"ok": True, "timestamp_url": f"https://www.youtube.com/watch?v={video_id}&t={timestamp}"}
    return {"ok": False, "error": "Invalid YouTube URL"}

def control_playback(command: str = "toggle", value: float = 1.0, cdp_url: str = "http://localhost:9222", dry_run: bool = True) -> dict:
    script = _build_playback_script(command, value)
    if dry_run:
        return {"ok": True, "script": script}
    try:
        response = _send_cdp_command(cdp_url, script)
        if response.get("result"):
            return {"ok": True, "result": response["result"]}
        return {"ok": False, "error": "Failed to execute CDP command"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def _extract_video_id(url: str) -> str:
    match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11}).*", url)
    return match.group(1) if match else ""

def _seconds_to_timestamp(seconds: int) -> str:
    hours, remainder = divmod(seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{int(hours)}h{int(minutes)}m{int(seconds)}s"

def _build_playback_script(command: str, value: float) -> str:
    if command == "play":
        return "document.querySelector('video').play();"
    elif command == "pause":
        return "document.querySelector('video').pause();"
    elif command == "toggle":
        return "var video = document.querySelector('video'); video[video.paused ? 'play' : 'pause']();"
    elif command == "seek":
        return f"document.querySelector('video').currentTime = {value};"
    elif command == "playbackRate":
        return f"document.querySelector('video').playbackRate = {value};"
    return ""

def _send_cdp_command(cdp_url: str, script: str) -> dict:
    try:
        response = requests.post(f"{cdp_url}/session/1/execute", json={"script": script, "args": []})
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        return {"ok": False, "error": str(e)}
