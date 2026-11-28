import os
import time
import json
import shutil
from datetime import datetime, timedelta
from typing import List, Dict, Any
from urllib.parse import urlparse

TOOL_SCHEMA = {
    "name": "skill_chrome_file_upload_download",
    "description": "Validate local files and upload them to web file inputs via CDP (dry_run=True default), plus scan a Chrome Downloads directory to detect newly finished downloads and in-progress .crdownload files.",
    "risk_level": "confirm",
    "parameters": {
        "action": {
            "type": "string",
            "description": "Action to perform: prepare_upload or scan_chrome_downloads"
        },
        "file_paths": {
            "type": "list",
            "description": "List of file paths to upload",
            "required": False
        },
        "selector": {
            "type": "string",
            "description": "CSS selector for the file input element",
            "default": "input[type=file]",
            "required": False
        },
        "cdp_url": {
            "type": "string",
            "description": "URL for Chrome DevTools Protocol",
            "default": "http://localhost:9222",
            "required": False
        },
        "dry_run": {
            "type": "boolean",
            "description": "If True, do not perform actual upload",
            "default": True,
            "required": False
        },
        "downloads_dir": {
            "type": "string",
            "description": "Directory to scan for Chrome downloads",
            "default": ".",
            "required": False
        },
        "recent_minutes": {
            "type": "integer",
            "description": "Number of minutes to consider for recent downloads",
            "default": 30,
            "required": False
        }
    }
}

def execute(action: str = "prepare_upload", **kwargs) -> Dict[str, Any]:
    if action == "prepare_upload":
        return _safe_call(prepare_upload, kwargs)
    elif action == "scan_chrome_downloads":
        return _safe_call(scan_chrome_downloads, kwargs)
    else:
        return {"ok": False, "error": "Unknown action"}

def prepare_upload(file_paths: List[str], selector: str = 'input[type=file]', cdp_url: str = 'http://localhost:9222', dry_run: bool = True) -> Dict[str, Any]:
    if not file_paths:
        return {"ok": False, "error": "No file paths provided"}

    if dry_run:
        return {"ok": True, "message": "Dry run completed", "file_paths": file_paths, "selector": selector, "cdp_url": cdp_url}

    try:
        import requests
    except ImportError:
        return {"ok": False, "error": "Missing package requests"}

    session = requests.Session()
    parsed_url = urlparse(cdp_url)
    target_url = f"{parsed_url.scheme}://{parsed_url.netloc}/json"

    try:
        response = session.get(target_url)
        response.raise_for_status()
    except requests.RequestException as e:
        return {"ok": False, "error": f"Failed to connect to CDP: {e}"}

    targets = response.json()
    if not targets:
        return {"ok": False, "error": "No Chrome targets found"}

    target = targets[0]
    ws_url = target['webSocketDebuggerUrl']

    try:
        from websocket import create_connection
    except ImportError:
        return {"ok": False, "error": "Missing package websocket-client"}

    ws = create_connection(ws_url)

    try:
        ws.send(json.dumps({"id": 1, "method": "Page.enable"}))
        ws.send(json.dumps({"id": 2, "method": "DOM.enable"}))
        ws.send(json.dumps({"id": 3, "method": "Runtime.enable"}))

        ws.send(json.dumps({
            "id": 4,
            "method": "DOM.querySelector",
            "params": {"selector": selector}
        }))
        response = json.loads(ws.recv())
        node_id = response['result']['nodeId']

        ws.send(json.dumps({
            "id": 5,
            "method": "DOM.setFileInputFiles",
            "params": {"nodeId": node_id, "files": file_paths}
        }))
        ws.recv()
    except Exception as e:
        return {"ok": False, "error": f"Failed to upload files: {e}"}
    finally:
        ws.close()

    return {"ok": True, "message": "Files uploaded successfully", "file_paths": file_paths}

def scan_chrome_downloads(downloads_dir: str = '.', recent_minutes: int = 30) -> Dict[str, Any]:
    if not os.path.exists(downloads_dir):
        return {"ok": False, "error": f"Downloads directory {downloads_dir} does not exist"}

    recent_time = datetime.now() - timedelta(minutes=recent_minutes)
    files = os.listdir(downloads_dir)
    new_downloads = []
    in_progress_downloads = []

    for file in files:
        file_path = os.path.join(downloads_dir, file)
        if os.path.isfile(file_path):
            mod_time = datetime.fromtimestamp(os.path.getmtime(file_path))
            if mod_time > recent_time:
                if file.endswith('.crdownload'):
                    in_progress_downloads.append(file_path)
                else:
                    new_downloads.append(file_path)

    return {
        "ok": True,
        "new_downloads": new_downloads,
        "in_progress_downloads": in_progress_downloads
    }

def _safe_call(fn, kw):
    import inspect as _insp
    sig = _insp.signature(fn)
    if any(p.kind == _insp.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kw)
    valid = {k: v for k, v in kw.items() if k in sig.parameters}
    return fn(**valid)
