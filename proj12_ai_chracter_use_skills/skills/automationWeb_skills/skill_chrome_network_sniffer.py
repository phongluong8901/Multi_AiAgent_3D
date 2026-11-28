import json
import time
from typing import List, Dict

TOOL_SCHEMA = {
    "name": "skill_chrome_network_sniffer",
    "description": "Bắt gói tin API ngầm XHR Fetch trên trình duyệt Chrome, lọc request JSON theo URL và status code, phân tích log mạng HAR. Catch hidden API XHR Fetch on Chrome browser, filter requests by URL and status code, analyze network log HAR.",
    "risk_level": "safe",
    "parameters": {
        "filter_requests": {
            "description": "Filter requests by URL substring, HTTP method, status code, or JSON content-type.",
            "parameters": {
                "entries": "list[dict]",
                "url_contains": "str",
                "status_min": "int",
                "only_json": "bool"
            }
        },
        "parse_har_file": {
            "description": "Parse HAR file and limit the number of entries.",
            "parameters": {
                "har_path": "str",
                "limit": "int"
            }
        },
        "sniff_cdp_plan": {
            "description": "Build CDP network capture plans.",
            "parameters": {
                "url_filter": "str",
                "duration_sec": "int",
                "cdp_url": "str",
                "dry_run": "bool"
            }
        }
    }
}

def execute(action: str = "filter_requests", **kwargs) -> dict:
    try:
        if action == "filter_requests":
            return _safe_call(filter_requests, kwargs)
        elif action == "parse_har_file":
            return _safe_call(parse_har_file, kwargs)
        elif action == "sniff_cdp_plan":
            return _safe_call(sniff_cdp_plan, kwargs)
        else:
            return {"ok": False, "error": "Unknown action"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def filter_requests(entries: List[Dict], url_contains: str = '', status_min: int = 0, only_json: bool = False) -> dict:
    filtered_entries = []
    for entry in entries:
        if url_contains in entry.get('request', {}).get('url', ''):
            if entry.get('response', {}).get('status', 0) >= status_min:
                if only_json and entry.get('response', {}).get('content', {}).get('mimeType', '').startswith('application/json'):
                    filtered_entries.append(entry)
                elif not only_json:
                    filtered_entries.append(entry)
    return {"ok": True, "filtered_entries": filtered_entries}

def parse_har_file(har_path: str, limit: int = 50) -> dict:
    try:
        with open(har_path, 'r', encoding='utf-8') as file:
            har_data = json.load(file)
        entries = har_data.get('log', {}).get('entries', [])[:limit]
        return {"ok": True, "entries": entries}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def _run_cmd(cmd: str) -> str:
    try:
        import subprocess
        result = subprocess.run(cmd, shell=True, check=True, capture_output=True, text=True)
        return result.stdout
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": str(e)}

def sniff_cdp_plan(url_filter: str = '/api/', duration_sec: int = 10, cdp_url: str = 'http://localhost:9222', dry_run: bool = True) -> dict:
    try:
        if dry_run:
            return {"ok": True, "message": "Dry run completed. No actual network sniffing performed."}
        else:
            cmd = f"chrome-cli --remote-debugging-url={cdp_url} network sniff {url_filter} --duration={duration_sec}"
            result = _run_cmd(cmd)
            return {"ok": True, "result": result}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def _safe_call(fn, kw):
    import inspect as _insp
    sig = _insp.signature(fn)
    if any(p.kind == _insp.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kw)
    valid = {k: v for k, v in kw.items() if k in sig.parameters}
    return fn(**valid)
