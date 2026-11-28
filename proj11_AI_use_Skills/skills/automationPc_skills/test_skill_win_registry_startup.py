import pytest
from unittest.mock import patch, MagicMock
from skill_win_registry_startup import execute, TOOL_SCHEMA
import sys
import os

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_win_registry_startup"
    assert TOOL_SCHEMA["risk_level"] == "confirm"
    assert "action" in TOOL_SCHEMA["parameters"]["required"]
    assert "list_startup_apps" in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]

def test_execute_invalid_action():
    result = execute("invalid_action")
    assert result == {"ok": False, "error": "Invalid action"}

def test_execute_list_startup_apps_missing_winreg():
    with patch.dict(sys.modules, {"winreg": None}):
        result = execute("list_startup_apps")
        assert result == {"ok": False, "error": "Missing package winreg"}

def test_execute_list_startup_apps():
    mock_winreg = MagicMock()
    mock_winreg.OpenKey.return_value = MagicMock()
    mock_winreg.EnumValue.side_effect = [
        ("App1", "C:\\Path\\App1.exe", 1),
        ("App2", "C:\\Path\\App2.exe", 1),
        OSError()
    ]
    with patch.dict(sys.modules, {"winreg": mock_winreg}):
        result = execute("list_startup_apps")
        assert result == {
            "ok": True,
            "startup_apps": [
                {"name": "App1", "path": "C:\\Path\\App1.exe"},
                {"name": "App2", "path": "C:\\Path\\App2.exe"}
            ]
        }

def test_execute_get_env_vars():
    with patch.dict(os.environ, {"VAR1": "value1", "VAR2": "value2"}):
        result = execute("get_env_vars", prefix="VAR")
        assert result == {"ok": True, "env_vars": {"VAR1": "value1", "VAR2": "value2"}}

def test_execute_format_startup_report():
    entries = [
        {"name": "App1", "path": "C:\\Path\\App1.exe"},
        {"name": "App2", "path": "C:\\Path\\App2.exe"}
    ]
    result = execute("format_startup_report", entries=entries)
    assert result == {
        "ok": True,
        "report": "App1: C:\\Path\\App1.exe\nApp2: C:\\Path\\App2.exe"
    }
