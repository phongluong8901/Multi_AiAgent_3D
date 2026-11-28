import skill_dev_realtime_ws_hub_builder as mod
import pytest
import ast

def test_tool_schema():
    schema = mod.TOOL_SCHEMA
    assert schema["name"] == "skill_dev_realtime_ws_hub_builder"
    assert schema["risk_level"] == "confirm"
    assert set(schema["parameters"]["properties"]["action"]["enum"]) == {"generate_ws_hub_py", "generate_ws_worker_py", "scaffold_hub_worker_pair"}

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_generate_ws_hub_py(tmp_path, monkeypatch):
    def mock_run_cmd(cmd, cwd=None):
        return "mocked_output"
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.execute(action="generate_ws_hub_py", port=8765, auth_env_key='MOCK_API_KEY', dry_run=True)
    assert result["ok"] is True
    code = result["code"]
    assert "HUB_API_KEY = os.getenv('MOCK_API_KEY', 'default_api_key')" in code
    assert "asyncio.get_event_loop().run_until_complete(start_server)" in code
    ast.parse(code)  # Ensure the generated code is syntactically correct

def test_generate_ws_worker_py(tmp_path, monkeypatch):
    def mock_run_cmd(cmd, cwd=None):
        return "mocked_output"
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.execute(action="generate_ws_worker_py", hub_url='ws://mock.url:8765/ws', node_id='mock-worker', dry_run=True)
    assert result["ok"] is True
    code = result["code"]
    assert "HUB_URL = 'ws://mock.url:8765/ws'" in code
    assert "NODE_ID = 'mock-worker'" in code
    ast.parse(code)  # Ensure the generated code is syntactically correct

def test_scaffold_hub_worker_pair(tmp_path, monkeypatch):
    def mock_run_cmd(cmd, cwd=None):
        return "mocked_output"
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.execute(action="scaffold_hub_worker_pair", project_dir=str(tmp_path), hub_url='ws://mock.url:8765/ws', dry_run=False)
    assert result["ok"] is True
    hub_code = result["result"]["hub_code"]
    worker_code = result["result"]["worker_code"]
    assert "HUB_API_KEY = os.getenv('HUB_API_KEY', 'default_api_key')" in hub_code
    assert "HUB_URL = 'ws://mock.url:8765/ws'" in worker_code
    ast.parse(hub_code)  # Ensure the generated code is syntactically correct
    ast.parse(worker_code)  # Ensure the generated code is syntactically correct
    assert (tmp_path / 'ws_hub.py').exists()
    assert (tmp_path / 'ws_worker.py').exists()
