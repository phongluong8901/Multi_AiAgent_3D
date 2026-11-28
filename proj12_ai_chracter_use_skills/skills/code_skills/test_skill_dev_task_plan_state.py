import skill_dev_task_plan_state as mod
import pytest
from pathlib import Path
import json  # Added import for json

def test_tool_schema_actions():
    actions = mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert set(actions) == {"init_coding_plan", "update_plan_step", "record_debug_attempt", "get_plan_summary"}

def test_unknown_action():
    result = mod.execute("unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_init_coding_plan(tmp_path):
    plan_path = tmp_path / 'coding_plan.json'
    result = mod.execute("init_coding_plan", goal="Implement feature X", steps=["Step 1", "Step 2"], plan_path=plan_path)
    assert result == {"ok": True, "message": "Coding plan initialized"}
    with plan_path.open('r') as f:
        plan = json.load(f)
    assert plan["goal"] == "Implement feature X"
    assert len(plan["steps"]) == 2
    assert plan["steps"][0]["status"] == "todo"

def test_update_plan_step(tmp_path):
    plan_path = tmp_path / 'coding_plan.json'
    mod.execute("init_coding_plan", goal="Implement feature X", steps=["Step 1", "Step 2"], plan_path=plan_path)
    result = mod.execute("update_plan_step", step_id=0, status="doing", note="Started implementation", plan_path=plan_path)
    assert result == {"ok": True, "message": "Plan step updated"}
    with plan_path.open('r') as f:
        plan = json.load(f)
    assert plan["steps"][0]["status"] == "doing"
    assert plan["steps"][0]["note"] == "Started implementation"

def test_record_debug_attempt(tmp_path):
    plan_path = tmp_path / 'coding_plan.json'
    mod.execute("init_coding_plan", goal="Implement feature X", steps=["Step 1", "Step 2"], plan_path=plan_path)
    result = mod.execute("record_debug_attempt", error_sig="Error1", fix_summary="Fix 1", plan_path=plan_path)
    assert result == {"ok": True, "message": "Debug attempt recorded", "should_escalate": False}
    with plan_path.open('r') as f:
        plan = json.load(f)
    assert len(plan["debug_attempts"]["Error1"]["attempts"]) == 1
    assert plan["debug_attempts"]["Error1"]["resolved"] == False

    # Test max retries
    for _ in range(2):
        mod.execute("record_debug_attempt", error_sig="Error1", fix_summary=f"Fix {_+2}", plan_path=plan_path)
    result = mod.execute("record_debug_attempt", error_sig="Error1", fix_summary="Fix 4", plan_path=plan_path)
    assert result == {"ok": True, "message": "Debug attempt recorded", "should_escalate": True}
