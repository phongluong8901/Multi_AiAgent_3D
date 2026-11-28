import os
import re
import json
from typing import List, Dict, Optional

TOOL_SCHEMA = {
    "name": "skill_folder_watcher",
    "risk_level": "safe",
    "description": "Evaluate file routing rules by extension/regex and scan a folder to map matching files to destination folders. Theo dõi thư mục Downloads tự động, quy tắc tự động phân loại file mới tải về.",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["evaluate_rules", "scan_folder_once"]
            },
            "filename": {
                "type": "string",
                "description": "Filename to evaluate rules against."
            },
            "folder": {
                "type": "string",
                "description": "Folder to scan for files.",
                "default": "."
            },
            "rules": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "pattern": {
                            "type": "string",
                            "description": "Regex pattern to match filenames."
                        },
                        "destination": {
                            "type": "string",
                            "description": "Destination folder for matched files."
                        }
                    },
                    "required": ["pattern", "destination"]
                }
            },
            "dry_run": {
                "type": "boolean",
                "description": "If true, perform a dry run without moving files.",
                "default": True
            }
        },
        "required": ["action"]
    }
}

def evaluate_rules(filename: str, rules: List[Dict]) -> List[Dict]:
    matches = []
    for rule in rules:
        if re.match(rule['pattern'], filename):
            matches.append(rule)
    return matches

def scan_folder_once(folder: str = '.', rules: Optional[List[Dict]] = None, dry_run: bool = True) -> Dict:
    if rules is None:
        rules = []
    
    try:
        files = os.listdir(folder)
    except Exception as e:
        return {"ok": False, "error": f"Failed to list files in folder: {e}"}
    
    results = []
    for filename in files:
        matches = evaluate_rules(filename, rules)
        for match in matches:
            source_path = os.path.join(folder, filename)
            dest_path = os.path.join(match['destination'], filename)
            if dry_run:
                results.append({"source": source_path, "destination": dest_path, "action": "move (dry run)"})
            else:
                try:
                    os.makedirs(match['destination'], exist_ok=True)
                    os.rename(source_path, dest_path)
                    results.append({"source": source_path, "destination": dest_path, "action": "moved"})
                except Exception as e:
                    results.append({"source": source_path, "destination": dest_path, "action": f"failed to move: {e}"})
    
    return {"ok": True, "results": results}

def execute(action: str = "scan_folder_once", **kwargs) -> Dict:
    if action == "evaluate_rules":
        filename = kwargs.get("filename", "")
        rules = kwargs.get("rules", [])
        return {"ok": True, "matches": evaluate_rules(filename, rules)}
    elif action == "scan_folder_once":
        folder = kwargs.get("folder", ".")
        rules = kwargs.get("rules", [])
        dry_run = kwargs.get("dry_run", True)
        return scan_folder_once(folder, rules, dry_run)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
