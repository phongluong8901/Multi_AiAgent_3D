import pytest
from unittest.mock import MagicMock
from skill_media_desktop_control import execute, TOOL_SCHEMA

def test_tool_schema():
    assert isinstance(TOOL_SCHEMA, dict)
    assert TOOL_SCHEMA["name"] == "skill_media_desktop_control"
    assert TOOL_SCHEMA["risk_level"] == "safe"
    assert "parameters" in TOOL_SCHEMA

def test_unknown_action():
    result = execute(action="unknown")
    assert result == {"ok": False, "error": "Unknown action"}

def test_media_key_dry_run(monkeypatch):
    monkeypatch.setattr("skill_media_desktop_control._run_cmd", MagicMock(return_value={"ok": True}))
    result = execute(action="playpause", dry_run=True)
    assert result == {"ok": True, "message": "Dry run: Media key playpause"}

def test_switch_virtual_desktop_dry_run(monkeypatch):
    monkeypatch.setattr("skill_media_desktop_control._run_cmd", MagicMock(return_value={"ok": True}))
    result = execute(action="switch_virtual_desktop", direction="right", dry_run=True)
    assert result == {"ok": True, "message": "Dry run: Switch virtual desktop right"}

def test_get_theme_mode(monkeypatch):
    monkeypatch.setattr("skill_media_desktop_control._run_cmd", MagicMock(return_value="1"))
    result = execute(action="get_theme_mode")
    assert result == {"ok": True, "theme_mode": "light"}

def test_set_dark_mode_dry_run(monkeypatch):
    monkeypatch.setattr("skill_media_desktop_control._run_cmd", MagicMock(return_value={"ok": True}))
    result = execute(action="set_dark_mode", enabled=True, dry_run=True)
    assert result == {"ok": True, "message": "Dry run: Set dark mode True"}
