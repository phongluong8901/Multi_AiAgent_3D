import skill_linux_systemd_manager as mod
import pytest
from unittest.mock import MagicMock
from pathlib import Path

def test_tool_schema():
    assert mod.TOOL_SCHEMA["name"] == "skill_linux_systemd_manager"
    assert "description" in mod.TOOL_SCHEMA
    assert mod.TOOL_SCHEMA["risk_level"] == "confirm"
    assert "parameters" in mod.TOOL_SCHEMA

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action"}

def test_get_service_status(monkeypatch):
    mock_run_cmd = MagicMock(return_value=(0, "active (running)", ""))
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.execute(action="get_service_status", service_name="test_service")
    assert result == {"ok": True, "status": "active (running)"}

def test_list_failed_units(monkeypatch):
    mock_run_cmd = MagicMock(return_value=(0, "  test_service.service loaded failed failed Test Service\n", ""))
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.execute(action="list_failed_units")
    assert result == {"ok": True, "failed_units": "  test_service.service loaded failed failed Test Service\n"}

def test_generate_unit_file(tmp_path):
    result = mod.execute(action="generate_unit_file", name="test_service", exec_start="/usr/bin/test_service")
    assert result["ok"] is True
    unit_file_path = Path(result["path"])
    assert unit_file_path.exists()
    assert "ExecStart=/usr/bin/test_service" in unit_file_path.read_text()
