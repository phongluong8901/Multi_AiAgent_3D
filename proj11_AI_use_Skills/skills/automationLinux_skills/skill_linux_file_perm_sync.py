import inspect
import os
import subprocess
import pathlib

def _safe_call(fn, kwargs: dict):
    sig = inspect.signature(fn)
    if any(p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kwargs)
    filtered = {k: v for k, v in kwargs.items() if k in sig.parameters}
    return fn(**filtered)

TOOL_SCHEMA = {   'name': 'skill_linux_file_perm_sync',
    'description': 'Quản lý quyền tệp thư mục Linux chmod chown, phát hiện file quyền 777 nguy '
                   'hiểm, tạo lệnh đồng bộ sao lưu rsync an toàn. Manage Linux file permissions '
                   '(chmod/chown), detect world-writable files (777/666), and build safe rsync '
                   'sync commands.',
    'risk_level': 'confirm',
    'parameters': {   'type': 'object',
                      'properties': {   'action': {   'enum': [   'audit_permissions',
                                                                  'build_chmod_chown_cmd',
                                                                  'build_rsync_cmd'],
                                                      'type': 'string'},
                                        'target_path': {'type': 'string'},
                                        'max_depth': {'type': 'integer'},
                                        'mode': {'type': 'string'},
                                        'owner': {'type': 'string'},
                                        'recursive': {'type': 'boolean'},
                                        'src': {'type': 'string'},
                                        'dst': {'type': 'string'},
                                        'delete': {'type': 'boolean'},
                                        'exclude': {'type': 'array', 'items': {'type': 'string'}},
                                        'dry_run': {'type': 'boolean'}},
                      'required': ['action']}}

def _run_cmd(cmd: list[str]) -> tuple[int, str, str]:
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', check=False)
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return 1, "", str(e)

def audit_permissions(target_path: str = '.', max_depth: int = 2) -> dict:
    target = pathlib.Path(target_path)
    if not target.exists():
        return {"ok": False, "error": "Target path does not exist"}

    risky_paths = []
    base_parts = len(target.resolve().parts)
    for root, dirs, files in os.walk(target):
        root_path = pathlib.Path(root)
        try:
            depth = len(root_path.resolve().parts) - base_parts
        except OSError:
            depth = 0
        if depth >= max_depth:
            dirs[:] = []
        entries = ([root_path / d for d in dirs] if depth < max_depth else []) + (
            [root_path / f for f in files] if depth < max_depth else []
        )
        for path in entries:
            try:
                if path.is_symlink():
                    continue
                mode = path.stat().st_mode & 0o777
                if (mode & 0o002) != 0:
                    risky_paths.append(str(path))
            except OSError:
                continue

    return {"ok": True, "risky_paths": risky_paths}

def build_chmod_chown_cmd(target_path: str = '.', mode: str = '755', owner: str = '', recursive: bool = False) -> dict:
    target = pathlib.Path(target_path)
    if not target.exists():
        return {"ok": False, "error": "Target path does not exist"}

    cmd = ['chmod']
    if recursive:
        cmd.append('-R')
    cmd.extend([mode, target_path])

    if owner:
        chown_cmd = ['chown']
        if recursive:
            chown_cmd.append('-R')
        chown_cmd.extend([owner, target_path])
        return {"ok": True, "commands": [cmd, chown_cmd]}
    else:
        return {"ok": True, "commands": [cmd]}

def build_rsync_cmd(src: str = '', dst: str = '', delete: bool = False, exclude: list[str] = None, dry_run: bool = True) -> dict:
    src = src.rstrip('/') + '/'
    dst = dst.rstrip('/') + '/'

    cmd = ['rsync', '-av']
    if delete:
        cmd.append('--delete')
    if exclude:
        for pattern in exclude:
            cmd.extend(['--exclude', pattern])
    if dry_run:
        cmd.append('--dry-run')
    cmd.extend([src, dst])

    return {"ok": True, "command": cmd}

def execute(action: str = "audit_permissions", **kwargs) -> dict:
    if action == "audit_permissions":
        return _safe_call(audit_permissions, kwargs)
    elif action == "build_chmod_chown_cmd":
        return _safe_call(build_chmod_chown_cmd, kwargs)
    elif action == "build_rsync_cmd":
        return _safe_call(build_rsync_cmd, kwargs)
    else:
        return {"ok": False, "error": "Unknown action"}
