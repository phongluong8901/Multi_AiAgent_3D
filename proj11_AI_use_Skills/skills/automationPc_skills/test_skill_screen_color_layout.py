import pytest
from unittest.mock import patch, MagicMock
from skill_screen_color_layout import execute, TOOL_SCHEMA

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_screen_color_layout"
    assert TOOL_SCHEMA["risk_level"] == "safe"
    assert "description" in TOOL_SCHEMA
    assert "parameters" in TOOL_SCHEMA
    assert "action" in TOOL_SCHEMA["parameters"]["properties"]
    assert "enum" in TOOL_SCHEMA["parameters"]["properties"]["action"]
    assert "list_monitors" in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert "get_cursor_position" in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert "rgb_to_hex" in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]

def test_execute_list_monitors():
    with patch('skill_screen_color_layout.list_monitors') as mock_list_monitors:
        mock_list_monitors.return_value = {"ok": True, "preview": [1, 2, 3]}
        result = execute("list_monitors")
        assert result["ok"] is True
        assert result["preview"] == [1, 2, 3]

def test_execute_get_cursor_position():
    with patch('skill_screen_color_layout.get_cursor_position') as mock_get_cursor_position:
        mock_get_cursor_position.return_value = {"ok": True, "preview": {"x": 100, "y": 200}}
        result = execute("get_cursor_position")
        assert result["ok"] is True
        assert result["preview"] == {"x": 100, "y": 200}

def test_execute_rgb_to_hex():
    result = execute("rgb_to_hex", r=255, g=0, b=0)
    assert result["ok"] is True
    assert result["preview"] == "#ff0000"

def test_execute_unknown_action():
    result = execute("unknown_action")
    assert result["ok"] is False
    assert "Unknown action" in result["error"]

def test_execute_missing_rgb_parameters():
    result = execute("rgb_to_hex")
    assert result["ok"] is False
    assert "Missing RGB parameters" in result["error"]

def test_execute_missing_package_mss():
    with patch.dict('sys.modules', {'mss': None}):
        result = execute("list_monitors")
        assert result["ok"] is False
        assert "Missing package mss" in result["error"]

def test_execute_missing_package_pyautogui():
    with patch.dict('sys.modules', {'pyautogui': None}):
        result = execute("get_cursor_position")
        assert result["ok"] is False
        assert "Missing package pyautogui" in result["error"]
