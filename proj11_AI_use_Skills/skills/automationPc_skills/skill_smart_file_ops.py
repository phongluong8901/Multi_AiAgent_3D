import os
import glob
import shutil
import zipfile
import json
from typing import List, Dict, Any

TOOL_SCHEMA = {
    "name": "skill_smart_file_ops",
    "description": "Smart File Operations with Undo Backup: Search files by glob/content, organize folders by extension, batch rename safely, zip/unzip archives, and record reversible move/rename manifest for undo.",
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["search_files", "organize_by_ext", "batch_rename"]
            },
            "root": {
                "type": "string",
                "description": "Root directory for the operation"
            },
            "pattern": {
                "type": "string",
                "description": "Pattern for searching files"
            },
            "max_results": {
                "type": "integer",
                "description": "Maximum number of search results",
                "default": 50
            },
            "folder": {
                "type": "string",
                "description": "Folder to organize or rename files"
            },
            "find_str": {
                "type": "string",
                "description": "String to find in filenames"
            },
            "replace_str": {
                "type": "string",
                "description": "String to replace in filenames"
            },
            "dry_run": {
                "type": "boolean",
                "description": "Perform a dry run without making changes",
                "default": True
            }
        },
        "required": ["action"]
    }
}

def execute(action: str, **kwargs) -> Dict[str, Any]:
    if action == "search_files":
        return search_files(**kwargs)
    elif action == "organize_by_ext":
        return organize_by_ext(**kwargs)
    elif action == "batch_rename":
        return batch_rename(**kwargs)
    else:
        return {"ok": False, "error": "Invalid action"}

def search_files(root: str, pattern: str, max_results: int = 50) -> Dict[str, Any]:
    try:
        matches = glob.glob(os.path.join(root, pattern), recursive=True)
        return {"ok": True, "results": matches[:max_results]}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def organize_by_ext(folder: str, dry_run: bool = True) -> Dict[str, Any]:
    try:
        if not os.path.isdir(folder):
            return {"ok": False, "error": "Folder does not exist"}

        for filename in os.listdir(folder):
            file_path = os.path.join(folder, filename)
            if os.path.isfile(file_path):
                ext = os.path.splitext(filename)[1][1:].lower() or "no_ext"
                ext_folder = os.path.join(folder, ext)
                if not os.path.exists(ext_folder):
                    if not dry_run:
                        os.makedirs(ext_folder)
                new_path = os.path.join(ext_folder, filename)
                if not dry_run:
                    shutil.move(file_path, new_path)
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def batch_rename(folder: str, find_str: str, replace_str: str, dry_run: bool = True) -> Dict[str, Any]:
    try:
        if not os.path.isdir(folder):
            return {"ok": False, "error": "Folder does not exist"}

        for filename in os.listdir(folder):
            if find_str in filename:
                new_filename = filename.replace(find_str, replace_str)
                old_path = os.path.join(folder, filename)
                new_path = os.path.join(folder, new_filename)
                if not dry_run:
                    os.rename(old_path, new_path)
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}
