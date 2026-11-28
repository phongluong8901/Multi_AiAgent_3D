import inspect
import os
import json
import time
import urllib.request
from pathlib import Path

def _safe_call(fn, kwargs: dict):
    sig = inspect.signature(fn)
    if any(p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kwargs)
    filtered = {k: v for k, v in kwargs.items() if k in sig.parameters}
    return fn(**filtered)

TOOL_SCHEMA = {   'name': 'skill_linux_alert_webhook_dispatch',
    'description': 'cảnh báo sự cố Linux tự động theo ngưỡng CPU RAM Disk nhiệt độ, chống gửi '
                   'trùng lặp cooldown, gửi thông báo Webhook Telegram Discord. Automatically '
                   'evaluates system metrics against warning/critical thresholds, enforces per-key '
                   'alert cooldown persisted to JSON, and dispatches JSON webhooks via mockable '
                   'helper.',
    'risk_level': 'confirm',
    'parameters': {   'type': 'object',
                      'properties': {   'action': {   'enum': [   'evaluate_thresholds',
                                                                  'should_send_alert',
                                                                  'dispatch_webhook'],
                                                      'type': 'string'},
                                        'metrics': {'type': 'object'},
                                        'thresholds': {'type': 'object'},
                                        'alert_key': {'type': 'string'},
                                        'cooldown_sec': {'type': 'integer'},
                                        'state_path': {'type': 'string'},
                                        'now_ts': {'type': 'number'},
                                        'url': {'type': 'string'},
                                        'title': {'type': 'string'},
                                        'message': {'type': 'string'},
                                        'severity': {'type': 'string'},
                                        'dry_run': {'type': 'boolean'}},
                      'required': ['action']}}

def _http_post(url, payload, timeout=10):
    try:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, data, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.read().decode('utf-8')
    except Exception as e:
        return {"ok": False, "error": str(e)}

def evaluate_thresholds(metrics: dict = None, thresholds: dict = None):
    metrics = metrics or {}
    thresholds = thresholds or {
        "cpu": {"warning": 75, "critical": 90},
        "ram": {"warning": 80, "critical": 95},
        "disk": {"warning": 85, "critical": 95},
        "temperature": {"warning": 70, "critical": 85}
    }
    alerts = []
    for metric, value in metrics.items():
        if metric in thresholds:
            warn = thresholds[metric]["warning"]
            crit = thresholds[metric]["critical"]
            if value >= crit:
                alerts.append((metric, "critical"))
            elif value >= warn:
                alerts.append((metric, "warning"))
    return alerts

def should_send_alert(alert_key: str = 'default', cooldown_sec: int = 300, state_path: str = 'alert_state.json', now_ts: float = None):
    now = time.time() if now_ts is None else float(now_ts)
    state_file = Path(state_path)
    state = {}
    if state_file.exists():
        with state_file.open('r', encoding='utf-8') as f:
            state = json.load(f)
    last_sent = state.get(alert_key, 0)
    if now - last_sent >= cooldown_sec:
        state[alert_key] = now
        state_file.parent.mkdir(parents=True, exist_ok=True)
        with state_file.open('w', encoding='utf-8') as f:
            json.dump(state, f)
        return True
    return False

def dispatch_webhook(url: str = '', title: str = '', message: str = '', severity: str = 'warning', dry_run: bool = True):
    payload = {
        "title": title,
        "message": message,
        "severity": severity
    }
    if dry_run:
        return {"ok": True, "payload": payload}
    return _http_post(url, payload)

def execute(action: str = "evaluate_thresholds", **kwargs) -> dict:
    try:
        if action == "evaluate_thresholds":
            return {"ok": True, "alerts": _safe_call(evaluate_thresholds, kwargs)}
        elif action == "should_send_alert":
            return {"ok": _safe_call(should_send_alert, kwargs)}
        elif action == "dispatch_webhook":
            return _safe_call(dispatch_webhook, kwargs)
        else:
            return {"ok": False, "error": "Unknown action"}
    except Exception as e:
        return {"ok": False, "error": str(e)}
