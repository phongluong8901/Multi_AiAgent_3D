import skill_dev_local_scheduler_builder as mod
import pytest
from pathlib import Path

def test_tool_schema_actions():
    actions = mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert actions == ["validate_schedule_spec", "generate_scheduler_script", "generate_os_autostart"]

def test_unknown_action():
    result = mod.execute("unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_validate_schedule_spec(tmp_path):
    jobs = [
        {"name": "job1", "interval": 3600, "command": "echo 'Hello World'"},
        {"name": "job2", "interval": 7200, "command": "echo 'Goodbye World'"}
    ]
    result = mod.execute("validate_schedule_spec", jobs=jobs)
    assert result == {"ok": True, "valid": True}

def test_generate_scheduler_script(tmp_path, monkeypatch):
    output_path = tmp_path / "scheduler_app.py"
    jobs = [
        {"name": "job1", "interval": 3600, "command": "echo 'Hello World'"},
        {"name": "job2", "interval": 7200, "command": "echo 'Goodbye World'"}
    ]
    mod.execute("generate_scheduler_script", jobs=jobs, output_path=str(output_path), dry_run=False)
    assert output_path.exists()
    with open(output_path, 'r') as f:
        content = f.read()
        assert "Hello World" in content
        assert "Goodbye World" in content

def test_generate_os_autostart():
    result = mod.execute("generate_os_autostart", app_cmd="echo 'Hello World'", target_os="windows", name="TestTool")
    assert "schtasks /create /tn \"TestTool\" /tr \"echo 'Hello World'\" /sc minute /mo 1" in result["command"]
    result = mod.execute("generate_os_autostart", app_cmd="echo 'Hello World'", target_os="linux", name="TestTool")
    assert "Description=TestTool" in result["command"]
    assert "ExecStart=echo 'Hello World'" in result["command"]
