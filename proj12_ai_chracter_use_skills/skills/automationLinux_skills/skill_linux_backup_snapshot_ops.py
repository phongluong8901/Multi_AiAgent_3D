import inspect
import os
import subprocess
import tarfile
import hashlib
import shutil
from pathlib import Path
from datetime import datetime

def _safe_call(fn, kwargs: dict):
    sig = inspect.signature(fn)
    if any(p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kwargs)
    filtered = {k: v for k, v in kwargs.items() if k in sig.parameters}
    return fn(**filtered)

TOOL_SCHEMA = {   'name': 'skill_linux_backup_snapshot_ops',
    'description': 'Sao lưu dữ liệu Linux tar.gz tự động, giữ lại N bản backup mới nhất retention '
                   'policy, kiểm tra mã băm SHA256 toàn vẹn',
    'risk_level': 'confirm',
    'parameters': {   'type': 'object',
                      'properties': {   'action': {   'enum': [   'create_tar_backup',
                                                                  'apply_retention_policy',
                                                                  'verify_archive_sha256'],
                                                      'type': 'string'},
                                        'source_dir': {'type': 'string'},
                                        'dest_dir': {'type': 'string'},
                                        'prefix': {'type': 'string'},
                                        'dry_run': {'type': 'boolean'},
                                        'backup_dir': {'type': 'string'},
                                        'keep_last': {'type': 'integer'},
                                        'archive_path': {'type': 'string'},
                                        'expected_sha256': {'type': 'string'}},
                      'required': ['action']}}

def _run_cmd(cmd: list[str]) -> tuple[int, str, str]:
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', check=False)
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return 1, "", str(e)

def create_tar_backup(source_dir: str, dest_dir: str, prefix: str = 'backup', dry_run: bool = True) -> dict:
    source_path = Path(source_dir)
    dest_path = Path(dest_dir)
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    backup_filename = f"{prefix}_{timestamp}.tar.gz"
    backup_path = dest_path / backup_filename

    if not source_path.exists():
        return {"ok": False, "error": "Source directory does not exist"}

    if not dest_path.exists():
        dest_path.mkdir(parents=True, exist_ok=True)

    if not dry_run:
        with tarfile.open(backup_path, "w:gz") as tar:
            tar.add(source_path, arcname=source_path.name)
    
    return {"ok": True, "backup_path": str(backup_path)}

def apply_retention_policy(backup_dir: str, keep_last: int = 5, prefix: str = 'backup', dry_run: bool = True) -> dict:
    backup_path = Path(backup_dir)
    if not backup_path.exists():
        return {"ok": False, "error": "Backup directory does not exist"}

    backup_files = sorted(backup_path.glob(f"{prefix}_*.tar.gz"), reverse=True)
    files_to_delete = backup_files[keep_last:]

    for file in files_to_delete:
        if not dry_run:
            file.unlink()
    
    return {"ok": True, "deleted_files": [str(file) for file in files_to_delete]}

def verify_archive_sha256(archive_path: str, expected_sha256: str = '') -> dict:
    archive_path = Path(archive_path)
    if not archive_path.exists():
        return {"ok": False, "error": "Archive file does not exist"}

    sha256_hash = hashlib.sha256()
    with open(archive_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    
    calculated_sha256 = sha256_hash.hexdigest()
    if expected_sha256 and calculated_sha256 != expected_sha256:
        return {"ok": False, "error": "SHA256 checksum does not match"}
    
    return {"ok": True, "sha256": calculated_sha256}

def execute(action: str = "create_tar_backup", **kwargs) -> dict:
    if action == "create_tar_backup":
        return _safe_call(create_tar_backup, kwargs)
    elif action == "apply_retention_policy":
        return _safe_call(apply_retention_policy, kwargs)
    elif action == "verify_archive_sha256":
        return _safe_call(verify_archive_sha256, kwargs)
    else:
        return {"ok": False, "error": "Unknown action"}
