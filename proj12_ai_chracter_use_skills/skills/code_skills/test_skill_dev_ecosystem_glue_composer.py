import pytest
import skill_dev_ecosystem_glue_composer as mod
from pathlib import Path
import json  # Thêm import module json

def test_tool_schema_actions():
    actions = mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert actions == ["validate_pipeline_spec", "generate_glue_runner_py", "generate_glue_config_json"]

def test_unknown_action():
    result = mod.execute("unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_validate_pipeline_spec(tmp_path):
    steps = [{"command": "echo 'Hello, World!'"}]
    result = mod.execute("validate_pipeline_spec", steps=steps)
    assert result == {"ok": True}

def test_generate_glue_runner_py(tmp_path, monkeypatch):
    def mock_run_cmd(cmd, cwd=None):
        return "Mocked command execution\n"
    
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    output_path = tmp_path / "run_glue.py"
    result = mod.execute("generate_glue_runner_py", app_name="test_app", steps=[{"command": "echo 'Hello, World!'"}], output_path=str(output_path), dry_run=False)
    assert result == {"ok": True, "message": f"Script generated at {output_path}"}
    assert output_path.exists()

def test_generate_glue_config_json(tmp_path):
    steps = [{"command": "echo 'Hello, World!'"}]
    result = mod.execute("generate_glue_config_json", app_name="test_app", steps=steps)
    assert result["ok"] == True
    config_json = json.loads(result["config"])
    assert config_json == {"app_name": "test_app", "steps": steps}
