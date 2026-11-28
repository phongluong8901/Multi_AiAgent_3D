import os
import re
import shutil
from pathlib import Path

TOOL_SCHEMA = {   'name': 'skill_linux_sys_health',
    'description': 'Giám sát sức khỏe Linux, kiểm tra CPU RAM bộ nhớ load average uptime, dung '
                   'lượng ổ đĩa df. Monitor Linux system health using pure Python stdlib '
                   '(`/proc/meminfo`, `/proc/loadavg`, `os.statvfs` / `shutil.disk_usage`) with '
                   'injectable proc_dir or helper functions; also parse `uptime` and `df -B1` '
                   'strings cleanly without requiring psutil.',
    'risk_level': 'safe',
    'parameters': {   'type': 'object',
                      'properties': {   'action': {   'enum': [   'get_cpu_ram_summary',
                                                                  'get_disk_usage',
                                                                  'parse_uptime_load'],
                                                      'type': 'string'},
                                        'proc_dir': {'type': 'string'},
                                        'dry_run': {'type': 'boolean'},
                                        'paths': {'type': 'array', 'items': {'type': 'string'}},
                                        'raw_uptime': {'type': 'string'}},
                      'required': ['action']}}

def _read_file(file_path: Path) -> str:
    with open(file_path, 'r', encoding='utf-8', errors='replace') as file:
        return file.read()

def _parse_meminfo(meminfo: str) -> dict:
    meminfo_dict = {}
    for line in meminfo.splitlines():
        if ':' in line:
            key, value = line.split(':', 1)
            meminfo_dict[key.strip()] = value.strip()
    return meminfo_dict

def _parse_loadavg(loadavg: str) -> dict:
    loadavg_parts = loadavg.split()
    return {
        "1min": float(loadavg_parts[0]),
        "5min": float(loadavg_parts[1]),
        "15min": float(loadavg_parts[2]),
        "running_processes": int(loadavg_parts[3].split('/')[0]),
        "total_processes": int(loadavg_parts[3].split('/')[1]),
        "last_pid": int(loadavg_parts[4])
    }

def get_cpu_ram_summary(proc_dir: str = '/proc', dry_run: bool = True) -> dict:
    try:
        meminfo_path = Path(proc_dir) / 'meminfo'
        loadavg_path = Path(proc_dir) / 'loadavg'
        
        if dry_run:
            return {"ok": True, "dry_run": True, "data": {}}
        
        meminfo_content = _read_file(meminfo_path)
        loadavg_content = _read_file(loadavg_path)
        
        meminfo_dict = _parse_meminfo(meminfo_content)
        loadavg_dict = _parse_loadavg(loadavg_content)
        
        return {
            "ok": True,
            "data": {
                "total_memory": int(meminfo_dict['MemTotal'].split()[0]) * 1024,
                "free_memory": int(meminfo_dict['MemFree'].split()[0]) * 1024,
                "available_memory": int(meminfo_dict['MemAvailable'].split()[0]) * 1024,
                "load_average": loadavg_dict
            }
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}

def get_disk_usage(paths: list[str] = None, dry_run: bool = True) -> dict:
    try:
        if paths is None:
            paths = ['/']
        
        if dry_run:
            return {"ok": True, "dry_run": True, "data": {}}
        
        disk_usage_data = {}
        for path in paths:
            usage = shutil.disk_usage(path)
            disk_usage_data[path] = {
                "total": usage.total,
                "used": usage.used,
                "free": usage.free
            }
        
        return {
            "ok": True,
            "data": disk_usage_data
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}

def parse_uptime_load(raw_uptime: str = '', dry_run: bool = True) -> dict:
    try:
        if dry_run:
            return {"ok": True, "dry_run": True, "data": {}}
        
        uptime_match = re.search(r'up (\d+) days?,\s+(\d+):(\d+)', raw_uptime)
        if uptime_match:
            days = int(uptime_match.group(1))
            hours = int(uptime_match.group(2))
            minutes = int(uptime_match.group(3))
            total_seconds = (days * 86400) + (hours * 3600) + (minutes * 60)
        else:
            total_seconds = 0
        
        return {
            "ok": True,
            "data": {
                "uptime_seconds": total_seconds
            }
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}

def execute(action: str = "get_cpu_ram_summary", **kwargs) -> dict:
    dry_run = kwargs.get('dry_run', True)
    if action == "get_cpu_ram_summary":
        proc_dir = kwargs.get('proc_dir', '/proc')
        return get_cpu_ram_summary(proc_dir=proc_dir, dry_run=dry_run)
    elif action == "get_disk_usage":
        paths = kwargs.get('paths', None)
        return get_disk_usage(paths=paths, dry_run=dry_run)
    elif action == "parse_uptime_load":
        raw_uptime = kwargs.get('raw_uptime', '')
        return parse_uptime_load(raw_uptime=raw_uptime, dry_run=dry_run)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
