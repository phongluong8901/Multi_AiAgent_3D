import skill_dev_webhook_bot_builder as mod
import pytest
import json

def test_tool_schema_actions():
    actions = mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert actions == ["parse_bot_command", "validate_command_routes", "generate_webhook_bot_py"]

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_parse_bot_command(tmp_path):
    result = mod.execute(action="parse_bot_command", text="/status arg1 key1=val1 key2=val2")
    assert result == {
        "ok": True,
        "result": {
            "command": "/status",
            "args": ["arg1"],
            "kwargs": {"key1": "val1", "key2": "val2"}
        }
    }

def test_validate_command_routes(tmp_path):
    routes = {"/status": "status_skill", "/price": "price_skill"}
    result = mod.execute(action="validate_command_routes", routes=routes)
    assert result == {"ok": True, "result": True}

def test_generate_webhook_bot_py(tmp_path, monkeypatch):
    routes = {"/status": "status_skill", "/price": "price_skill"}
    output_path = tmp_path / "bot_runner.py"
    
    def mock_run_cmd(cmd, cwd=None):
        return ""
    
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    
    result = mod.execute(action="generate_webhook_bot_py", routes=routes, output_path=str(output_path))
    assert result == {"ok": True, "result": True}
    assert output_path.exists()
    with open(output_path, 'r') as f:
        content = f.read()
        assert "Webhook bot for telegram is running..." in content
