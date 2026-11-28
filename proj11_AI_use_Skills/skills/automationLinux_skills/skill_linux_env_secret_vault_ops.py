import inspect
import os
import re
import pathlib

def _safe_call(fn, kwargs: dict):
    sig = inspect.signature(fn)
    if any(p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kwargs)
    filtered = {k: v for k, v in kwargs.items() if k in sig.parameters}
    return fn(**filtered)

TOOL_SCHEMA = {   'name': 'skill_linux_env_secret_vault_ops',
    'description': 'Quản lý file biến môi trường .env Linux an toàn, che mật khẩu token API key '
                   'mask secret, kiểm tra quyền file 0600 và biến bắt buộc. Safely parse Linux '
                   '`.env` / systemd EnvironmentFile configs with automatic secret masking for '
                   'sensitive keys (TOKEN/PASS/SECRET/KEY), upsert env variables cleanly '
                   '(dry_run=True default), and audit required keys plus POSIX file permissions '
                   '(`0600`).',
    'risk_level': 'confirm',
    'parameters': {   'type': 'object',
                      'properties': {   'action': {   'enum': [   'parse_env_file',
                                                                  'upsert_env_vars',
                                                                  'audit_env_security'],
                                                      'type': 'string'},
                                        'env_path': {'type': 'string'},
                                        'mask_secrets': {'type': 'boolean'},
                                        'updates': {'type': 'object'},
                                        'dry_run': {'type': 'boolean'},
                                        'required_keys': {   'type': 'array',
                                                             'items': {'type': 'string'}}},
                      'required': ['action']}}

def _mask_secret(value: str) -> str:
    if len(value) <= 4:
        return "***"
    return value[:2] + "***" + value[-2:]

def _parse_env_file(env_path: str) -> dict:
    env_vars = {}
    with open(env_path, 'r', encoding='utf-8', errors='replace') as file:
        for line in file:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                env_vars[key.strip()] = value.strip()
    return env_vars

def _write_env_file(env_path: str, env_vars: dict):
    with open(env_path, 'w', encoding='utf-8') as file:
        for key, value in env_vars.items():
            file.write(f"{key}={value}\n")

def parse_env_file(env_path: str = '.env', mask_secrets: bool = True) -> dict:
    try:
        env_vars = _parse_env_file(env_path)
        if mask_secrets:
            env_vars = {k: _mask_secret(v) if re.search(r'SECRET|TOKEN|PASS|KEY|PWD', k, re.IGNORECASE) else v for k, v in env_vars.items()}
        return {"ok": True, "env_vars": env_vars}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def upsert_env_vars(env_path: str = '.env', updates: dict = None, dry_run: bool = True) -> dict:
    try:
        updates = updates or {}
        env_vars = _parse_env_file(env_path) if os.path.exists(env_path) else {}
        env_vars.update(updates)
        if not dry_run:
            _write_env_file(env_path, env_vars)
        return {"ok": True, "env_vars": env_vars}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def audit_env_security(env_path: str = '.env', required_keys: list[str] = None) -> dict:
    try:
        env_vars = _parse_env_file(env_path)
        if required_keys:
            missing_keys = [key for key in required_keys if key not in env_vars]
            if missing_keys:
                return {"ok": False, "error": f"Missing required keys: {', '.join(missing_keys)}"}
        file_permissions = oct(os.stat(env_path).st_mode)[-3:]
        allowed_perms = ('600', '666') if os.name == 'nt' else ('600',)
        if file_permissions not in allowed_perms:
            return {"ok": False, "error": f"Incorrect file permissions: {file_permissions}, expected 600"}
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def execute(action: str = "parse_env_file", **kwargs) -> dict:
    if action == "parse_env_file":
        return _safe_call(parse_env_file, kwargs)
    elif action == "upsert_env_vars":
        return _safe_call(upsert_env_vars, kwargs)
    elif action == "audit_env_security":
        return _safe_call(audit_env_security, kwargs)
    else:
        return {"ok": False, "error": "Unknown action"}
