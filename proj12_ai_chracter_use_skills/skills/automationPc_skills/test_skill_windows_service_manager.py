import pytest
import sys
import types
from unittest.mock import MagicMock
from skill_windows_service_manager import TOOL_SCHEMA, execute

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_windows_service_manager"
    assert TOOL_SCHEMA["risk_level"] == "confirm"
    assert "description" in TOOL_SCHEMA
    assert "parameters" in TOOL_SCHEMA
    assert "action" in TOOL_SCHEMA["parameters"]["properties"]
    assert "enum" in TOOL_SCHEMA["parameters"]["properties"]["action"]
    assert "list_services" in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert "get_service_status" in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert "control_service" in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]

def test_execute_unknown_action():
    result = execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_execute_list_services(monkeypatch):
    mock_output = '[{"Name": "wuauserv", "Status": "Running", "DisplayName": "Windows Update"}, {"Name": "bits", "Status": "Stopped", "DisplayName": "Background Intelligent Transfer Service"}]'
    mock_run_cmd = MagicMock(return_value=mock_output)
    monkeypatch.setattr("skill_windows_service_manager._run_cmd", mock_run_cmd)
    
    result = execute(action="list_services")
    assert result["ok"] is True
    assert len(result["services"]) == 2
    assert result["services"][0]["Name"] == "wuauserv"
    assert result["services"][1]["Status"] == "Stopped"

def test_execute_get_service_status(monkeypatch):
    mock_output = '{"Status": "Running"}'
    mock_run_cmd = MagicMock(return_value=mock_output)
    monkeypatch.setattr("skill_windows_service_manager._run_cmd", mock_run_cmd)
    
    result = execute(action="get_service_status", name="wuauserv")
    assert result["ok"] is True
    assert result["status"] == "Running"

def test_execute_control_service_dry_run(monkeypatch):
    mock_run_cmd = MagicMock(return_value="")
    monkeypatch.setattr("skill_windows_service_manager._run_cmd", mock_run_cmd)
    
    result = execute(action="control_service", name="wuauserv", operation="restart", dry_run=True)
    assert result["ok"] is True
    assert result["preview"] == "Would restart service wuauserv"

def test_execute_control_service(monkeypatch):
    mock_run_cmd = MagicMock(return_value="")
    monkeypatch.setattr("skill_windows_service_manager._run_cmd", mock_run_cmd)
    
    result = execute(action="control_service", name="wuauserv", operation="restart", dry_run=False)
    assert result["ok"] is True
    assert result["message"] == "Service wuauserv restarted successfully"

def test_execute_control_service_not_found(monkeypatch):
    mock_run_cmd = MagicMock(return_value="Cannot find any service with service name 'nonexistent'.")
    monkeypatch.setattr("skill_windows_service_manager._run_cmd", mock_run_cmd)
    
    result = execute(action="control_service", name="nonexistent", operation="restart", dry_run=False)
    assert result["ok"] is False
    assert result["error"] == "Service nonexistent not found"
