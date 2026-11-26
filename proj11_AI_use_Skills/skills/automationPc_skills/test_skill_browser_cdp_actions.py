import pytest
from unittest.mock import MagicMock
from skill_browser_cdp_actions import execute, TOOL_SCHEMA

def test_tool_schema():
    assert isinstance(TOOL_SCHEMA, dict)
    assert "name" in TOOL_SCHEMA
    assert "description" in TOOL_SCHEMA
    assert "risk_level" in TOOL_SCHEMA
    assert "parameters" in TOOL_SCHEMA

def test_unknown_action():
    result = execute("unknown_action")
    assert result == {"ok": False, "error": "Unknown action"}

def test_navigate_dry_run(monkeypatch):
    mock_playwright = MagicMock()
    monkeypatch.setattr("skill_browser_cdp_actions._lazy_import_playwright", lambda: mock_playwright)
    result = execute("navigate", url="http://example.com", dry_run=True)
    assert result == {"ok": True}

def test_click_element_dry_run(monkeypatch):
    mock_playwright = MagicMock()
    monkeypatch.setattr("skill_browser_cdp_actions._lazy_import_playwright", lambda: mock_playwright)
    result = execute("click_element", selector="button", dry_run=True)
    assert result == {"ok": True}

def test_fill_input_dry_run(monkeypatch):
    mock_playwright = MagicMock()
    monkeypatch.setattr("skill_browser_cdp_actions._lazy_import_playwright", lambda: mock_playwright)
    result = execute("fill_input", selector="input", text="test", dry_run=True)
    assert result == {"ok": True}

def test_eval_js_dry_run(monkeypatch):
    mock_playwright = MagicMock()
    monkeypatch.setattr("skill_browser_cdp_actions._lazy_import_playwright", lambda: mock_playwright)
    result = execute("eval_js", script="console.log('test')", dry_run=True)
    assert result == {"ok": True}
