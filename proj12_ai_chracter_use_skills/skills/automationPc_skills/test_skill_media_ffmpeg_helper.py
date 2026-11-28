import pytest
from unittest.mock import patch, MagicMock
from skill_media_ffmpeg_helper import execute, TOOL_SCHEMA

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_media_ffmpeg_helper"
    assert TOOL_SCHEMA["risk_level"] == "confirm"
    assert "description" in TOOL_SCHEMA
    assert "parameters" in TOOL_SCHEMA

def test_check_ffmpeg():
    with patch("skill_media_ffmpeg_helper.check_ffmpeg") as mock_check_ffmpeg:
        mock_check_ffmpeg.return_value = {"ok": True, "ffmpeg_path": "/usr/bin/ffmpeg"}
        result = execute("check_ffmpeg")
        assert result["ok"] is True
        assert result["ffmpeg_path"] == "/usr/bin/ffmpeg"

        mock_check_ffmpeg.return_value = {"ok": False, "error": "FFmpeg is not installed or not in PATH"}
        result = execute("check_ffmpeg")
        assert result["ok"] is False
        assert "FFmpeg is not installed or not in PATH" in result["error"]

def test_build_extract_audio_cmd():
    result = execute("build_extract_audio_cmd", input_path="input.mp4", output_mp3="output.mp3", dry_run=True)
    assert result["ok"] is True
    assert result["command"] == ["ffmpeg", "-i", "input.mp4", "-q:a", "0", "-map", "a", "output.mp3"]

    with patch("skill_media_ffmpeg_helper.subprocess.run", return_value=MagicMock()):
        result = execute("build_extract_audio_cmd", input_path="input.mp4", output_mp3="output.mp3", dry_run=False)
        assert result["ok"] is True
        assert result["message"] == "Audio extracted successfully"

def test_build_trim_video_cmd():
    result = execute("build_trim_video_cmd", input_path="input.mp4", start="00:00:10", duration="00:00:20", output_path="output.mp4", dry_run=True)
    assert result["ok"] is True
    assert result["command"] == ["ffmpeg", "-i", "input.mp4", "-ss", "00:00:10", "-t", "00:00:20", "-c", "copy", "output.mp4"]

    with patch("skill_media_ffmpeg_helper.subprocess.run", return_value=MagicMock()):
        result = execute("build_trim_video_cmd", input_path="input.mp4", start="00:00:10", duration="00:00:20", output_path="output.mp4", dry_run=False)
        assert result["ok"] is True
        assert result["message"] == "Video trimmed successfully"

def test_build_compress_cmd():
    result = execute("build_compress_cmd", input_path="input.mp4", output_path="output.mp4", crf=28, dry_run=True)
    assert result["ok"] is True
    assert result["command"] == ["ffmpeg", "-i", "input.mp4", "-c:v", "libx264", "-crf", "28", "-c:a", "aac", "output.mp4"]

    with patch("skill_media_ffmpeg_helper.subprocess.run", return_value=MagicMock()):
        result = execute("build_compress_cmd", input_path="input.mp4", output_path="output.mp4", crf=28, dry_run=False)
        assert result["ok"] is True
        assert result["message"] == "Video compressed successfully"

def test_unknown_action():
    result = execute("unknown_action")
    assert result["ok"] is False
    assert "Unknown action: unknown_action" in result["error"]
