import os
import subprocess
import json
import urllib.request
from urllib.error import URLError, HTTPError
from typing import List, Tuple, Dict, Any

TOOL_SCHEMA = {
    "name": "skill_dev_e2e_smoke_verifier",
    "description": "Verify newly generated mini-apps end-to-end: check HTTP endpoint status/JSON keys/HTML markers via mockable `_http_get`, verify CLI command exit code/stdout via mockable `_run_cmd`, and aggregate pass/fail verification reports.",
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["verify_http_contract", "verify_cli_smoke", "run_verification_suite"]},
        },
        "required": ["action"],
    },
}

def _http_get(url: str, timeout: float = 3.0) -> Tuple[int, str]:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            status = response.getcode()
            content = response.read().decode('utf-8')
            return status, content
    except HTTPError as e:
        return e.code, e.reason
    except URLError as e:
        return 0, str(e.reason)

def _run_cmd(cmd: List[str], cwd: str = None) -> Tuple[int, str, str]:
    try:
        result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=False)
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return 1, '', str(e)

def verify_http_contract(url: str, expected_status: int = 200, required_substrings: List[str] = None, required_json_keys: List[str] = None) -> Dict[str, Any]:
    status, content = _http_get(url)
    if status != expected_status:
        return {"ok": False, "error": f"Unexpected status code: {status}"}

    if required_substrings:
        for substring in required_substrings:
            if substring not in content:
                return {"ok": False, "error": f"Missing substring: {substring}"}

    if required_json_keys:
        try:
            data = json.loads(content)
            for key in required_json_keys:
                if key not in data:
                    return {"ok": False, "error": f"Missing JSON key: {key}"}
        except json.JSONDecodeError:
            return {"ok": False, "error": "Invalid JSON response"}

    return {"ok": True}

def verify_cli_smoke(cmd: List[str], expected_exit: int = 0, must_contain: str = '') -> Dict[str, Any]:
    exit_code, stdout, stderr = _run_cmd(cmd)
    if exit_code != expected_exit:
        return {"ok": False, "error": f"Unexpected exit code: {exit_code}"}

    if must_contain and must_contain not in stdout:
        return {"ok": False, "error": f"Missing required output: {must_contain}"}

    return {"ok": True}

def run_verification_suite(checks: List[Dict[str, Any]]) -> Dict[str, Any]:
    results = []
    for check in checks:
        action = check.get("action")
        if action == "verify_http_contract":
            result = verify_http_contract(**check.get("params", {}))
        elif action == "verify_cli_smoke":
            result = verify_cli_smoke(**check.get("params", {}))
        else:
            result = {"ok": False, "error": f"Unknown check action: {action}"}
        results.append(result)
    return {"ok": all(r["ok"] for r in results), "results": results}

def execute(action: str, **kwargs) -> Dict[str, Any]:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}

    if action == "verify_http_contract":
        return verify_http_contract(**kwargs)
    elif action == "verify_cli_smoke":
        return verify_cli_smoke(**kwargs)
    elif action == "run_verification_suite":
        return run_verification_suite(**kwargs)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
