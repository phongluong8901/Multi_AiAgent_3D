import subprocess
from pathlib import Path
import os

TOOL_SCHEMA = {   'name': 'skill_linux_systemd_manager',
    'description': 'Quản lý dịch vụ Linux systemd systemctl, xem trạng thái service, tìm unit bị '
                   'lỗi failed, tạo file .service chạy ngầm, khởi động lại dịch vụ',
    'risk_level': 'confirm',
    'parameters': {   'type': 'object',
                      'properties': {   'action': {   'enum': [   'get_service_status',
                                                                  'list_failed_units',
                                                                  'manage_service',
                                                                  'generate_unit_file'],
                                                      'type': 'string'},
                                        'service_name': {'type': 'string'},
                                        'operation': {'type': 'string'},
                                        'dry_run': {'type': 'boolean'},
                                        'name': {'type': 'string'},
                                        'exec_start': {'type': 'string'},
                                        'work_dir': {'type': 'string'},
                                        'user': {'type': 'string'}},
                      'required': ['action']}}

def _run_cmd(cmd: list[str]) -> tuple[int, str, str]:
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', check=False)
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return 1, "", str(e)

def get_service_status(service_name: str) -> dict:
    code, stdout, stderr = _run_cmd(['systemctl', 'status', service_name])
    if code != 0:
        return {"ok": False, "error": stderr}
    return {"ok": True, "status": stdout}

def list_failed_units() -> dict:
    code, stdout, stderr = _run_cmd(['systemctl', '--failed'])
    if code != 0:
        return {"ok": False, "error": stderr}
    return {"ok": True, "failed_units": stdout}

def manage_service(service_name: str, operation: str='restart', dry_run: bool=True) -> dict:
    if dry_run:
        return {"ok": True, "message": f"Dry run: Would {operation} {service_name}"}
    code, stdout, stderr = _run_cmd(['systemctl', operation, service_name])
    if code != 0:
        return {"ok": False, "error": stderr}
    return {"ok": True, "message": stdout}

def generate_unit_file(name: str, exec_start: str, work_dir: str='/opt/app', user: str='root', output_dir: str='') -> dict:
    unit_content = f"""[Unit]
Description={name} Service
After=network.target

[Service]
User={user}
WorkingDirectory={work_dir}
ExecStart={exec_start}
Restart=always

[Install]
WantedBy=multi-user.target
"""
    try:
        safe_name = Path(name or "app").name
        if output_dir:
            base_dir = Path(output_dir)
        elif os.name != "nt" and Path("/etc/systemd/system").exists() and os.access("/etc/systemd/system", os.W_OK):
            base_dir = Path("/etc/systemd/system")
        else:
            base_dir = Path("outputs") / "systemd"
        base_dir.mkdir(parents=True, exist_ok=True)
        unit_file_path = base_dir / f"{safe_name}.service"
        unit_file_path.write_text(unit_content, encoding="utf-8")
        return {"ok": True, "path": str(unit_file_path), "unit_content": unit_content}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def execute(action: str = "get_service_status", **kwargs) -> dict:
    if action == "get_service_status":
        return get_service_status(kwargs.get("service_name", ""))
    elif action == "list_failed_units":
        return list_failed_units()
    elif action == "manage_service":
        return manage_service(
            kwargs.get("service_name", ""),
            kwargs.get("operation", "restart"),
            kwargs.get("dry_run", True)
        )
    elif action == "generate_unit_file":
        return generate_unit_file(
            kwargs.get("name", ""),
            kwargs.get("exec_start", ""),
            kwargs.get("work_dir", "/opt/app"),
            kwargs.get("user", "root")
        )
    else:
        return {"ok": False, "error": "Unknown action"}
