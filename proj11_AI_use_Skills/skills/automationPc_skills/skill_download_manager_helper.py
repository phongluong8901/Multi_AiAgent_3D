import os
import hashlib
import requests

TOOL_SCHEMA = {
    "name": "skill_download_manager_helper",
    "description": "Compute SHA256/MD5 file checksums, verify file integrity against expected hash, and download files safely to a destination folder.",
    "risk_level": "confirm",
    "parameters": {
        "compute_hash": {
            "file_path": "str",
            "algo": "str (default: 'sha256')"
        },
        "verify_checksum": {
            "file_path": "str",
            "expected_hash": "str",
            "algo": "str (default: 'sha256')"
        },
        "download_file": {
            "url": "str",
            "dest_dir": "str (default: '.')",
            "dry_run": "bool (default: True)"
        }
    }
}

def _compute_file_hash(file_path, algo='sha256'):
    try:
        hash_func = hashlib.new(algo)
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_func.update(chunk)
        return hash_func.hexdigest()
    except Exception as e:
        return {"ok": False, "error": str(e)}

def _download_file(url, dest_path):
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        with open(dest_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def compute_hash(file_path: str, algo: str = 'sha256') -> dict:
    hash_value = _compute_file_hash(file_path, algo)
    if isinstance(hash_value, dict) and not hash_value["ok"]:
        return hash_value
    return {"ok": True, "hash": hash_value}

def verify_checksum(file_path: str, expected_hash: str, algo: str = 'sha256') -> dict:
    computed_hash = _compute_file_hash(file_path, algo)
    if isinstance(computed_hash, dict) and not computed_hash["ok"]:
        return computed_hash
    if computed_hash == expected_hash:
        return {"ok": True}
    return {"ok": False, "error": "Checksum mismatch"}

def download_file(url: str, dest_dir: str = '.', dry_run: bool = True) -> dict:
    if not os.path.exists(dest_dir):
        os.makedirs(dest_dir)
    file_name = os.path.basename(url)
    dest_path = os.path.join(dest_dir, file_name)
    if dry_run:
        return {"ok": True, "message": f"Dry run: Would download {url} to {dest_path}"}
    result = _download_file(url, dest_path)
    if result["ok"]:
        result["file_path"] = dest_path
    return result

def execute(action: str = "compute_hash", **kwargs) -> dict:
    if action == "compute_hash":
        return compute_hash(**kwargs)
    elif action == "verify_checksum":
        return verify_checksum(**kwargs)
    elif action == "download_file":
        return download_file(**kwargs)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
