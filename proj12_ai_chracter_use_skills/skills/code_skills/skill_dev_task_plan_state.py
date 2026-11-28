import json
import os
from pathlib import Path

TOOL_SCHEMA = {
    "name": "skill_dev_task_plan_state",
    "description": "Quản lý kế hoạch lập trình nhiều bước plan state JSON cho coding agent, cập nhật trạng thái từng bước và ghi nhận lỗi đã thử sửa chống lặp vô hạn. Manage multi-step coding implementation plans, update step status (`todo`/`doing`/`done`/`failed`), record fix attempts per error signature, and check whether retry budget is exhausted.",
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["init_coding_plan", "update_plan_step", "record_debug_attempt", "get_plan_summary"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: list[str], cwd: str=None):
    # Placeholder for running shell commands
    pass

def _http_get(url: str, timeout: float=3.0):
    # Placeholder for HTTP GET requests
    pass

def _load_plan(plan_path: str) -> dict:
    plan_path = Path(plan_path)
    if plan_path.exists():
        with plan_path.open('r') as f:
            return json.load(f)
    return {"steps": [], "debug_attempts": {}}

def _save_plan(plan: dict, plan_path: str):
    plan_path = Path(plan_path)
    with plan_path.open('w') as f:
        json.dump(plan, f, indent=4)

def execute(action: str, **kwargs) -> dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}

    plan_path = kwargs.get('plan_path', 'coding_plan.json')
    plan = _load_plan(plan_path)

    if action == "init_coding_plan":
        goal = kwargs.get('goal')
        steps = kwargs.get('steps', [])
        if not goal or not steps:
            return {"ok": False, "error": "Goal and steps are required for init_coding_plan"}
        plan = {"goal": goal, "steps": [{"id": i, "status": "todo", "note": ""} for i, step in enumerate(steps)], "debug_attempts": {}}
        _save_plan(plan, plan_path)
        return {"ok": True, "message": "Coding plan initialized"}

    elif action == "update_plan_step":
        step_id = kwargs.get('step_id')
        status = kwargs.get('status')
        note = kwargs.get('note', '')
        if step_id is None or status not in ["todo", "doing", "done", "failed"]:
            return {"ok": False, "error": "Invalid step_id or status"}
        for step in plan["steps"]:
            if step["id"] == step_id:
                step["status"] = status
                step["note"] = note
                break
        else:
            return {"ok": False, "error": "Step not found"}
        _save_plan(plan, plan_path)
        return {"ok": True, "message": "Plan step updated"}

    elif action == "record_debug_attempt":
        error_sig = kwargs.get('error_sig')
        fix_summary = kwargs.get('fix_summary')
        resolved = kwargs.get('resolved', False)
        max_retries = kwargs.get('max_retries', 3)
        if not error_sig or not fix_summary:
            return {"ok": False, "error": "error_sig and fix_summary are required for record_debug_attempt"}
        if error_sig not in plan["debug_attempts"]:
            plan["debug_attempts"][error_sig] = {"attempts": [], "resolved": resolved}
        plan["debug_attempts"][error_sig]["attempts"].append({"fix_summary": fix_summary, "timestamp": os.path.getmtime(plan_path)})
        plan["debug_attempts"][error_sig]["resolved"] = resolved
        _save_plan(plan, plan_path)
        should_escalate = len(plan["debug_attempts"][error_sig]["attempts"]) >= max_retries and not resolved
        return {"ok": True, "message": "Debug attempt recorded", "should_escalate": should_escalate}

    elif action == "get_plan_summary":
        summary = {
            "goal": plan.get("goal", ""),
            "steps": [{"id": step["id"], "status": step["status"]} for step in plan["steps"]],
            "debug_attempts": {error_sig: {"attempts": len(attempts["attempts"]), "resolved": attempts["resolved"]} for error_sig, attempts in plan["debug_attempts"].items()}
        }
        return {"ok": True, "summary": summary}

    return {"ok": False, "error": "Action not implemented"}
