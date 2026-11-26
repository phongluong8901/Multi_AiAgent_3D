import pytest
import sys
import types
from unittest.mock import MagicMock
from skill_hotkey_macro_recorder import execute, TOOL_SCHEMA

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_hotkey_macro_recorder"
    assert TOOL_SCHEMA["risk_level"] == "confirm"
    assert "description" in TOOL_SCHEMA
    assert "parameters" in TOOL_SCHEMA

def test_validate_macro():
    steps = [
        {"action": "wait", "params": {"seconds": 1}},
        {"action": "hotkey", "params": {"keys": ["ctrl", "c"]}},
        {"action": "click", "params": {"x": 100, "y": 200}},
        {"action": "type_unicode", "params": {"text": "Hello, World!"}}
    ]
    assert execute("validate_macro", steps=steps) == {"ok": True}

def test_validate_macro_invalid_action():
    steps = [
        {"action": "invalid_action", "params": {}}
    ]
    assert execute("validate_macro", steps=steps) == {"ok": False, "error": "Invalid action: invalid_action"}

def test_save_macro(monkeypatch):
    mock_open = MagicMock()
    monkeypatch.setitem(sys.modules, "json", types.SimpleNamespace(dump=lambda *args, **kwargs: None))
    monkeypatch.setattr("builtins.open", mock_open)
    result = execute("save_macro", name="test_macro", steps=[{"action": "wait", "params": {"seconds": 1}}])
    assert result["ok"] is True
    mock_open.assert_called_once()

def test_save_macro_no_name():
    result = execute("save_macro", steps=[{"action": "wait", "params": {"seconds": 1}}])
    assert result["ok"] is False
    assert "Macro name is required" in result["error"]

def test_run_macro_dry_run():
    steps = [
        {"action": "wait", "params": {"seconds": 1}},
        {"action": "hotkey", "params": {"keys": ["ctrl", "c"]}},
        {"action": "click", "params": {"x": 100, "y": 200}},
        {"action": "type_unicode", "params": {"text": "Hello, World!"}}
    ]
    result = execute("run_macro", steps=steps, dry_run=True)
    assert result["ok"] is True
    assert len(result["preview"]) == 4

def test_run_macro(monkeypatch):
    mock_pyautogui = MagicMock()
    monkeypatch.setitem(sys.modules, "pyautogui", mock_pyautogui)
    mock_time = MagicMock()
    monkeypatch.setitem(sys.modules, "time", mock_time)
    steps = [
        {"action": "wait", "params": {"seconds": 1}},
        {"action": "hotkey", "params": {"keys": ["ctrl", "c"]}},
        {"action": "click", "params": {"x": 100, "y": 200}},
        {"action": "type_unicode", "params": {"text": "Hello, World!"}}
    ]
    result = execute("run_macro", steps=steps, dry_run=False)
    assert result["ok"] is True
    mock_time.sleep.assert_called_once_with(1)
    mock_pyautogui.hotkey.assert_called_once_with("ctrl", "c")
    mock_pyautogui.click.assert_called_once_with(100, 200)
    mock_pyautogui.write.assert_called_once_with("Hello, World!", interval=0.01)

def test_unknown_action():
    result = execute("unknown_action")
    assert result["ok"] is False
    assert "Unknown action: unknown_action" in result["error"]
