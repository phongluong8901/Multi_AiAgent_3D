import json
import subprocess
import os
import sys
from typing import Dict, Any

TOOL_SCHEMA = {
    "name": "skill_windows_scheduler_notify",
    "risk_level": "confirm",
    "description": "Build/list/register Windows Scheduled Tasks via schtasks and send desktop Toast notifications (winotify/PowerShell fallback). hẹn giờ chạy tác vụ tự động Task Scheduler schtasks, gửi thông báo góc màn hình Windows Toast Notification",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["build_schtask_cmd", "list_tasks", "send_notification"]
            },
            "task_name": {
                "type": "string",
                "description": "Name of the scheduled task"
            },
            "script_path": {
                "type": "string",
                "description": "Path to the script to be executed"
            },
            "schedule": {
                "type": "string",
                "description": "Schedule type (e.g., DAILY, WEEKLY)",
                "default": "DAILY"
            },
            "start_time": {
                "type": "string",
                "description": "Start time in HH:MM format",
                "default": "09:00"
            },
            "query": {
                "type": "string",
                "description": "Query to filter tasks"
            },
            "title": {
                "type": "string",
                "description": "Title of the notification",
                "default": "Notice"
            },
            "message": {
                "type": "string",
                "description": "Message of the notification",
                "default": ""
            }
        },
        "required": ["action"]
    }
}

def execute(action: str = "", **kwargs) -> Dict[str, Any]:
    if action == "build_schtask_cmd":
        return _safe_call(build_schtask_cmd, kwargs)
    elif action == "list_tasks":
        return _safe_call(list_tasks, kwargs)
    elif action == "send_notification":
        return _safe_call(send_notification, kwargs)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}

def build_schtask_cmd(task_name: str, script_path: str, schedule: str = 'DAILY', start_time: str = '09:00', dry_run: bool = False) -> Dict[str, Any]:
    try:
        import subprocess
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}
    
    if not task_name or not script_path:
        return {"ok": False, "error": "task_name and script_path are required"}
    
    if dry_run:
        return {
            "ok": True,
            "preview": f"schtasks /create /tn \"{task_name}\" /tr \"{script_path}\" /sc {schedule} /st {start_time}"
        }
    
    try:
        result = subprocess.run(
            ["schtasks", "/create", "/tn", task_name, "/tr", script_path, "/sc", schedule, "/st", start_time],
            capture_output=True,
            text=True, encoding="utf-8", errors="replace",
            check=True
        )
        return {"ok": True, "message": result.stdout}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": e.stderr}

def list_tasks(query: str = '', dry_run: bool = False) -> Dict[str, Any]:
    q = (query or "").strip()
    cmd = ["schtasks", "/query", "/fo", "TABLE", "/nh"]
    if q:
        cmd.extend(["/tn", q])
    if dry_run:
        return {"ok": True, "preview": " ".join(cmd)}

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True, encoding="utf-8", errors="replace",
            timeout=15,
        )
        if result.returncode != 0:
            return {"ok": False, "error": (result.stderr or result.stdout or "").strip()[:300]}
        lines = [ln.strip() for ln in (result.stdout or "").splitlines() if ln.strip() and not ln.startswith("===")]
        return {"ok": True, "count": len(lines), "tasks": lines[:40]}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def send_notification(title: str = 'Notice', message: str = '', dry_run: bool = False) -> Dict[str, Any]:
    try:
        import subprocess
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}
    
    if dry_run:
        return {
            "ok": True,
            "preview": f"PowerShell -Command \"[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null; $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); $template.SelectSingleNode('//text[1]').InnerText = '{title}'; $template.SelectSingleNode('//text[2]').InnerText = '{message}'; $toast = [Windows.UI.Notifications.ToastNotification]::new($template); [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier().Show($toast)\""
        }
    
    try:
        result = subprocess.run(
            ["PowerShell", "-Command", f"[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null; $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); $template.SelectSingleNode('//text[1]').InnerText = '{title}'; $template.SelectSingleNode('//text[2]').InnerText = '{message}'; $toast = [Windows.UI.Notifications.ToastNotification]::new($template); [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier().Show($toast)"],
            capture_output=True,
            text=True, encoding="utf-8", errors="replace",
            check=True
        )
        return {"ok": True, "message": result.stdout}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": e.stderr}

def _safe_call(fn, kw):
    import inspect as _insp
    sig = _insp.signature(fn)
    if any(p.kind == _insp.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kw)
    valid = {k: v for k, v in kw.items() if k in sig.parameters}
    return fn(**valid)
