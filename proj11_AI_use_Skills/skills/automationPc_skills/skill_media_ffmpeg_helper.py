import os
import json
import subprocess

TOOL_SCHEMA = {
    "name": "skill_media_ffmpeg_helper",
    "risk_level": "confirm",
    "description": "Check ffmpeg availability and build/run safe ffmpeg commands for video compression, trimming, and MP3 audio extraction (dry_run supported). Cắt ghép nén video FFmpeg, tách nhạc MP3 từ video, đổi định dạng video âm thanh",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["check_ffmpeg", "build_extract_audio_cmd", "build_trim_video_cmd", "build_compress_cmd"]
            },
            "input_path": {
                "type": "string"
            },
            "output_mp3": {
                "type": "string"
            },
            "start": {
                "type": "string"
            },
            "duration": {
                "type": "string"
            },
            "output_path": {
                "type": "string"
            },
            "crf": {
                "type": "integer",
                "default": 28
            },
            "dry_run": {
                "type": "boolean",
                "default": True
            }
        },
        "required": ["action"]
    }
}

def execute(action: str = "check_ffmpeg", **kwargs) -> dict:
    try:
        if action == "check_ffmpeg":
            return check_ffmpeg()
        elif action == "build_extract_audio_cmd":
            return build_extract_audio_cmd(kwargs.get("input_path"), kwargs.get("output_mp3"), kwargs.get("dry_run", True))
        elif action == "build_trim_video_cmd":
            return build_trim_video_cmd(kwargs.get("input_path"), kwargs.get("start"), kwargs.get("duration"), kwargs.get("output_path"), kwargs.get("dry_run", True))
        elif action == "build_compress_cmd":
            return build_compress_cmd(kwargs.get("input_path"), kwargs.get("output_path"), kwargs.get("crf", 28), kwargs.get("dry_run", True))
        else:
            return {"ok": False, "error": f"Unknown action: {action}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def check_ffmpeg() -> dict:
    try:
        import shutil
    except ImportError:
        return {"ok": False, "error": "Missing package shutil"}
    
    ffmpeg_path = shutil.which("ffmpeg")
    if ffmpeg_path:
        return {"ok": True, "ffmpeg_path": ffmpeg_path}
    else:
        return {"ok": False, "error": "FFmpeg is not installed or not in PATH"}

def build_extract_audio_cmd(input_path: str, output_mp3: str, dry_run: bool = True) -> dict:
    if not input_path or not output_mp3:
        return {"ok": False, "error": "input_path and output_mp3 are required"}
    
    cmd = ["ffmpeg", "-i", input_path, "-q:a", "0", "-map", "a", output_mp3]
    if dry_run:
        return {"ok": True, "command": cmd}
    else:
        try:
            subprocess.run(cmd, check=True)
            return {"ok": True, "message": "Audio extracted successfully"}
        except subprocess.CalledProcessError as e:
            return {"ok": False, "error": str(e)}

def build_trim_video_cmd(input_path: str, start: str, duration: str, output_path: str, dry_run: bool = True) -> dict:
    if not input_path or not start or not duration or not output_path:
        return {"ok": False, "error": "input_path, start, duration, and output_path are required"}
    
    cmd = ["ffmpeg", "-i", input_path, "-ss", start, "-t", duration, "-c", "copy", output_path]
    if dry_run:
        return {"ok": True, "command": cmd}
    else:
        try:
            subprocess.run(cmd, check=True)
            return {"ok": True, "message": "Video trimmed successfully"}
        except subprocess.CalledProcessError as e:
            return {"ok": False, "error": str(e)}

def build_compress_cmd(input_path: str, output_path: str, crf: int = 28, dry_run: bool = True) -> dict:
    if not input_path or not output_path:
        return {"ok": False, "error": "input_path and output_path are required"}
    
    cmd = ["ffmpeg", "-i", input_path, "-c:v", "libx264", "-crf", str(crf), "-c:a", "aac", output_path]
    if dry_run:
        return {"ok": True, "command": cmd}
    else:
        try:
            subprocess.run(cmd, check=True)
            return {"ok": True, "message": "Video compressed successfully"}
        except subprocess.CalledProcessError as e:
            return {"ok": False, "error": str(e)}
