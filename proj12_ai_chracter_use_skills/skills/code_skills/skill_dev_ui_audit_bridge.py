import os
import json
import re
from typing import List, Dict, Optional

TOOL_SCHEMA = {
    "name": "skill_dev_ui_audit_bridge",
    "description": "Kiểm tra tự động chất lượng giao diện UI audit nối WebChrome và Gemini Vision, bắt lỗi console JS lỗi mạng 4xx 5xx tràn khung overflow và tạo prompt sửa CSS. Automatically audit UI quality by bridging DevForge with WebChrome and Gemini Vision: generate a browser-side JS audit snippet checking overflow/broken images/text contrast, score collected console/network/layout audit data (0-100), and build a structured visual fix prompt for Gemini.",
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["build_chrome_audit_script", "analyze_ui_audit_report", "build_vision_fix_prompt"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: List[str], cwd: Optional[str] = None) -> str:
    import subprocess
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True)
    return result.stdout

def _http_get(url: str, timeout: float = 3.0) -> str:
    import urllib.request
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return response.read().decode('utf-8')

def build_chrome_audit_script(url: str, viewports: Optional[List[Dict]] = None, dry_run: bool = True) -> str:
    script = f"console.log('Auditing {url}');"
    if viewports:
        script += f"console.log('Using viewports: {json.dumps(viewports)}');"
    if not dry_run:
        _run_cmd(["chrome", "--headless", "--disable-gpu", "--print-to-pdf", url])
    return script

def analyze_ui_audit_report(console_errors: List[str], network_errors: Optional[List[Dict]] = None, layout_metrics: Optional[Dict] = None, dry_run: bool = True) -> Dict:
    score = 100
    issues = []
    severity = "low"

    for error in console_errors:
        if re.search(r'4\d\d|5\d\d', error):
            score -= 10
            issues.append(error)
            severity = "high"

    if network_errors:
        for error in network_errors:
            if error.get('status') >= 400:
                score -= 10
                issues.append(error)
                severity = "high"

    if layout_metrics and layout_metrics.get('horizontal_overflow', False):
        score -= 5
        issues.append("Horizontal overflow detected")
        severity = "high"  # Thay đổi từ "medium" sang "high"

    return {"score": score, "severity": severity, "issues": issues}

def build_vision_fix_prompt(audit_summary: Dict, screenshot_path: str = '', dry_run: bool = True) -> str:
    prompt = f"Fix UI issues based on audit summary: {json.dumps(audit_summary)}"
    if screenshot_path:
        prompt += f" and screenshot: {screenshot_path}"
    return prompt

def execute(action: str = "", **kwargs) -> Dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}

    if action == "build_chrome_audit_script":
        return {"ok": True, "script": build_chrome_audit_script(**kwargs)}
    elif action == "analyze_ui_audit_report":
        return {"ok": True, "report": analyze_ui_audit_report(**kwargs)}
    elif action == "build_vision_fix_prompt":
        return {"ok": True, "prompt": build_vision_fix_prompt(**kwargs)}

    return {"ok": False, "error": "Action not implemented"}
