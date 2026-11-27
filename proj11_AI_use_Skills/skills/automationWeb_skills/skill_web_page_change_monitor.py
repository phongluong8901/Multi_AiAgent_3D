import hashlib
import json
import os
from difflib import unified_diff

TOOL_SCHEMA = {
    "name": "skill_web_page_change_monitor",
    "description": "Normalize page text, compute SHA256 fingerprints, save baseline snapshots to local JSON, and return unified diffs whenever monitored web content changes.",
    "risk_level": "safe",
    "parameters": {
        "action": "normalize_content, check_and_update_snapshot, list_monitors",
        "monitor_id": "str",
        "current_text": "str",
        "store_path": "str (default='web_monitors.json')"
    },
    "vi_description": "Normalize nội dung trang web, tính toán dấu vân tay SHA256, lưu bản chụp cơ sở vào tệp JSON cục bộ và trả về các diff thống nhất mỗi khi nội dung web được theo dõi thay đổi.",
    "vi_parameters": {
        "action": "normalize_content, check_and_update_snapshot, list_monitors",
        "monitor_id": "str",
        "current_text": "str",
        "store_path": "str (default='web_monitors.json')"
    }
}

def normalize_content(text: str) -> str:
    return text.strip().lower()

def compute_sha256(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

def _load_snapshots(store_path: str) -> dict:
    if os.path.exists(store_path):
        with open(store_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def _save_snapshots(snapshots: dict, store_path: str) -> None:
    with open(store_path, 'w', encoding='utf-8') as f:
        json.dump(snapshots, f, ensure_ascii=False, indent=4)

def check_and_update_snapshot(monitor_id: str, current_text: str, store_path: str = 'web_monitors.json') -> dict:
    try:
        current_text = normalize_content(current_text)
        current_sha256 = compute_sha256(current_text)
        snapshots = _load_snapshots(store_path)
        
        if monitor_id not in snapshots:
            snapshots[monitor_id] = {
                "sha256": current_sha256,
                "text": current_text
            }
            _save_snapshots(snapshots, store_path)
            return {"ok": True, "message": "Snapshot saved."}
        
        if snapshots[monitor_id]["sha256"] != current_sha256:
            diff = list(unified_diff(snapshots[monitor_id]["text"].splitlines(), current_text.splitlines()))
            snapshots[monitor_id] = {
                "sha256": current_sha256,
                "text": current_text
            }
            _save_snapshots(snapshots, store_path)
            return {"ok": True, "diff": diff}
        
        return {"ok": True, "message": "No changes detected."}
    
    except Exception as e:
        return {"ok": False, "error": str(e)}

def list_monitors(store_path: str = 'web_monitors.json') -> dict:
    try:
        snapshots = _load_snapshots(store_path)
        return {"ok": True, "monitors": list(snapshots.keys())}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def execute(action: str = "normalize_content", **kwargs) -> dict:
    if action == "normalize_content":
        text = kwargs.get("text", "")
        return {"ok": True, "normalized_text": normalize_content(text)}
    
    elif action == "check_and_update_snapshot":
        monitor_id = kwargs.get("monitor_id")
        current_text = kwargs.get("current_text")
        store_path = kwargs.get("store_path", "web_monitors.json")
        if not monitor_id or not current_text:
            return {"ok": False, "error": "Missing required parameters."}
        return check_and_update_snapshot(monitor_id, current_text, store_path)
    
    elif action == "list_monitors":
        store_path = kwargs.get("store_path", "web_monitors.json")
        return list_monitors(store_path)
    
    else:
        return {"ok": False, "error": "Unknown action."}
