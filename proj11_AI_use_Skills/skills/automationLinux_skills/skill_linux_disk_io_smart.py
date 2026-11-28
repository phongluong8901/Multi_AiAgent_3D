import os
import subprocess
import re
import pathlib
import json  # Thêm dòng import json

TOOL_SCHEMA = {   'name': 'skill_linux_disk_io_smart',
    'description': 'Kiểm tra ổ cứng phân vùng Linux lsblk df, tìm file log nặng phình to trong '
                   '/var/log, giám sát dung lượng lưu trữ. Inspect Linux block devices via '
                   'mockable `_run_cmd`, parse `df` text lines safely (skipping header and lines '
                   'with fewer than 6 columns), and scan a directory for files >= min_mb.',
    'risk_level': 'safe',
    'parameters': {   'type': 'object',
                      'properties': {   'action': {   'type': 'string',
                                                      'enum': [   'list_block_devices',
                                                                  'parse_df_output',
                                                                  'find_log_bloat']},
                                        'raw_df': {'type': 'string'},
                                        'root_dir': {'type': 'string'},
                                        'min_mb': {'type': 'number'},
                                        'top_n': {'type': 'integer'}},
                      'required': ['action']}}

def _run_cmd(cmd: list[str]) -> tuple[int, str, str]:
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', check=False)
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return 1, "", str(e)

def list_block_devices() -> dict:
    code, stdout, stderr = _run_cmd(['lsblk', '-J'])
    if code != 0:
        return {'ok': False, 'error': stderr}
    try:
        return {'ok': True, 'data': json.loads(stdout)}
    except json.JSONDecodeError as e:
        return {'ok': False, 'error': str(e)}

def parse_df_output(raw_df: str) -> dict:
    lines = raw_df.strip().split('\n')
    if len(lines) < 2:
        return {'ok': False, 'error': 'Invalid df output'}
    data = []
    for line in lines[1:]:
        parts = line.split()
        if len(parts) < 6:
            continue
        data.append({
            'filesystem': parts[0],
            'size': parts[1],
            'used': parts[2],
            'avail': parts[3],
            'use_percent': parts[4],
            'mounted_on': parts[5]
        })
    return {'ok': True, 'data': data}

def find_log_bloat(root_dir: str='/var/log', min_mb: float=50.0, top_n: int=10) -> dict:
    min_size = min_mb * 1024 * 1024
    try:
        files = []
        for path in pathlib.Path(root_dir).rglob('*'):
            if path.is_file():
                size = path.stat().st_size
                if size >= min_size:
                    files.append((path, size))
        files.sort(key=lambda x: x[1], reverse=True)
        return {'ok': True, 'data': [{'path': str(f[0]), 'size_mb': f[1] / (1024 * 1024)} for f in files[:top_n]]}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

def execute(action: str = "", dry_run: bool = True, **kwargs) -> dict:
    allowed_actions = ['list_block_devices', 'parse_df_output', 'find_log_bloat']
    if action not in allowed_actions:
        return {'ok': False, 'error': f'Unknown action: {action}'}

    if action == 'list_block_devices':
        return list_block_devices()
    elif action == 'parse_df_output':
        raw_df = kwargs.get('raw_df', '')
        return parse_df_output(raw_df)
    elif action == 'find_log_bloat':
        root_dir = kwargs.get('root_dir', '/var/log')
        min_mb = kwargs.get('min_mb', 50.0)
        top_n = kwargs.get('top_n', 10)
        return find_log_bloat(root_dir, min_mb, top_n)

    return {'ok': False, 'error': 'Action not implemented'}
