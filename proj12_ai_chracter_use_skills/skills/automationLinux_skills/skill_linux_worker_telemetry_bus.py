import json
import os
import time
import uuid

TOOL_SCHEMA = {   'name': 'skill_linux_worker_telemetry_bus',
    'description': 'Giao thức worker giám sát Linux từ xa heartbeat telemetry JSON, kiểm duyệt '
                   'whitelist lệnh thực thi an toàn, lưu lịch sử kết quả task. Remote Linux worker '
                   'protocol helper: build structured heartbeat/telemetry JSON envelopes, validate '
                   'incoming task payloads against an allowed skill/action whitelist (rejecting '
                   'unauthorized tasks), and persist bounded task execution history to JSON.',
    'risk_level': 'safe',
    'parameters': {   'type': 'object',
                      'properties': {   'action': {   'enum': [   'build_heartbeat_payload',
                                                                  'validate_task_request',
                                                                  'record_task_result'],
                                                      'type': 'string'},
                                        'node_id': {'type': 'string'},
                                        'metrics': {'type': 'object'},
                                        'capabilities': {   'type': 'array',
                                                            'items': {'type': 'string'}},
                                        'task': {'type': 'object'},
                                        'allowed_skills': {   'type': 'array',
                                                              'items': {'type': 'string'}},
                                        'task_id': {'type': 'string'},
                                        'ok': {'type': 'boolean'},
                                        'output': {'type': 'string'},
                                        'history_path': {'type': 'string'},
                                        'max_records': {'type': 'integer'}},
                      'required': ['action']}}

def build_heartbeat_payload(node_id: str, metrics: dict, capabilities: list[str] = None) -> dict:
    return {
        "node_id": node_id,
        "timestamp": time.time(),
        "metrics": metrics,
        "capabilities": capabilities or []
    }

def validate_task_request(task: dict, allowed_skills: list[str] = None) -> bool:
    allowed_skills = allowed_skills or []
    required_fields = {"task_id", "skill", "params"}
    if not required_fields.issubset(task.keys()):
        return False
    return task["skill"] in allowed_skills

def record_task_result(task_id: str, ok: bool, output: str = '', history_path: str = 'worker_history.json', max_records: int = 100) -> None:
    try:
        with open(history_path, 'r', encoding='utf-8') as f:
            history = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        history = []

    history.append({
        "task_id": task_id,
        "timestamp": time.time(),
        "ok": ok,
        "output": output
    })

    if len(history) > max_records:
        history = history[-max_records:]

    os.makedirs(os.path.dirname(os.path.abspath(history_path)), exist_ok=True)
    with open(history_path, 'w', encoding='utf-8') as f:
        json.dump(history, f, indent=4)

def execute(action: str = "build_heartbeat_payload", **kwargs) -> dict:
    if action == "build_heartbeat_payload":
        node_id = kwargs.get("node_id", str(uuid.uuid4()))
        metrics = kwargs.get("metrics", {})
        capabilities = kwargs.get("capabilities", [])
        return {"ok": True, "payload": build_heartbeat_payload(node_id, metrics, capabilities)}
    elif action == "validate_task_request":
        task = kwargs.get("task", {})
        allowed_skills = kwargs.get("allowed_skills", [])
        is_valid = validate_task_request(task, allowed_skills)
        return {"ok": is_valid}
    elif action == "record_task_result":
        task_id = kwargs.get("task_id", str(uuid.uuid4()))
        ok = kwargs.get("ok", False)
        output = kwargs.get("output", "")
        history_path = kwargs.get("history_path", "worker_history.json")
        max_records = kwargs.get("max_records", 100)
        record_task_result(task_id, ok, output, history_path, max_records)
        return {"ok": True}
    else:
        return {"ok": False, "error": "Unknown action"}
