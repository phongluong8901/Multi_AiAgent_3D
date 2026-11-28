import os
import re
import subprocess
from pathlib import Path

TOOL_SCHEMA = {   'name': 'skill_linux_thermal_power',
    'description': 'Đo nhiệt độ CPU SoC Linux thermal zone, cảnh báo quá nhiệt Orange Pi server '
                   'Ubuntu, kiểm tra throttling nguồn. Monitor Linux thermal zones from '
                   '`/sys/class/thermal`, evaluate warning/critical temperature thresholds, and '
                   'inspect basic power/throttling status.',
    'risk_level': 'safe',
    'parameters': {   'type': 'object',
                      'properties': {   'action': {   'enum': [   'read_thermal_zones',
                                                                  'evaluate_thermal_status',
                                                                  'check_throttling_info'],
                                                      'type': 'string'},
                                        'sys_thermal_dir': {'type': 'string'},
                                        'temps_c': {'type': 'array', 'items': {'type': 'number'}},
                                        'warn_c': {'type': 'number'},
                                        'crit_c': {'type': 'number'}},
                      'required': ['action']}}

def _run_cmd(cmd: list[str]) -> tuple[int, str, str]:
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', check=False)
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return 1, "", str(e)

def read_thermal_zones(sys_thermal_dir: str = '/sys/class/thermal') -> dict:
    thermal_zones = []
    try:
        for zone in os.listdir(sys_thermal_dir):
            zone_path = Path(sys_thermal_dir) / zone
            if zone_path.is_dir() and (zone_path / 'temp').exists():
                with open(zone_path / 'temp', 'r', encoding='utf-8') as temp_file:
                    temp = int(temp_file.read().strip()) / 1000.0
                thermal_zones.append(temp)
    except Exception as e:
        return {"ok": False, "error": str(e)}
    return {"ok": True, "thermal_zones": thermal_zones}

def evaluate_thermal_status(temps_c: list[float], warn_c: float = 70.0, crit_c: float = 85.0) -> dict:
    warnings = [temp for temp in temps_c if warn_c <= temp < crit_c]
    criticals = [temp for temp in temps_c if temp >= crit_c]
    if criticals:
        return {"ok": False, "status": "critical", "temperatures": criticals}
    elif warnings:
        return {"ok": False, "status": "warning", "temperatures": warnings}
    return {"ok": True, "status": "normal"}

def check_throttling_info() -> dict:
    cmd = ['cpufreq-info']
    return_code, stdout, stderr = _run_cmd(cmd)
    if return_code != 0:
        return {"ok": False, "error": stderr.strip()}
    throttling_info = re.search(r'current CPU frequency is (\d+) MHz \(asserted by call to hardware\)', stdout)
    if throttling_info:
        return {"ok": True, "throttling": True, "frequency": int(throttling_info.group(1))}
    return {"ok": True, "throttling": False}

def execute(action: str = "read_thermal_zones", **kwargs) -> dict:
    dry_run = kwargs.get('dry_run', False)  # Thay đổi từ True sang False
    if dry_run:
        return {"ok": True, "dry_run": True}

    if action == "read_thermal_zones":
        sys_thermal_dir = kwargs.get('sys_thermal_dir', '/sys/class/thermal')
        return read_thermal_zones(sys_thermal_dir)
    elif action == "evaluate_thermal_status":
        temps_c = kwargs.get('temps_c', [])
        warn_c = kwargs.get('warn_c', 70.0)
        crit_c = kwargs.get('crit_c', 85.0)
        return evaluate_thermal_status(temps_c, warn_c, crit_c)
    elif action == "check_throttling_info":
        return check_throttling_info()
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
