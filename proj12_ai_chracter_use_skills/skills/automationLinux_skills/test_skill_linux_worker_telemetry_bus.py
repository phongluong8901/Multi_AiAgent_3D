import pytest
import skill_linux_worker_telemetry_bus as mod
from pathlib import Path
import json  # Thêm dòng import json

def test_tool_schema():
    assert mod.TOOL_SCHEMA["name"] == "skill_linux_worker_telemetry_bus"
    assert "description" in mod.TOOL_SCHEMA
    assert mod.TOOL_SCHEMA["risk_level"] == "safe"
    assert "parameters" in mod.TOOL_SCHEMA

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action"}

def test_build_heartbeat_payload(tmp_path):
    node_id = "test_node"
    metrics = {"cpu": 50, "memory": 75}
    capabilities = ["cpu_monitor", "memory_monitor"]
    result = mod.execute(action="build_heartbeat_payload", node_id=node_id, metrics=metrics, capabilities=capabilities)
    assert result["ok"]
    payload = result["payload"]
    assert payload["node_id"] == node_id
    assert payload["metrics"] == metrics
    assert payload["capabilities"] == capabilities

def test_validate_task_request():
    task = {"task_id": "123", "skill": "cpu_monitor", "params": {}}
    allowed_skills = ["cpu_monitor", "memory_monitor"]
    result = mod.execute(action="validate_task_request", task=task, allowed_skills=allowed_skills)
    assert result["ok"]

def test_record_task_result(tmp_path):
    history_path = tmp_path / "worker_history.json"
    task_id = "456"
    ok = True
    output = "Task completed successfully"
    mod.execute(action="record_task_result", task_id=task_id, ok=ok, output=output, history_path=str(history_path))
    with open(history_path, 'r') as f:
        history = json.load(f)
    assert len(history) == 1
    record = history[0]
    assert record["task_id"] == task_id
    assert record["ok"] == ok
    assert record["output"] == output
