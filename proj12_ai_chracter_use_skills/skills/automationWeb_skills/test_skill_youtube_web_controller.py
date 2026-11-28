import pytest
import skill_youtube_web_controller as mod

def test_tool_schema():
    assert mod.TOOL_SCHEMA['name'] == 'skill_youtube_web_controller'
    assert 'description' in mod.TOOL_SCHEMA
    assert mod.TOOL_SCHEMA['risk_level'] == 'safe'
    assert 'parameters' in mod.TOOL_SCHEMA

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action"}

def test_parse_youtube_url():
    result = mod.execute(action="parse_youtube_url", url="https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    assert result == {"ok": True, "video_id": "dQw4w9WgXcQ"}

def test_build_timestamp_url(tmp_path):
    result = mod.execute(action="build_timestamp_url", url="https://www.youtube.com/watch?v=dQw4w9WgXcQ", seconds=123)
    assert result == {"ok": True, "timestamp_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=0h2m3s"}

def test_control_playback(monkeypatch):
    def mock_send_cdp_command(*args, **kwargs):
        return {"ok": True, "result": "Command executed"}

    monkeypatch.setattr(mod, "_send_cdp_command", mock_send_cdp_command)
    result = mod.execute(action="control_playback", command="play", value=1.0, cdp_url="http://localhost:9222", dry_run=False)
    assert result == {"ok": True, "result": "Command executed"}
