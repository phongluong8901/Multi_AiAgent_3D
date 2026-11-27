import os
import json
import zipfile
import tarfile
import tempfile
import shutil
from pathlib import Path
from typing import List, Dict, Union

TOOL_SCHEMA = {
    "name": "skill_archive_manager",
    "risk_level": "confirm",
    "description": "Inspect, compress, and extract ZIP/TAR archives safely (preventing ZipSlip path traversal). nén file zip, giải nén zip tar, xem danh sách file bên trong tệp nén",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["list_archive", "create_zip", "extract_archive"]
            },
            "archive_path": {
                "type": "string",
                "description": "Path to the archive file"
            },
            "source_path": {
                "type": "string",
                "description": "Path to the source directory or file to compress"
            },
            "output_zip": {
                "type": "string",
                "description": "Path to the output ZIP file"
            },
            "dest_dir": {
                "type": "string",
                "description": "Destination directory for extraction",
                "default": "."
            },
            "dry_run": {
                "type": "boolean",
                "description": "Preview the action without making changes",
                "default": False
            }
        },
        "required": ["action"]
    }
}

def _safe_extract(tar, path=".", members=None, *, numeric_owner=False):
    for member in tar.getmembers():
        member_path = os.path.join(path, member.name)
        if not os.path.abspath(member_path).startswith(os.path.abspath(path)):
            raise Exception("Attempted Path Traversal in Tar File")
    tar.extractall(path, members, numeric_owner=numeric_owner)

def list_archive(archive_path: str, dry_run: bool = False) -> Dict[str, Union[bool, List[str], str]]:
    if dry_run:
        return {"ok": True, "preview": f"Would list contents of {archive_path}"}
    
    try:
        if archive_path.endswith('.zip'):
            with zipfile.ZipFile(archive_path, 'r') as zip_ref:
                return {"ok": True, "files": zip_ref.namelist()}
        elif archive_path.endswith(('.tar', '.tar.gz', '.tgz', '.tar.bz2')):
            with tarfile.open(archive_path, 'r') as tar_ref:
                return {"ok": True, "files": tar_ref.getnames()}
        else:
            return {"ok": False, "error": "Unsupported archive format"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def create_zip(source_path: str, output_zip: str, dry_run: bool = False) -> Dict[str, Union[bool, str]]:
    if dry_run:
        return {"ok": True, "preview": f"Would create ZIP archive {output_zip} from {source_path}"}
    
    try:
        with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zip_ref:
            if os.path.isdir(source_path):
                for foldername, subfolders, filenames in os.walk(source_path):
                    subfolders[:] = [d for d in subfolders if d.lower() not in {'.git', 'node_modules', '__pycache__', '.venv', 'venv', 'appdata', 'windows', '$recycle.bin', 'programdata'}]
                    for filename in filenames:
                        file_path = os.path.join(foldername, filename)
                        arcname = os.path.relpath(file_path, start=source_path)
                        zip_ref.write(file_path, arcname)
            else:
                zip_ref.write(source_path, os.path.basename(source_path))
        return {"ok": True, "message": f"Created ZIP archive {output_zip}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def extract_archive(archive_path: str, dest_dir: str = '.', dry_run: bool = False) -> Dict[str, Union[bool, str]]:
    if dry_run:
        return {"ok": True, "preview": f"Would extract {archive_path} to {dest_dir}"}
    
    try:
        if not os.path.exists(dest_dir):
            os.makedirs(dest_dir)
        
        if archive_path.endswith('.zip'):
            with zipfile.ZipFile(archive_path, 'r') as zip_ref:
                zip_ref.extractall(dest_dir)
        elif archive_path.endswith(('.tar', '.tar.gz', '.tgz', '.tar.bz2')):
            with tarfile.open(archive_path, 'r') as tar_ref:
                _safe_extract(tar_ref, path=dest_dir)
        else:
            return {"ok": False, "error": "Unsupported archive format"}
        
        return {"ok": True, "message": f"Extracted {archive_path} to {dest_dir}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def execute(action: str = "list_archive", **kwargs) -> Dict[str, Union[bool, str]]:
    if action == "list_archive":
        return _safe_call(list_archive, kwargs)
    elif action == "create_zip":
        return _safe_call(create_zip, kwargs)
    elif action == "extract_archive":
        return _safe_call(extract_archive, kwargs)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}

def _safe_call(fn, kw):
    import inspect as _insp
    sig = _insp.signature(fn)
    if any(p.kind == _insp.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kw)
    valid = {k: v for k, v in kw.items() if k in sig.parameters}
    return fn(**valid)
