import json
import types
import subprocess
from typing import Dict, List

TOOL_SCHEMA = {
    "name": "skill_windows_service_manager",
    "risk_level": "confirm",
    "description": "xem danh sách Windows Services, trạng thái dịch vụ nền, khởi động lại hoặc dừng service. List/filter Windows Services and safely start/stop/restart non-critical services via PowerShell Get-Service/Restart-Service.",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["list_services", "get_service_status", "control_service"]
            },
            "query": {
                "type": "string",
                "description": "Filter services by name or description"
            },
            "status": {
                "type": "string",
                "enum": ["Running", "Stopped", "Paused", "All"],
                "description": "Filter services by status"
            },
            "name": {
                "type": "string",
                "description": "Name of the service to get status or control"
            },
            "operation": {
                "type": "string",
                "enum": ["start", "stop", "restart"],
                "description": "Operation to perform on the service"
            },
            "dry_run": {
                "type": "boolean",
                "description": "Preview the operation without executing it"
            }
        },
        "required": ["action"]
    }
}

def _run_ps(ps_command: str) -> tuple[bool, str]:
    full_cmd = f"[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; {ps_command}"
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", full_cmd],
            shell=False,
            text=True,
            encoding="utf-8",
            errors="replace",
            capture_output=True,
            timeout=15,
        )
        if result.returncode != 0:
            return False, (result.stderr or result.stdout or "").strip()
        return True, (result.stdout or "").strip()
    except Exception as e:
        return False, str(e)


def list_services(query: str = '', status: str = 'All') -> Dict[str, List[Dict[str, str]]]:
    ps = "Get-Service | Select-Object Name, @{N='Status';E={$_.Status.ToString()}}, DisplayName | ConvertTo-Json -Compress"
    ok, raw_output = _run_ps(ps)
    if not ok:
        return {"ok": False, "error": raw_output or "PowerShell Get-Service failed"}

    try:
        services = json.loads(raw_output) if raw_output else []
        if isinstance(services, dict):
            services = [services]
    except json.JSONDecodeError:
        return {"ok": False, "error": f"Failed to parse PowerShell output: {raw_output[:160]}"}

    q_low = (query or "").strip().lower()
    filtered_services = []
    for service in services:
        st_val = str(service.get("Status") or "")
        if status and status != 'All' and st_val.lower() != status.lower():
            continue
        if q_low and not (
            q_low in str(service.get("Name") or "").lower()
            or q_low in str(service.get("DisplayName") or "").lower()
        ):
            continue
        filtered_services.append(service)

    return {"ok": True, "count": len(filtered_services), "services": filtered_services[:60]}


def get_service_status(name: str) -> Dict[str, str]:
    safe_name = (name or "").replace("'", "''").strip()
    if not safe_name:
        return {"ok": False, "error": "Missing service name"}
    ps = f"Get-Service -Name '{safe_name}' | Select-Object Name, @{{N='Status';E={{$_.Status.ToString()}}}}, DisplayName | ConvertTo-Json -Compress"
    ok, raw_output = _run_ps(ps)
    if not ok:
        return {"ok": False, "error": raw_output or f"Service '{safe_name}' not found"}
    try:
        svc = json.loads(raw_output)
    except json.JSONDecodeError:
        return {"ok": False, "error": "Failed to parse PowerShell output"}
    return {"ok": True, "name": svc.get("Name", safe_name), "status": svc.get("Status", ""), "display_name": svc.get("DisplayName", "")}


def control_service(name: str, operation: str = 'restart', dry_run: bool = True) -> Dict[str, str]:
    safe_name = (name or "").replace("'", "''").strip()
    op = (operation or "restart").strip().lower()
    if op not in ("start", "stop", "restart"):
        return {"ok": False, "error": f"Invalid operation: {operation}"}
    if dry_run:
        return {"ok": True, "preview": f"Would {op} service {safe_name}"}

    ok, output = _run_ps(f"{op.capitalize()}-Service -Name '{safe_name}'")
    if not ok:
        return {"ok": False, "error": output or f"Failed to {op} service {safe_name}"}
    return {"ok": True, "message": f"Service {safe_name} {op}ed successfully"}

def execute(action: str = "list_services", **kwargs) -> Dict[str, str]:
    if action == "list_services":
        return _safe_call(list_services, kwargs)
    elif action == "get_service_status":
        return _safe_call(get_service_status, kwargs)
    elif action == "control_service":
        return _safe_call(control_service, kwargs)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}

def _safe_call(fn, kw):
    import inspect as _insp
    sig = _insp.signature(fn)
    if any(p.kind == _insp.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kw)
    valid = {k: v for k, v in kw.items() if k in sig.parameters}
    return fn(**valid)
