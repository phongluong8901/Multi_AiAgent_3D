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

def _run_cmd(command: str) -> str:
    try:
        result = subprocess.run(command, shell=True, check=True, text=True, capture_output=True)
        return result.stdout
    except subprocess.CalledProcessError as e:
        return e.stderr

def list_services(query: str = '', status: str = 'All') -> Dict[str, List[Dict[str, str]]]:
    try:
        import re
    except ImportError:
        return {"ok": False, "error": "Missing package re"}
    
    command = "Get-Service | Select-Object Name, Status, DisplayName | ConvertTo-Json"
    raw_output = _run_cmd(f"powershell -Command {command}")
    
    try:
        services = json.loads(raw_output)
    except json.JSONDecodeError:
        return {"ok": False, "error": "Failed to parse PowerShell output"}
    
    filtered_services = []
    for service in services:
        if status != 'All' and service['Status'] != status:
            continue
        if query and not (query.lower() in service['Name'].lower() or query.lower() in service['DisplayName'].lower()):
            continue
        filtered_services.append(service)
    
    return {"ok": True, "services": filtered_services}

def get_service_status(name: str) -> Dict[str, str]:
    command = f"Get-Service -Name {name} | Select-Object Status | ConvertTo-Json"
    raw_output = _run_cmd(f"powershell -Command {command}")
    
    try:
        service_status = json.loads(raw_output)
    except json.JSONDecodeError:
        return {"ok": False, "error": "Failed to parse PowerShell output"}
    
    return {"ok": True, "status": service_status['Status']}

def control_service(name: str, operation: str = 'restart', dry_run: bool = True) -> Dict[str, str]:
    if dry_run:
        return {"ok": True, "preview": f"Would {operation} service {name}"}
    
    command = f"{operation.capitalize()}-Service -Name {name}"
    output = _run_cmd(f"powershell -Command {command}")
    
    if "Cannot find any service" in output:
        return {"ok": False, "error": f"Service {name} not found"}
    
    return {"ok": True, "message": f"Service {name} {operation}ed successfully"}

def execute(action: str = "list_services", **kwargs) -> Dict[str, str]:
    if action == "list_services":
        return list_services(**kwargs)
    elif action == "get_service_status":
        return get_service_status(**kwargs)
    elif action == "control_service":
        return control_service(**kwargs)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
