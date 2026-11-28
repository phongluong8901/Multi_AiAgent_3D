import os
import json
import time
import sqlite3
import urllib.request
from pathlib import Path
from typing import Any, Dict, List

TOOL_SCHEMA = {
    "name": "skill_dev_tracker_widget_builder",
    "description": "Generate lightweight Python tracker apps (weather, price, rss) that poll a source and store results locally (dry_run=True default), parse sample price/weather JSON payloads into normalized records, and evaluate alert comparators (lt, lte, gt, gte). Tạo nhanh tool theo dõi thời tiết check giá vàng crypto sản phẩm, phân tích dữ liệu JSON mẫu và đánh giá ngưỡng cảnh báo giá",
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["generate_tracker_app", "parse_price_weather_sample", "evaluate_tracker_alert"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: List[str], cwd: str = None) -> str:
    import subprocess
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True)
    return result.stdout

def _http_get(url: str, timeout: float = 3.0) -> str:
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return response.read().decode('utf-8')

def generate_tracker_app(tracker_kind: str = 'price', target_name: str = 'item', source_url: str = '', interval_sec: int = 300, output_dir: str = '.', dry_run: bool = True) -> Dict[str, Any]:
    if dry_run:
        return {"ok": True, "message": "Dry run: generate_tracker_app", "details": locals()}

    app_path = Path(output_dir) / f"{tracker_kind}_tracker.py"
    with app_path.open('w') as f:
        f.write(f"# {tracker_kind.capitalize()} Tracker for {target_name}\n")
        f.write(f"import time\nimport urllib.request\nimport json\n")
        f.write(f"def track():\n")
        f.write(f"    while True:\n")
        f.write(f"        try:\n")
        f.write(f"            response = urllib.request.urlopen('{source_url}').read().decode('utf-8')\n")
        f.write(f"            data = json.loads(response)\n")
        f.write(f"            print(f'Fetched data: {{data}}')\n")
        f.write(f"        except Exception as e:\n")
        f.write(f"            print(f'Error fetching data: {{e}}')\n")
        f.write(f"        time.sleep({interval_sec})\n")
        f.write(f"if __name__ == '__main__':\n")
        f.write(f"    track()\n")
    return {"ok": True, "message": f"Generated {tracker_kind} tracker app at {app_path}"}

def parse_price_weather_sample(raw_json: str, tracker_kind: str = 'weather') -> Dict[str, Any]:
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError as e:
        return {"ok": False, "error": f"Invalid JSON: {e}"}

    if tracker_kind == 'weather':
        normalized = {
            "temperature": data.get("main", {}).get("temp"),
            "humidity": data.get("main", {}).get("humidity"),
            "description": data.get("weather", [{}])[0].get("description"),
        }
    elif tracker_kind == 'price':
        normalized = {
            "price": data.get("price"),
            "symbol": data.get("symbol"),
            "timestamp": data.get("timestamp"),
        }
    else:
        return {"ok": False, "error": f"Unknown tracker kind: {tracker_kind}"}

    return {"ok": True, "normalized": normalized}

def evaluate_tracker_alert(current_val: float, target_val: float, comparator: str = 'lte') -> Dict[str, Any]:
    comparators = {
        "lt": lambda x, y: x < y,
        "lte": lambda x, y: x <= y,
        "gt": lambda x, y: x > y,
        "gte": lambda x, y: x >= y,
    }

    if comparator not in comparators:
        return {"ok": False, "error": f"Unknown comparator: {comparator}"}

    result = comparators[comparator](current_val, target_val)
    return {"ok": True, "result": result}

def execute(action: str = "generate_tracker_app", **kwargs) -> Dict[str, Any]:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}

    if action == "generate_tracker_app":
        return generate_tracker_app(**kwargs)
    elif action == "parse_price_weather_sample":
        return parse_price_weather_sample(**kwargs)
    elif action == "evaluate_tracker_alert":
        return evaluate_tracker_alert(**kwargs)
