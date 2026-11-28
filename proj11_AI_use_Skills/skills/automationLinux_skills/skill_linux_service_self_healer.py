import inspect
import os
import json
import subprocess
from pathlib import Path
from typing import List, Dict, Tuple

def _safe_call(fn, kwargs: dict):
    sig = inspect.signature(fn)
    if any(p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kwargs)
    filtered = {k: v for k, v in kwargs.items() if k in sig.parameters}
    return fn(**filtered)

TOOL_SCHEMA = {   'name': 'skill_linux_service_self_healer',
    'description': 'Tự động khôi phục sự cố Linux self-healer watchdog, tự restart service lỗi '
                   'systemd, dọn đĩa đầy có giới hạn số lần thử lại circuit breaker. Automatically '
                   'heal Linux issues, restart failing systemd services, and clean full disks with '
                   'retry limits.',
    'risk_level': 'confirm',
    'parameters': {   'type': 'object',
                      'properties': {   'action': {   'enum': [   'evaluate_remediation',
                                                                  'plan_recovery_steps',
                                                                  'execute_recovery'],
                                                      'type': 'string'},
                                        'metrics': {'type': 'object'},
                                        'failed_units': {   'type': 'array',
                                                            'items': {'type': 'string'}},
                                        'incident_type': {'type': 'string'},
                                        'target': {'type': 'string'},
                                        'max_retries': {'type': 'integer'},
                                        'state_path': {'type': 'string'},
                                        'commands': {'type': 'array', 'items': {'type': 'string'}},
                                        'dry_run': {'type': 'boolean'}},
                      'required': ['action']}}

def _run_cmd(cmd: List[str]) -> Tuple[int, str, str]:
    """Helper function to run shell commands."""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', check=False)
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return 1, "", str(e)

def _load_state(state_path: str) -> Dict:
    """Helper function to load state from JSON file."""
    state_file = Path(state_path)
    if state_file.exists():
        with state_file.open('r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def _save_state(state_path: str, state: Dict):
    """Helper function to save state to JSON file."""
    p = Path(state_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open('w', encoding='utf-8') as f:
        json.dump(state, f, indent=4)

def evaluate_remediation(metrics: Dict = None, failed_units: List[str] = None) -> Dict:
    """Evaluate remediation based on metrics and failed units."""
    metrics = metrics or {}
    failed_units = failed_units or []
    recommendations = [f"systemctl restart {u}" for u in failed_units]
    if metrics.get("disk", 0) >= 90 or metrics.get("disk_usage", 0) >= 90:
        recommendations.append("journalctl --vacuum-size=200M")
    return {"ok": True, "metrics": metrics, "failed_units": failed_units, "recommendations": recommendations}

def plan_recovery_steps(incident_type: str = 'service', target: str = '', max_retries: int = 3, state_path: str = 'healer_state.json') -> Dict:
    """Plan recovery steps with circuit-breaker retry tracking."""
    state = _load_state(state_path)
    key = f"{incident_type}:{target}"
    retries = state.get(key, 0)
    
    if retries >= max_retries:
        return {"ok": True, "tripped": True, "allowed": False}
    
    state[key] = retries + 1
    _save_state(state_path, state)
    
    steps = [f"systemctl restart {target}"] if incident_type == "service" and target else (["journalctl --vacuum-time=7d"] if incident_type == "disk" else [])
    return {"ok": True, "tripped": False, "allowed": True, "steps": steps}

def execute_recovery(commands: List[str] = None, dry_run: bool = True) -> Dict:
    """Execute recovery commands with dry_run default."""
    results = []
    for cmd in (commands or []):
        if dry_run:
            results.append((0, f"Dry run: {cmd}", ""))
        else:
            code, out, err = _run_cmd(cmd.split())
            results.append((code, out, err))
    
    return {"ok": all(code == 0 for code, _, _ in results), "results": results}

def execute(action: str = "evaluate_remediation", **kwargs) -> Dict:
    """Execute the specified action with provided arguments."""
    if action == "evaluate_remediation":
        return _safe_call(evaluate_remediation, kwargs)
    elif action == "plan_recovery_steps":
        return _safe_call(plan_recovery_steps, kwargs)
    elif action == "execute_recovery":
        return _safe_call(execute_recovery, kwargs)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
