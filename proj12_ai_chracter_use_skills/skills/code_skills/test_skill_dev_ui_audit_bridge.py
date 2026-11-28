import pytest
import skill_dev_ui_audit_bridge as mod
from pathlib import Path

def test_tool_schema_actions():
    actions = mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert set(actions) == {"build_chrome_audit_script", "analyze_ui_audit_report", "build_vision_fix_prompt"}

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_build_chrome_audit_script(tmp_path):
    script = mod.execute(action="build_chrome_audit_script", url="http://example.com", dry_run=True)["script"]
    assert "Auditing http://example.com" in script

def test_analyze_ui_audit_report(tmp_path):
    report = mod.execute(action="analyze_ui_audit_report", console_errors=["Error 404"], network_errors=[{"status": 500}], layout_metrics={"horizontal_overflow": True}, dry_run=True)["report"]
    assert report == {"score": 75, "severity": "high", "issues": ["Error 404", {"status": 500}, "Horizontal overflow detected"]}

def test_build_vision_fix_prompt(tmp_path):
    audit_summary = {"score": 75, "severity": "high", "issues": ["Error 404", {"status": 500}, "Horizontal overflow detected"]}
    screenshot_path = tmp_path / "screenshot.png"
    screenshot_path.touch()  # Tạo file ảnh để đảm bảo nó tồn tại
    prompt = mod.execute(action="build_vision_fix_prompt", audit_summary=audit_summary, screenshot_path=str(screenshot_path), dry_run=True)["prompt"]
    assert "Fix UI issues based on audit summary" in prompt
    assert "screenshot.png" in prompt
