import pytest
import skill_linux_incident_report_builder as mod
from unittest.mock import MagicMock

def test_tool_schema():
    assert mod.TOOL_SCHEMA["name"] == "skill_linux_incident_report_builder"
    assert "description" in mod.TOOL_SCHEMA
    assert mod.TOOL_SCHEMA["risk_level"] == "safe"
    assert "parameters" in mod.TOOL_SCHEMA
    assert "action" in mod.TOOL_SCHEMA["parameters"]["properties"]
    assert "enum" in mod.TOOL_SCHEMA["parameters"]["properties"]["action"]

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_score_system_health():
    metrics = {"cpu_usage": 20, "ram_usage": 30, "disk_usage": 10, "temp": 5}
    result = mod.execute(action="score_system_health", metrics=metrics)
    assert result["ok"]
    assert 0 <= result["score"] <= 100

def test_build_markdown_report(tmp_path):
    hostname = "test-host"
    metrics = {"cpu_usage": 20, "ram_usage": 30, "disk_usage": 10, "temp": 5}
    failed_units = ["service1", "service2"]
    recent_errors = ["error1", "error2"]
    result = mod.execute(action="build_markdown_report", hostname=hostname, metrics=metrics, failed_units=failed_units, recent_errors=recent_errors)
    assert result["ok"]
    assert "test-host" in result["report"]
    assert "service1" in result["report"]
    assert "error1" in result["report"]

def test_save_report(tmp_path, monkeypatch):
    report_text = "# Test Report\nThis is a test report."
    output_dir = tmp_path / "test_reports"
    prefix = "test_incident"
    monkeypatch.setattr(mod, "_run_cmd", MagicMock(return_value=(0, "", "")))
    result = mod.execute(action="save_report", report_text=report_text, output_dir=str(output_dir), prefix=prefix, dry_run=False)
    assert result["ok"]
    assert output_dir.exists()
    assert (output_dir / result["file_path"]).exists()
