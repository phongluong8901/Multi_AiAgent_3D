import inspect
import subprocess
import re
from pathlib import Path

def _safe_call(fn, kwargs: dict):
    sig = inspect.signature(fn)
    if any(p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kwargs)
    filtered = {k: v for k, v in kwargs.items() if k in sig.parameters}
    return fn(**filtered)

TOOL_SCHEMA = {   'name': 'skill_linux_package_update_ops',
    'description': 'Kiểm tra cập nhật phần mềm Linux apt upgrade, liệt kê gói có bản mới, lên kế '
                   'hoạch dọn dẹp cache autoremove an toàn. Check available package updates via '
                   '`_run_cmd`, and build safe maintenance/cleanup command plans (dry_run=True '
                   'default).',
    'risk_level': 'confirm',
    'parameters': {   'type': 'object',
                      'properties': {   'action': {   'enum': [   'check_updates',
                                                                  'build_maintenance_plan'],
                                                      'type': 'string'},
                                        'clean_cache': {'type': 'boolean'},
                                        'autoremove': {'type': 'boolean'},
                                        'dry_run': {'type': 'boolean'}},
                      'required': ['action']}}

def _run_cmd(cmd: list[str]) -> tuple[int, str, str]:
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', check=False)
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return 1, "", str(e)

def parse_apt_upgradable(raw_output: str) -> list[str]:
    package_list = []
    for line in raw_output.splitlines():
        match = re.match(r'^(?P<package>\S+)/\S+\s+(?P<version>\S+)\s+\S+\s+(?P<new_version>\S+)', line)
        if match:
            package_list.append(match.group('package'))
    return package_list

def check_updates() -> dict:
    code, output, error = _run_cmd(['apt', 'list', '--upgradable'])
    if code != 0:
        return {"ok": False, "error": error}
    packages = parse_apt_upgradable(output)
    return {"ok": True, "packages": packages}

def build_maintenance_plan(clean_cache: bool = True, autoremove: bool = True, dry_run: bool = True) -> dict:
    commands = []
    if clean_cache:
        commands.append('apt-get clean')
    if autoremove:
        commands.append('apt-get autoremove -y')
    
    if dry_run:
        return {"ok": True, "commands": commands}
    
    results = []
    for cmd in commands:
        code, output, error = _run_cmd(cmd.split())
        results.append({"command": cmd, "code": code, "output": output, "error": error})
    
    return {"ok": all(r["code"] == 0 for r in results), "results": results}

def execute(action: str = "check_updates", **kwargs) -> dict:
    if action == "check_updates":
        return check_updates()
    elif action == "build_maintenance_plan":
        return _safe_call(build_maintenance_plan, kwargs)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
