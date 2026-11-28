import pytest
import skill_linux_service_self_healer as mod
from unittest.mock import MagicMock

def test_tool_schema():
    assert mod.TOOL_SCHEMA["name"] == "skill_linux_service_self_healer"
    assert "description" in mod.TOOL_SCHEMA
    assert mod.TOOL_SCHEMA["risk_level"] == "confirm"
    assert "parameters" in mod.TOOL_SCHEMA
    assert "action" in mod.TOOL_SCHEMA["parameters"]["properties"]
    assert mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"] == ["evaluate_remediation", "plan_recovery_steps", "execute_recovery"]

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_evaluate_remediation(tmp_path):
    metrics = {"cpu_usage": 90, "disk_usage": 85}
    failed_units = ["nginx", "apache2"]
    result = mod.evaluate_remediation(metrics, failed_units)
    assert result["ok"]
    assert result["metrics"] == metrics
    assert result["failed_units"] == failed_units

def test_plan_recovery_steps(tmp_path):
    state_path = tmp_path / "healer_state.json"
    result = mod.plan_recovery_steps("disk_full", "/dev/sda1", max_retries=3, state_path=str(state_path))
    assert result["ok"]
    assert not result["tripped"]
    assert result["allowed"]
    assert result["steps"] == []

    # Test retry limit
    for _ in range(3):
        result = mod.plan_recovery_steps("disk_full", "/dev/sda1", max_retries=3, state_path=str(state_path))
    assert result["ok"]
    assert result["tripped"]
    assert not result["allowed"]

def test_execute_recovery(monkeypatch):
    mock_run_cmd = MagicMock(return_value=(0, "Command executed", ""))
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    
    commands = ["echo Hello", "echo World"]
    result = mod.execute_recovery(commands, dry_run=False)
    assert result["ok"]
    assert len(result["results"]) == 2
    assert mock_run_cmd.call_count == 2

    # Test dry run
    result = mod.execute_recovery(commands, dry_run=True)
    assert result["ok"]
    assert len(result["results"]) == 2
    assert mock_run_cmd.call_count == 2  # No additional calls for dry run
