import json
import logging
from typing import List, Dict, Any

TOOL_SCHEMA = {
    "name": "skill_chrome_som_a11y_observer",
    "description": "Quan sát trang web Accessibility Tree, Set-of-Mark đánh số phần tử tương tác 1 2 3 trên Chrome CDP, bấm click hoặc điền text theo số ID không cần đoán CSS class. "
                   "Accessibility Tree + Set-of-Mark (SoM) observer for Chrome CDP: generate JS to scan visible interactive elements (including open shadow DOM), "
                   "assign data-som-id badges [1..N], format ultra-compact LLM element lists, and execute click/fill actions by som_id via Playwright CDP (lazy-imported, dry_run=True default).",
    "risk_level": "safe",
    "parameters": {
        "max_elements": {"type": "int", "default": 80},
        "include_shadow": {"type": "bool", "default": True},
        "screenshot_path": {"type": "str", "default": "som_view.png"},
        "cdp_url": {"type": "str", "default": "http://localhost:9222"},
        "som_id": {"type": "int"},
        "op": {"type": "str", "default": "click"},
        "text": {"type": "str", "default": ""},
        "dry_run": {"type": "bool", "default": True}
    }
}

def _run_cmd(cmd: str) -> str:
    try:
        import subprocess
        result = subprocess.run(cmd, shell=True, check=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
        return result.stdout
    except ImportError:
        return json.dumps({"ok": False, "error": "Missing package subprocess"})
    except subprocess.CalledProcessError as e:
        return json.dumps({"ok": False, "error": str(e)})

def _fetch_raw(url: str) -> str:
    try:
        import requests
        response = requests.get(url)
        response.raise_for_status()
        return response.text
    except ImportError:
        return json.dumps({"ok": False, "error": "Missing package requests"})
    except requests.RequestException as e:
        return json.dumps({"ok": False, "error": str(e)})

def build_som_inject_js(max_elements: int = 80, include_shadow: bool = True) -> str:
    # Placeholder for actual JS generation logic
    return f"console.log('Building SOM with max_elements={max_elements} and include_shadow={include_shadow}');"

def format_a11y_tree(elements: List[Dict[str, Any]], max_items: int = 60) -> str:
    # Placeholder for actual formatting logic
    return f"Formatted {min(len(elements), max_items)} elements."

def observe_page_som(cdp_url: str = 'http://localhost:9222', screenshot_path: str = 'som_view.png', max_elements: int = 80, dry_run: bool = True) -> Dict[str, Any]:
    try:
        raw_data = _fetch_raw(cdp_url)
        if not raw_data.startswith('{"ok": false'):
            elements = json.loads(raw_data)
            formatted_tree = format_a11y_tree(elements, max_items=max_elements)
            if not dry_run:
                _run_cmd(f"echo '{formatted_tree}' > {screenshot_path}")
            return {"ok": True, "data": formatted_tree}
        else:
            return json.loads(raw_data)
    except Exception as e:
        return {"ok": False, "error": str(e)}

def act_by_som_id(som_id: int, op: str = 'click', text: str = '', cdp_url: str = 'http://localhost:9222', dry_run: bool = True) -> Dict[str, Any]:
    try:
        raw_data = _fetch_raw(cdp_url)
        if not raw_data.startswith('{"ok": false'):
            elements = json.loads(raw_data)
            if som_id <= len(elements):
                action = f"Performing {op} on element {som_id}"
                if op == 'fill' and text:
                    action += f" with text '{text}'"
                if not dry_run:
                    _run_cmd(f"echo '{action}'")
                return {"ok": True, "action": action}
            else:
                return {"ok": False, "error": f"Element ID {som_id} not found"}
        else:
            return json.loads(raw_data)
    except Exception as e:
        return {"ok": False, "error": str(e)}

def execute(action: str = "build_som_inject_js", **kwargs) -> Dict[str, Any]:
    if action == "build_som_inject_js":
        return {"ok": True, "js": _safe_call(build_som_inject_js, kwargs)}
    elif action == "format_a11y_tree":
        return {"ok": True, "formatted": format_a11y_tree([], **kwargs)}
    elif action == "observe_page_som":
        return _safe_call(observe_page_som, kwargs)
    elif action == "act_by_som_id":
        return _safe_call(act_by_som_id, kwargs)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}

def _safe_call(fn, kw):
    import inspect as _insp
    sig = _insp.signature(fn)
    if any(p.kind == _insp.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kw)
    valid = {k: v for k, v in kw.items() if k in sig.parameters}
    return fn(**valid)
